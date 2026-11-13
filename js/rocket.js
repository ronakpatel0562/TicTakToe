// Rocket Launch - Crash Multiplier Engine
class RocketGame {
    constructor() {
        this.canvas = document.getElementById('rocket-canvas');
        this.ctx = null;
        this.multiplierElem = document.getElementById('rocket-multiplier');
        this.statusBanner = document.getElementById('rocket-status-banner');
        this.historyBar = document.getElementById('rocket-history-chips');
        this.simBetsContainer = document.getElementById('rocket-sim-bets');

        // State
        this.state = 'WAITING'; // WAITING, FLYING, CRASHED
        this.multiplier = 1.00;
        this.crashMultiplier = 1.00;
        this.startTime = 0;
        this.waitingCountdown = 5.0;
        this.history = [1.42, 3.85, 1.12, 14.20, 2.15, 6.40, 1.05, 4.22, 18.50, 1.95];

        // Dual Bet Panels
        this.panels = [
            { betAmount: 10, autoCashout: 2.00, hasBet: false, cashedOut: false, cashoutMultiplier: 0 },
            { betAmount: 20, autoCashout: 1.50, hasBet: false, cashedOut: false, cashoutMultiplier: 0 }
        ];

        // Stars & Particles
        this.stars = [];
        this.exhaust = [];
        this.rocketX = 0;
        this.rocketY = 0;

        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.initStars();
        this.bindPanelEvents(1);
        this.bindPanelEvents(2);
        this.renderHistory();

        this.startWaitingRound();
        this.animationLoop();
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 70; i++) {
            this.stars.push({
                x: Math.random() * (this.canvas ? this.canvas.width : 400),
                y: Math.random() * (this.canvas ? this.canvas.height : 300),
                speed: 0.5 + Math.random() * 2,
                size: 1 + Math.random() * 2
            });
        }
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
        const input = document.getElementById(`rocket-bet-amount-${panelId}`);
        const actionBtn = document.getElementById(`rocket-action-btn-${panelId}`);
        const autoCheck = document.getElementById(`rocket-auto-check-${panelId}`);
        const autoVal = document.getElementById(`rocket-auto-val-${panelId}`);

        if (input) {
            input.addEventListener('change', (e) => {
                let v = parseFloat(e.target.value);
                if (isNaN(v) || v < 1) v = 1;
                p.betAmount = v;
                e.target.value = v;
                this.updatePanelUI(panelId);
            });
        }

        const quickButtons = document.querySelectorAll(`.rocket-quick-${panelId}`);
        quickButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                window.soundEngine.playClick();
                const act = btn.dataset.action;
                if (act === 'half') p.betAmount = Math.max(1, Math.floor(p.betAmount / 2));
                else if (act === '2x') p.betAmount = p.betAmount * 2;
                else p.betAmount = parseFloat(act);

                if (input) input.value = p.betAmount;
                this.updatePanelUI(panelId);
            });
        });

        if (autoCheck && autoVal) {
            autoCheck.addEventListener('change', (e) => {
                autoVal.disabled = !e.target.checked;
            });
            autoVal.addEventListener('change', (e) => {
                let v = parseFloat(e.target.value);
                if (isNaN(v) || v < 1.05) v = 1.05;
                p.autoCashout = v;
                e.target.value = v.toFixed(2);
            });
        }

        if (actionBtn) {
            actionBtn.addEventListener('click', () => {
                if (this.state === 'WAITING') {
                    if (!p.hasBet) {
                        if (window.arcadeWallet && window.arcadeWallet.deduct(p.betAmount)) {
                            p.hasBet = true;
                            p.cashedOut = false;
                            window.soundEngine.playClick();
                            this.updatePanelUI(panelId);
                        } else {
                            if (window.showToast) window.showToast('Insufficient Balance', 'Opening Payment Gateway...', 'warning');
                            if (window.paymentGateway) window.paymentGateway.open(p.betAmount * 5);
                        }
                    } else {
                        // Cancel bet
                        if (window.arcadeWallet) window.arcadeWallet.add(p.betAmount);
                        p.hasBet = false;
                        window.soundEngine.playClick();
                        this.updatePanelUI(panelId);
                    }
                } else if (this.state === 'FLYING' && p.hasBet && !p.cashedOut) {
                    this.cashOut(panelId);
                }
            });
        }
    }

    cashOut(panelId) {
        const p = this.panels[panelId - 1];
        if (p.hasBet && !p.cashedOut && this.state === 'FLYING') {
            p.cashedOut = true;
            p.cashoutMultiplier = this.multiplier;
            const winAmount = p.betAmount * this.multiplier;

            if (window.arcadeWallet) {
                window.arcadeWallet.add(winAmount);
                if (window.arcadeWallet.stats && window.arcadeWallet.stats.rocket) {
                    window.arcadeWallet.stats.rocket.totalWon += winAmount;
                    if (winAmount > (window.arcadeWallet.stats.rocket.biggestWin || 0)) {
                        window.arcadeWallet.stats.rocket.biggestWin = winAmount;
                    }
                }
            }

            if (window.soundEngine) window.soundEngine.playAviatorCashout();
            if (window.showToast) {
                window.showToast('ROCKET CASHOUT! 🚀', `Cashed out at ${this.multiplier.toFixed(2)}x (+$${winAmount.toFixed(2)})`, 'success');
            }

            this.updatePanelUI(panelId);
        }
    }

    startWaitingRound() {
        this.state = 'WAITING';
        this.waitingCountdown = 5.0;
        this.multiplier = 1.00;
        this.exhaust = [];

        // Determine crash multiplier: realistic weighted curve
        const r = Math.random();
        if (r < 0.08) this.crashMultiplier = 1.00;
        else if (r < 0.50) this.crashMultiplier = parseFloat((1.05 + Math.random() * 1.5).toFixed(2));
        else if (r < 0.85) this.crashMultiplier = parseFloat((2.00 + Math.random() * 4.5).toFixed(2));
        else if (r < 0.96) this.crashMultiplier = parseFloat((6.50 + Math.random() * 10.0).toFixed(2));
        else this.crashMultiplier = parseFloat((15.00 + Math.random() * 35.0).toFixed(2));

        if (this.multiplierElem) {
            this.multiplierElem.className = 'rocket-multiplier-val waiting';
            this.multiplierElem.textContent = '1.00x';
        }

        this.panels.forEach((p, idx) => {
            p.cashedOut = false;
            p.cashoutMultiplier = 0;
            this.updatePanelUI(idx + 1);
        });

        this.renderSimulatedBets();
    }

    startFlyingRound() {
        this.state = 'FLYING';
        this.startTime = performance.now();

        if (this.statusBanner) this.statusBanner.textContent = 'ROCKET ASCENDING';

        this.panels.forEach((p, idx) => {
            if (p.hasBet) {
                if (window.arcadeWallet && window.arcadeWallet.stats && window.arcadeWallet.stats.rocket) {
                    window.arcadeWallet.stats.rocket.totalBets++;
                }
            }
            this.updatePanelUI(idx + 1);
        });
    }

    handleCrash() {
        this.state = 'CRASHED';

        if (this.multiplierElem) {
            this.multiplierElem.className = 'rocket-multiplier-val crashed';
            this.multiplierElem.textContent = `${this.multiplier.toFixed(2)}x CRASHED`;
        }

        if (this.statusBanner) this.statusBanner.textContent = `EXPLODED AT ${this.multiplier.toFixed(2)}x`;
        if (window.soundEngine) window.soundEngine.playAviatorCrash();

        this.panels.forEach((p, idx) => {
            p.hasBet = false;
            this.updatePanelUI(idx + 1);
        });

        this.history.unshift(this.multiplier);
        if (this.history.length > 20) this.history.pop();
        this.renderHistory();

        setTimeout(() => {
            this.startWaitingRound();
        }, 3200);
    }

    updatePanelUI(panelId) {
        const p = this.panels[panelId - 1];
        const actionBtn = document.getElementById(`rocket-action-btn-${panelId}`);
        if (!actionBtn) return;

        if (this.state === 'WAITING') {
            if (p.hasBet) {
                actionBtn.className = 'rocket-btn waiting-btn';
                actionBtn.innerHTML = `<span>CANCEL</span><small>$${p.betAmount.toFixed(2)}</small>`;
            } else {
                actionBtn.className = 'rocket-btn bet-btn';
                actionBtn.innerHTML = `<span>LAUNCH</span><small>$${p.betAmount.toFixed(2)}</small>`;
            }
        } else if (this.state === 'FLYING') {
            if (p.hasBet && !p.cashedOut) {
                const currentWin = (p.betAmount * this.multiplier).toFixed(2);
                actionBtn.className = 'rocket-btn cashout-btn';
                actionBtn.innerHTML = `<span>CASHOUT</span><small>$${currentWin}</small>`;
            } else if (p.cashedOut) {
                actionBtn.className = 'rocket-btn waiting-btn';
                actionBtn.innerHTML = `<span>CASHED OUT</span><small>${p.cashoutMultiplier.toFixed(2)}x</small>`;
            } else {
                actionBtn.className = 'rocket-btn waiting-btn';
                actionBtn.innerHTML = `<span>IN FLIGHT</span><small>Wait Round</small>`;
            }
        } else {
            actionBtn.className = 'rocket-btn waiting-btn';
            actionBtn.innerHTML = `<span>ROUND OVER</span><small>--</small>`;
        }
    }

    animationLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animationLoop());
    }

    update() {
        if (this.state === 'WAITING') {
            this.waitingCountdown -= 0.016;
            if (this.statusBanner) {
                this.statusBanner.textContent = `NEXT LAUNCH IN ${Math.max(0, this.waitingCountdown).toFixed(1)}s`;
            }
            if (this.waitingCountdown <= 0) {
                this.startFlyingRound();
            }
        } else if (this.state === 'FLYING') {
            const elapsed = (performance.now() - this.startTime) / 1000;
            this.multiplier = parseFloat((1.00 + Math.pow(elapsed * 0.45, 1.9)).toFixed(2));

            if (this.multiplierElem) {
                this.multiplierElem.textContent = `${this.multiplier.toFixed(2)}x`;
            }

            // Auto cashout checks
            this.panels.forEach((p, idx) => {
                const autoCheck = document.getElementById(`rocket-auto-check-${idx + 1}`);
                if (p.hasBet && !p.cashedOut && autoCheck && autoCheck.checked) {
                    if (this.multiplier >= p.autoCashout) {
                        this.cashOut(idx + 1);
                    }
                }
            });

            if (this.multiplier >= this.crashMultiplier) {
                this.multiplier = this.crashMultiplier;
                this.handleCrash();
            }
        }

        // Update stars
        if (this.canvas) {
            const w = this.canvas.width / (window.devicePixelRatio || 1);
            const h = this.canvas.height / (window.devicePixelRatio || 1);
            const speedMult = this.state === 'FLYING' ? 3.5 : 1;

            this.stars.forEach(s => {
                s.y += s.speed * speedMult;
                if (s.y > h) {
                    s.y = 0;
                    s.x = Math.random() * w;
                }
            });
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        this.ctx.clearRect(0, 0, w, h);

        // Draw stars
        this.ctx.fillStyle = '#ffffff';
        this.stars.forEach(s => {
            this.ctx.globalAlpha = 0.3 + Math.random() * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // Draw Flight Trajectory curve
        if (this.state === 'FLYING' || this.state === 'CRASHED') {
            const progress = Math.min(1, (this.multiplier - 1) / Math.max(1, this.crashMultiplier - 1));
            const startX = 40;
            const startY = h - 40;
            const endX = startX + (w - 120) * Math.min(1, progress * 1.2);
            const endY = startY - (h - 100) * Math.min(1, progress * 1.1);

            this.rocketX = endX;
            this.rocketY = endY;

            // Gradient curve
            const grad = this.ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
            grad.addColorStop(1, this.state === 'CRASHED' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.9)');

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.quadraticCurveTo(startX + (endX - startX) * 0.4, startY, endX, endY);
            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Rocket icon
            if (this.state === 'FLYING') {
                this.ctx.save();
                this.ctx.translate(endX, endY);
                this.ctx.rotate(Math.PI / 4);

                // Rocket Body
                this.ctx.fillStyle = '#f8fafc';
                this.ctx.beginPath();
                this.ctx.moveTo(0, -18);
                this.ctx.lineTo(8, 10);
                this.ctx.lineTo(-8, 10);
                this.ctx.closePath();
                this.ctx.fill();

                // Fins
                this.ctx.fillStyle = '#ef4444';
                this.ctx.fillRect(-12, 4, 4, 8);
                this.ctx.fillRect(8, 4, 4, 8);

                // Flame
                this.ctx.fillStyle = '#f59e0b';
                this.ctx.beginPath();
                this.ctx.moveTo(-5, 10);
                this.ctx.lineTo(0, 18 + Math.random() * 8);
                this.ctx.lineTo(5, 10);
                this.ctx.fill();

                this.ctx.restore();
            }
        }
    }

    renderHistory() {
        if (!this.historyBar) return;
        this.historyBar.innerHTML = this.history.map(m => {
            const cls = m < 2.0 ? 'low' : (m < 10.0 ? 'mid' : 'high');
            return `<span class="rocket-chip ${cls}">${m.toFixed(2)}x</span>`;
        }).join('');
    }

    renderSimulatedBets() {
        if (!this.simBetsContainer) return;
        const users = ['Apex_9', 'FalconX', 'CosmoRider', 'Nova7', 'Orbit_King', 'Stellar', 'Zara_Moon'];
        this.simBetsContainer.innerHTML = users.map(u => {
            const amt = [10, 25, 50, 100, 250][Math.floor(Math.random() * 5)];
            return `
                <div style="display:flex; justify-content:space-between; padding:0.4rem 0.6rem; background:var(--bg-surface-elevated); border-radius:4px; font-size:0.8rem; margin-bottom:4px;">
                    <span><i class="fa-solid fa-user-astronaut text-accent"></i> ${u}</span>
                    <strong>$${amt}</strong>
                </div>
            `;
        }).join('');
    }
}

window.RocketGame = RocketGame;

