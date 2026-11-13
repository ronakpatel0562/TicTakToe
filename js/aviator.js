// Pro Aviator Flight Simulator & Crash Betting Engine
class AviatorGame {
    constructor() {
        this.canvas = document.getElementById('aviator-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.state = 'WAITING'; // 'WAITING', 'FLYING', 'CRASHED'
        this.multiplier = 1.00;
        this.crashPoint = 1.00;
        this.startTime = 0;
        this.waitingStartTime = 0;
        this.waitingDuration = 5000; // 5 seconds bet window

        // Particles & animation state
        this.particles = [];
        this.planeX = 50;
        this.planeY = 0;
        this.propellerAngle = 0;
        this.flightPoints = [];
        this.flewAwayOffset = 0;

        // History
        this.history = [1.45, 3.12, 1.15, 8.40, 2.05, 1.88, 14.20, 1.32];

        // Bet panels (Support 2 simultaneous bets)
        this.panels = [
            { id: 1, betAmount: 10, hasBet: false, cashedOut: false, autoCashout: false, autoCashoutVal: 2.00, winAmount: 0 },
            { id: 2, betAmount: 20, hasBet: false, cashedOut: false, autoCashout: false, autoCashoutVal: 1.50, winAmount: 0 }
        ];

        // Simulated community players
        this.simulatedPlayers = [];

        this.initDOM();
    }

    initDOM() {
        if (!this.canvas) return;

        this.multiplierDisplay = document.getElementById('aviator-multiplier');
        this.statusDisplay = document.getElementById('aviator-status-banner');
        this.historyContainer = document.getElementById('aviator-history-chips');
        this.simPlayersTable = document.getElementById('aviator-sim-bets');
        this.walletRefillBtn = document.getElementById('aviator-refill-btn');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 120);
        });

        this.bindPanelEvents(1);
        this.bindPanelEvents(2);
        this.renderHistory();

        if (this.walletRefillBtn) {
            this.walletRefillBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                window.arcadeWallet.add(500);
            });
        }

        this.startWaitingRound();
        this.animationLoop();
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    bindPanelEvents(panelId) {
        const p = this.panels[panelId - 1];
        const input = document.getElementById(`aviator-bet-amount-${panelId}`);
        const actionBtn = document.getElementById(`aviator-action-btn-${panelId}`);
        const autoCheck = document.getElementById(`aviator-auto-check-${panelId}`);
        const autoInput = document.getElementById(`aviator-auto-val-${panelId}`);
        const quickBtns = document.querySelectorAll(`.aviator-quick-${panelId}`);

        if (input) {
            input.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                p.betAmount = Math.round(val);
                input.value = p.betAmount;
            });
        }

        if (quickBtns) {
            quickBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    window.soundEngine.playClick();
                    const action = btn.dataset.action;
                    if (action === '2x') p.betAmount *= 2;
                    else if (action === 'half') p.betAmount = Math.max(1, Math.floor(p.betAmount / 2));
                    else p.betAmount = parseFloat(action);
                    
                    if (input) input.value = p.betAmount;
                    this.updatePanelUI(panelId);
                });
            });
        }

        if (autoCheck) {
            autoCheck.addEventListener('change', (e) => {
                p.autoCashout = e.target.checked;
                if (autoInput) autoInput.disabled = !p.autoCashout;
            });
        }

        if (autoInput) {
            autoInput.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val) || val < 1.05) val = 1.05;
                p.autoCashoutVal = val;
                autoInput.value = val.toFixed(2);
            });
        }

        if (actionBtn) {
            actionBtn.addEventListener('click', () => {
                this.handleActionClick(panelId);
            });
        }

        this.updatePanelUI(panelId);
    }

    handleActionClick(panelId) {
        const p = this.panels[panelId - 1];

        if (this.state === 'WAITING') {
            // Placing or canceling bet
            if (!p.hasBet) {
                if (window.arcadeWallet.deduct(p.betAmount)) {
                    p.hasBet = true;
                    p.cashedOut = false;
                    window.soundEngine.playClick();
                    this.updatePanelUI(panelId);
                } else {
                    if (window.showToast) {
                        window.showToast('Insufficient Balance', 'Opening Payment Gateway to deposit funds...', 'warning');
                    }
                    if (window.paymentGateway) {
                        window.paymentGateway.open(Math.max(50, p.betAmount * 5));
                    }
                }
            } else {
                // Cancel bet before round starts
                window.arcadeWallet.add(p.betAmount);
                p.hasBet = false;
                window.soundEngine.playClick();
                this.updatePanelUI(panelId);
            }
        } else if (this.state === 'FLYING') {
            // Cashout!
            if (p.hasBet && !p.cashedOut) {
                this.cashOutPanel(panelId);
            }
        }
    }

    cashOutPanel(panelId) {
        const p = this.panels[panelId - 1];
        if (!p.hasBet || p.cashedOut) return;

        p.cashedOut = true;
        p.winAmount = p.betAmount * this.multiplier;
        window.arcadeWallet.add(p.winAmount);
        window.soundEngine.playAviatorCashout();

        if (window.showToast) {
            window.showToast('Cashed Out! 💰', `Won +${window.arcadeWallet.format(p.winAmount)} @ ${this.multiplier.toFixed(2)}x`, 'success');
        }

        // Update stats
        if (window.arcadeWallet.stats) {
            window.arcadeWallet.stats.aviator.totalBets++;
            window.arcadeWallet.stats.aviator.totalWon += p.winAmount;
            if (this.multiplier > window.arcadeWallet.stats.aviator.highestMultiplier) {
                window.arcadeWallet.stats.aviator.highestMultiplier = this.multiplier;
            }
            if (p.winAmount > window.arcadeWallet.stats.aviator.biggestWin) {
                window.arcadeWallet.stats.aviator.biggestWin = p.winAmount;
            }
            window.arcadeWallet.saveStats();
        }

        this.updatePanelUI(panelId);
    }

    generateCrashPoint() {
        // Authentic crash curve distribution
        const rand = Math.random();
        if (rand < 0.08) {
            // Instant crash
            return +(1.00 + Math.random() * 0.15).toFixed(2);
        } else if (rand < 0.55) {
            // 1.15 to 2.20
            return +(1.15 + Math.random() * 1.05).toFixed(2);
        } else if (rand < 0.85) {
            // 2.20 to 6.50
            return +(2.20 + Math.random() * 4.30).toFixed(2);
        } else if (rand < 0.96) {
            // 6.50 to 20.00
            return +(6.50 + Math.random() * 13.50).toFixed(2);
        } else {
            // Moonshot 20x to 100x+
            return +(20.00 + Math.random() * 80.00).toFixed(2);
        }
    }

    startWaitingRound() {
        this.state = 'WAITING';
        this.waitingStartTime = performance.now();
        this.multiplier = 1.00;
        this.flightPoints = [];
        this.particles = [];
        this.flewAwayOffset = 0;

        // Reset panel cashout states, keep bets if auto-betting or reset
        this.panels.forEach((p, idx) => {
            p.cashedOut = false;
            p.winAmount = 0;
            this.updatePanelUI(idx + 1);
        });

        this.generateSimulatedPlayers();
        this.renderSimulatedPlayers();

        if (this.statusDisplay) {
            this.statusDisplay.style.display = 'block';
            this.statusDisplay.className = 'aviator-status-banner waiting';
        }
    }

    startFlight() {
        this.state = 'FLYING';
        this.startTime = performance.now();
        this.multiplier = 1.00;
        this.crashPoint = this.generateCrashPoint();
        this.flightPoints = [];

        if (this.statusDisplay) {
            this.statusDisplay.style.display = 'none';
        }

        window.soundEngine.startAviatorFlight();

        this.panels.forEach((p, idx) => {
            this.updatePanelUI(idx + 1);
        });
    }

    crash() {
        this.state = 'CRASHED';
        window.soundEngine.playAviatorCrash();

        // History
        this.history.unshift(this.multiplier);
        if (this.history.length > 20) this.history.pop();
        this.renderHistory();

        if (this.statusDisplay) {
            this.statusDisplay.style.display = 'block';
            this.statusDisplay.className = 'aviator-status-banner crashed';
            this.statusDisplay.innerHTML = `<span>FLEW AWAY!</span><small>@ ${this.multiplier.toFixed(2)}x</small>`;
        }

        this.panels.forEach((p, idx) => {
            this.updatePanelUI(idx + 1);
            p.hasBet = false; // Bet was lost if not cashed out
        });

        // Pause 3 seconds then new round
        setTimeout(() => {
            this.startWaitingRound();
        }, 3200);
    }

    updatePanelUI(panelId) {
        const p = this.panels[panelId - 1];
        const actionBtn = document.getElementById(`aviator-action-btn-${panelId}`);
        if (!actionBtn) return;

        if (this.state === 'WAITING') {
            if (p.hasBet) {
                actionBtn.className = 'aviator-btn cancel-btn';
                actionBtn.innerHTML = `<span>CANCEL</span><small>${window.arcadeWallet.format(p.betAmount)}</small>`;
            } else {
                actionBtn.className = 'aviator-btn bet-btn';
                actionBtn.innerHTML = `<span>BET</span><small>${window.arcadeWallet.format(p.betAmount)}</small>`;
            }
        } else if (this.state === 'FLYING') {
            if (p.hasBet && !p.cashedOut) {
                actionBtn.className = 'aviator-btn cashout-btn pulse';
                const liveWin = p.betAmount * this.multiplier;
                actionBtn.innerHTML = `<span>CASH OUT</span><small>${window.arcadeWallet.format(liveWin)}</small>`;
            } else if (p.cashedOut) {
                actionBtn.className = 'aviator-btn won-btn';
                actionBtn.innerHTML = `<span>WON</span><small>+${window.arcadeWallet.format(p.winAmount)}</small>`;
            } else {
                actionBtn.className = 'aviator-btn waiting-btn';
                actionBtn.innerHTML = `<span>FLYING...</span>`;
            }
        } else if (this.state === 'CRASHED') {
            if (p.cashedOut) {
                actionBtn.className = 'aviator-btn won-btn';
                actionBtn.innerHTML = `<span>WON</span><small>+${window.arcadeWallet.format(p.winAmount)}</small>`;
            } else {
                actionBtn.className = 'aviator-btn crashed-btn';
                actionBtn.innerHTML = `<span>FLEW AWAY</span>`;
            }
        }
    }

    renderHistory() {
        if (!this.historyContainer) return;
        this.historyContainer.innerHTML = '';
        this.history.forEach(mult => {
            const chip = document.createElement('div');
            chip.className = 'history-chip';
            if (mult < 2.00) chip.classList.add('low');
            else if (mult < 10.00) chip.classList.add('mid');
            else chip.classList.add('high');
            chip.textContent = `${mult.toFixed(2)}x`;
            this.historyContainer.appendChild(chip);
        });
    }

    generateSimulatedPlayers() {
        const names = ['Apex_99', 'CryptoGhost', 'Lucky_Sam', 'NovaQueen', 'CyberViper', 'JackpotAce', 'NeonFalcon', 'ZenithX'];
        this.simulatedPlayers = names.map(name => {
            const bet = [5, 10, 25, 50, 100, 200][Math.floor(Math.random() * 6)];
            const targetCashout = +(1.20 + Math.random() * 4.50).toFixed(2);
            return {
                name,
                bet,
                targetCashout,
                cashedOut: false,
                win: 0
            };
        });
    }

    updateSimulatedPlayers() {
        if (this.state !== 'FLYING') return;
        this.simulatedPlayers.forEach(p => {
            if (!p.cashedOut && this.multiplier >= p.targetCashout) {
                p.cashedOut = true;
                p.win = p.bet * p.targetCashout;
            }
        });
        this.renderSimulatedPlayers();
    }

    renderSimulatedPlayers() {
        if (!this.simPlayersTable) return;
        this.simPlayersTable.innerHTML = this.simulatedPlayers.map(p => {
            const statusClass = p.cashedOut ? 'text-emerald' : 'text-muted';
            const statusText = p.cashedOut ? `+${window.arcadeWallet.format(p.win)} (@${p.targetCashout}x)` : 'In Flight...';
            return `
                <div class="sim-player-row">
                    <span class="player-name"><i class="fa-solid fa-user-astronaut"></i> ${p.name}</span>
                    <span class="player-bet">${window.arcadeWallet.format(p.bet)}</span>
                    <span class="player-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join('');
    }

    animationLoop() {
        requestAnimationFrame(() => this.animationLoop());
        this.update();
        this.draw();
    }

    update() {
        const now = performance.now();

        if (this.state === 'WAITING') {
            const elapsed = now - this.waitingStartTime;
            const remaining = Math.max(0, (this.waitingDuration - elapsed) / 1000);
            if (this.statusDisplay) {
                this.statusDisplay.innerHTML = `<span>NEXT ROUND IN</span><div class="countdown-bar"><div class="fill" style="width:${(remaining / 5) * 100}%"></div></div><small>${remaining.toFixed(1)}s</small>`;
            }
            if (this.multiplierDisplay) {
                this.multiplierDisplay.textContent = '1.00x';
                this.multiplierDisplay.className = 'aviator-multiplier-val waiting';
            }
            if (elapsed >= this.waitingDuration) {
                this.startFlight();
            }
        } else if (this.state === 'FLYING') {
            const elapsed = (now - this.startTime) / 1000; // in seconds
            // Multiplier curve: starts gentle, accelerates exponentially
            this.multiplier = +(1.00 + 0.08 * Math.pow(elapsed, 1.45) + 0.02 * elapsed).toFixed(2);

            window.soundEngine.updateAviatorFlightPitch(this.multiplier);

            if (this.multiplierDisplay) {
                this.multiplierDisplay.textContent = `${this.multiplier.toFixed(2)}x`;
                if (this.multiplier < 2.00) {
                    this.multiplierDisplay.className = 'aviator-multiplier-val low';
                } else if (this.multiplier < 10.00) {
                    this.multiplierDisplay.className = 'aviator-multiplier-val mid';
                } else {
                    this.multiplierDisplay.className = 'aviator-multiplier-val high';
                }
            }

            // Check Auto Cashouts for panels
            this.panels.forEach((p, idx) => {
                if (p.hasBet && !p.cashedOut && p.autoCashout && this.multiplier >= p.autoCashoutVal) {
                    this.cashOutPanel(idx + 1);
                }
                this.updatePanelUI(idx + 1);
            });

            this.updateSimulatedPlayers();

            // Check Crash
            if (this.multiplier >= this.crashPoint) {
                this.crash();
            }
        } else if (this.state === 'CRASHED') {
            this.flewAwayOffset += 18;
        }

        // Particle update
        this.updateParticles();
    }

    updateParticles() {
        if (this.state === 'FLYING') {
            // Spawn smoke particles behind plane
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    x: this.planeX - 10,
                    y: this.planeY + (Math.random() * 8 - 4),
                    vx: -2 - Math.random() * 2,
                    vy: (Math.random() - 0.5) * 1.5,
                    size: 4 + Math.random() * 6,
                    alpha: 0.7,
                    color: Math.random() > 0.5 ? '#f43f5e' : '#fb923c'
                });
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.025;
            p.size += 0.3;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / window.devicePixelRatio;
        const h = this.canvas.height / window.devicePixelRatio;

        this.ctx.clearRect(0, 0, w, h);

        // Background radar grid lines
        this.drawGrid(w, h);

        if (this.state === 'FLYING' || this.state === 'CRASHED') {
            this.drawFlightPath(w, h);
            this.drawPlane(w, h);
        } else {
            // Idle docked plane
            this.planeX = 65;
            this.planeY = h - 60;
            this.drawPlane(w, h);
        }

        // Draw smoke particles
        this.drawParticles();
    }

    drawGrid(w, h) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        this.ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        // Horizontal lines
        const ySteps = 5;
        for (let i = 1; i < ySteps; i++) {
            const y = (h / ySteps) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        }

        // Vertical lines
        const xSteps = 7;
        for (let i = 1; i < xSteps; i++) {
            const x = (w / xSteps) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }
    }

    drawFlightPath(w, h) {
        const startX = 40;
        const startY = h - 50;

        // Compute plane position based on progress
        const maxMult = Math.max(3.0, this.crashPoint);
        const progress = Math.min(1.0, (this.multiplier - 1.0) / (maxMult - 0.5));

        const targetX = startX + (w - 140) * Math.min(1, progress * 1.15);
        // Exponential curve
        const curveFactor = Math.pow(Math.min(1, progress), 1.8);
        const targetY = startY - (h - 120) * curveFactor;

        this.planeX = targetX;
        this.planeY = targetY;

        // Build curve control point
        const cpX = startX + (targetX - startX) * 0.65;
        const cpY = startY;

        // Fill area under curve
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const grad = this.ctx.createLinearGradient(0, targetY, 0, h);
        grad.addColorStop(0, isLight ? 'rgba(225, 29, 72, 0.14)' : 'rgba(244, 63, 94, 0.28)');
        grad.addColorStop(1, 'rgba(225, 29, 72, 0.0)');

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(cpX, cpY, targetX, targetY);
        this.ctx.lineTo(targetX, h - 30);
        this.ctx.lineTo(startX, h - 30);
        this.ctx.closePath();
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        // Stroke clean trajectory line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(cpX, cpY, targetX, targetY);
        this.ctx.strokeStyle = '#e11d48';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }

    drawPlane(w, h) {
        this.ctx.save();
        
        let posX = this.planeX;
        let posY = this.planeY;

        if (this.state === 'CRASHED') {
            posX += this.flewAwayOffset * 1.5;
            posY -= this.flewAwayOffset * 0.8;
        }

        this.ctx.translate(posX, posY);

        // Rotation angle based on curve tangent
        const angle = this.state === 'WAITING' ? 0 : -0.22;
        this.ctx.rotate(angle);

        // Draw custom sleek Red & White Aviator Plane
        // Fuselage
        this.ctx.fillStyle = '#e11d48'; // Rich Crimson Red
        this.ctx.beginPath();
        this.ctx.moveTo(25, 0); // nose
        this.ctx.quadraticCurveTo(0, -9, -32, -6); // upper fuselage
        this.ctx.lineTo(-40, -18); // tail fin tip
        this.ctx.lineTo(-44, -18);
        this.ctx.lineTo(-38, 2);
        this.ctx.quadraticCurveTo(0, 8, 25, 0); // lower belly
        this.ctx.closePath();
        this.ctx.fill();

        // Cockpit window
        this.ctx.fillStyle = '#38bdf8'; // Cyan glass
        this.ctx.beginPath();
        this.ctx.moveTo(10, -5);
        this.ctx.quadraticCurveTo(18, -3, 20, 0);
        this.ctx.lineTo(6, 0);
        this.ctx.closePath();
        this.ctx.fill();

        // Main wing
        this.ctx.fillStyle = '#be123c';
        this.ctx.beginPath();
        this.ctx.moveTo(-2, 0);
        this.ctx.lineTo(-14, 16);
        this.ctx.lineTo(-24, 16);
        this.ctx.lineTo(-12, 0);
        this.ctx.closePath();
        this.ctx.fill();

        // Propeller at the front nose
        this.propellerAngle += 0.45;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(26, 0, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Spinning blades with motion blur effect
        this.ctx.save();
        this.ctx.translate(26, 0);
        this.ctx.rotate(this.propellerAngle);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.fillRect(-1.5, -12, 3, 24);
        this.ctx.restore();

        this.ctx.restore();
    }

    drawParticles() {
        this.ctx.save();
        for (const p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }
}

window.AviatorGame = AviatorGame;
