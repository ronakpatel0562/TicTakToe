// Plinko Multiplier Game Physics Engine & Stake.com Autobet System
class PlinkoGame {
    constructor() {
        this.canvas = document.getElementById('plinko-canvas');
        this.ctx = null;
        this.dropBtn = document.getElementById('plinko-drop-btn');
        this.betInput = document.getElementById('plinko-bet-input');
        this.riskSelect = document.getElementById('plinko-risk-select');
        this.bucketsContainer = document.getElementById('plinko-buckets-row');

        this.rows = 8;
        this.pegs = [];
        this.balls = [];
        this.buckets = [];
        this.betAmount = 10;
        this.risk = 'medium';

        // Autobet properties
        this.currentMode = 'manual';
        this.autobetEngine = null;
        this.autobetInterval = null;
        this.autobetDropsDispatched = 0;

        // Calibrated authentic 10% House Edge (90% RTP) Plinko Multipliers
        this.multipliers = {
            low: [5.6, 2.0, 1.1, 0.7, 0.7, 0.7, 1.1, 2.0, 5.6],   // 90.7% RTP
            medium: [13, 3.0, 1.3, 0.5, 0.4, 0.5, 1.3, 3.0, 13],  // 90.16% RTP
            high: [29, 4.0, 1.1, 0.3, 0.2, 0.3, 1.1, 4.0, 29]     // 90.31% RTP
        };

        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.resizeCanvas();
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.initPegs();
        });

        this.initPegs();
        this.renderBuckets();
        this.bindEvents();
        this.initAutobet();
        this.loop();
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    initPegs() {
        if (!this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        this.pegs = [];
        const startY = 45;
        const spacingY = (h - 90) / (this.rows + 1);

        for (let r = 0; r < this.rows; r++) {
            const count = r + 3;
            const spacingX = Math.min(36, (w - 60) / (this.rows + 2));
            const startX = (w - (count - 1) * spacingX) / 2;

            for (let c = 0; c < count; c++) {
                this.pegs.push({
                    x: startX + c * spacingX,
                    y: startY + r * spacingY,
                    r: 4
                });
            }
        }
    }

    renderBuckets() {
        if (!this.bucketsContainer) return;
        const list = this.multipliers[this.risk] || this.multipliers.medium;
        this.bucketsContainer.innerHTML = list.map((m, idx) => {
            let cls = '';
            if (m === 0) cls = 'zero-bucket';
            else if (m < 1.0) cls = 'sub-one-bucket';
            else if (m >= 3.0) cls = 'high-bucket';
            return `
                <div class="plinko-bucket ${cls}" id="plinko-b-${idx}" data-idx="${idx}">
                    ${m + 'x'}
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        if (this.dropBtn) {
            this.dropBtn.addEventListener('click', () => {
                this.dropBall();
            });
        }

        if (this.betInput) {
            this.betInput.addEventListener('change', (e) => {
                let v = parseFloat(e.target.value);
                if (isNaN(v) || v < 1) v = 1;
                this.betAmount = v;
                e.target.value = v;
            });
        }

        if (this.riskSelect) {
            this.riskSelect.addEventListener('change', (e) => {
                this.risk = e.target.value;
                this.renderBuckets();
            });
        }

        const chips = document.querySelectorAll('.plinko-chip-btn');
        chips.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.soundEngine) window.soundEngine.playClick();
                chips.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.betAmount = parseFloat(btn.dataset.amount);
                if (this.betInput) this.betInput.value = this.betAmount;
            });
        });
    }

    initAutobet() {
        // Tab switcher
        const tabBtns = document.querySelectorAll('#plinko-tabs .stake-tab-btn');
        const manualBox = document.getElementById('plinko-manual-controls');
        const autoBox = document.getElementById('plinko-auto-controls');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                if (window.soundEngine) window.soundEngine.playClick();
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMode = btn.dataset.tab;

                if (this.currentMode === 'auto') {
                    if (manualBox) manualBox.style.display = 'none';
                    if (autoBox) autoBox.style.display = 'flex';
                } else {
                    if (manualBox) manualBox.style.display = 'block';
                    if (autoBox) autoBox.style.display = 'none';
                }
            });
        });

        // Auto Halve & Double
        const halfBtn = document.getElementById('plinko-auto-half');
        const doubleBtn = document.getElementById('plinko-auto-double');
        const autoBetInput = document.getElementById('plinko-auto-bet-input');

        if (halfBtn && autoBetInput) {
            halfBtn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                let v = parseFloat(autoBetInput.value) || 10;
                v = Math.max(1, Math.floor(v / 2));
                autoBetInput.value = v;
            });
        }
        if (doubleBtn && autoBetInput) {
            doubleBtn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                let v = parseFloat(autoBetInput.value) || 10;
                autoBetInput.value = v * 2;
            });
        }

        // Auto Risk Selector
        const autoRiskSelect = document.getElementById('plinko-auto-risk-select');
        if (autoRiskSelect) {
            autoRiskSelect.addEventListener('change', (e) => {
                this.risk = e.target.value;
                if (this.riskSelect) this.riskSelect.value = this.risk;
                this.renderBuckets();
            });
        }

        // Auto Presets for Number of Bets
        const presetBtns = document.querySelectorAll('#plinko-auto-presets .stake-pill-btn');
        const totalBetsInput = document.getElementById('plinko-auto-total-bets');
        const infLabel = document.getElementById('plinko-auto-inf-label');

        presetBtns.forEach(p => {
            p.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                if (window.soundEngine) window.soundEngine.playClick();
                presetBtns.forEach(b => b.classList.remove('active'));
                p.classList.add('active');
                const val = parseInt(p.dataset.val, 10);
                if (totalBetsInput) totalBetsInput.value = val;
                if (infLabel) infLabel.textContent = val === 0 ? '∞' : val;
            });
        });

        if (totalBetsInput) {
            totalBetsInput.addEventListener('input', () => {
                const val = parseInt(totalBetsInput.value, 10) || 0;
                if (infLabel) infLabel.textContent = val === 0 ? '∞' : val;
            });
        }

        // On Win / On Loss toggles
        this.bindSegmentedToggle('plinko-onwin-toggle', 'plinko-onwin-pct-wrap');
        this.bindSegmentedToggle('plinko-onloss-toggle', 'plinko-onloss-pct-wrap');

        // Start / Stop Autobet Button
        const autobetBtn = document.getElementById('plinko-autobet-btn');
        if (autobetBtn) {
            autobetBtn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) {
                    this.stopAutobet('User stopped autobet');
                } else {
                    this.startAutobet();
                }
            });
        }
    }

    bindSegmentedToggle(containerId, pctWrapId) {
        const container = document.getElementById(containerId);
        const pctWrap = document.getElementById(pctWrapId);
        if (!container) return;

        const btns = container.querySelectorAll('.stake-segment-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const action = btn.dataset.action;
                if (pctWrap) {
                    pctWrap.style.display = action === 'increase' ? 'flex' : 'none';
                }
            });
        });
    }

    startAutobet() {
        const autoBetInput = document.getElementById('plinko-auto-bet-input');
        const autoRiskSelect = document.getElementById('plinko-auto-risk-select');
        const totalBetsInput = document.getElementById('plinko-auto-total-bets');
        const onWinBtn = document.querySelector('#plinko-onwin-toggle .stake-segment-btn.active');
        const onWinPctInput = document.getElementById('plinko-onwin-pct-input');
        const onLossBtn = document.querySelector('#plinko-onloss-toggle .stake-segment-btn.active');
        const onLossPctInput = document.getElementById('plinko-onloss-pct-input');
        const stopProfitInput = document.getElementById('plinko-auto-stop-profit');
        const stopLossInput = document.getElementById('plinko-auto-stop-loss');

        const baseBet = Math.max(1, parseFloat(autoBetInput ? autoBetInput.value : 10) || 10);
        if (autoRiskSelect) this.risk = autoRiskSelect.value;
        this.renderBuckets();

        const totalBets = parseInt(totalBetsInput ? totalBetsInput.value : 10, 10) || 0;
        const onWinAction = onWinBtn ? onWinBtn.dataset.action : 'reset';
        const onWinPercent = parseFloat(onWinPctInput ? onWinPctInput.value : 100) || 100;
        const onLossAction = onLossBtn ? onLossBtn.dataset.action : 'reset';
        const onLossPercent = parseFloat(onLossPctInput ? onLossPctInput.value : 100) || 100;
        const stopOnProfit = parseFloat(stopProfitInput ? stopProfitInput.value : 0) || 0;
        const stopOnLoss = parseFloat(stopLossInput ? stopLossInput.value : 0) || 0;

        if (window.arcadeWallet && window.arcadeWallet.getBalance() < baseBet) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Please deposit funds to start Autobet.', 'warning');
            if (window.paymentGateway) window.paymentGateway.open(baseBet * 5);
            return;
        }

        this.autobetDropsDispatched = 0;
        this.autobetEngine = new window.StakeAutobetEngine({
            baseBet,
            totalBets,
            onWinAction,
            onWinPercent,
            onLossAction,
            onLossPercent,
            stopOnProfit,
            stopOnLoss,
            onStart: () => {
                this.updateAutobetButtonUI(true);
            },
            onStop: (reason) => {
                this.updateAutobetButtonUI(false);
                if (window.showToast) window.showToast('Autobet Stopped', reason, 'info');
            },
            onUpdate: (state) => {
                this.updateAutobetLiveStats(state);
            }
        });

        this.autobetEngine.start();

        // Dispatch initial drop immediately, then rhythmic drops every 400ms
        this.dispatchAutoDrop();
        this.autobetInterval = setInterval(() => {
            if (!this.autobetEngine || !this.autobetEngine.isRunning) {
                clearInterval(this.autobetInterval);
                this.autobetInterval = null;
                return;
            }

            // If totalBets is set and we've already dispatched all balls, wait for them to land
            if (this.autobetEngine.totalBets > 0 && this.autobetDropsDispatched >= this.autobetEngine.totalBets) {
                clearInterval(this.autobetInterval);
                this.autobetInterval = null;
                return;
            }

            this.dispatchAutoDrop();
        }, 400);
    }

    dispatchAutoDrop() {
        if (!this.autobetEngine || !this.autobetEngine.isRunning) return;
        const currentBet = this.autobetEngine.currentBet;

        if (!window.arcadeWallet || !window.arcadeWallet.deduct(currentBet)) {
            this.stopAutobet('Insufficient balance for next ball');
            return;
        }

        this.autobetDropsDispatched++;
        if (window.soundEngine) {
            if (typeof window.soundEngine.playPlinkoDrop === 'function') {
                window.soundEngine.playPlinkoDrop();
            } else {
                if (window.soundEngine) window.soundEngine.playClick();
            }
        }

        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const startX = w / 2 + (Math.random() - 0.5) * 12;

        this.balls.push({
            x: startX,
            y: 15,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 0,
            r: 6,
            bet: currentBet,
            isAuto: true
        });
    }

    stopAutobet(reason) {
        if (this.autobetInterval) {
            clearInterval(this.autobetInterval);
            this.autobetInterval = null;
        }
        if (this.autobetEngine) {
            this.autobetEngine.stop(reason);
        }
        this.updateAutobetButtonUI(false);
    }

    updateAutobetButtonUI(running) {
        const btn = document.getElementById('plinko-autobet-btn');
        const statsPill = document.getElementById('plinko-auto-stats-pill');
        if (!btn) return;

        if (running) {
            btn.className = 'stake-autobet-btn stop';
            btn.innerHTML = `<span><i class="fa-solid fa-stop"></i> STOP AUTOBET</span><small>AUTO DROPS RUNNING</small>`;
            if (statsPill) statsPill.classList.add('active');
        } else {
            btn.className = 'stake-autobet-btn start';
            btn.innerHTML = `<span><i class="fa-solid fa-play"></i> START AUTOBET</span><small>AUTO PLINKO DROPS</small>`;
        }
    }

    updateAutobetLiveStats(state) {
        const betsEl = document.getElementById('plinko-auto-stat-bets');
        const profitEl = document.getElementById('plinko-auto-stat-profit');
        const autoBetInput = document.getElementById('plinko-auto-bet-input');

        if (autoBetInput) autoBetInput.value = state.currentBet;

        if (betsEl) {
            const tot = state.totalBets > 0 ? state.totalBets : '∞';
            betsEl.textContent = `Drop ${state.betsPlaced}/${tot}`;
        }
        if (profitEl) {
            const p = state.sessionNetProfit;
            const sign = p >= 0 ? '+' : '-';
            profitEl.textContent = `Net: ${sign}$${Math.abs(p).toFixed(2)}`;
            profitEl.className = `stats-profit ${p >= 0 ? 'positive' : 'negative'}`;
        }
    }

    dropBall() {
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(this.betAmount)) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Deposit funds to drop balls!', 'warning');
            if (window.paymentGateway) window.paymentGateway.open(this.betAmount * 5);
            return;
        }

        if (window.soundEngine) {
            if (typeof window.soundEngine.playPlinkoDrop === 'function') {
                window.soundEngine.playPlinkoDrop();
            } else {
                window.soundEngine.playClick();
            }
        }

        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const startX = w / 2 + (Math.random() - 0.5) * 12;

        this.balls.push({
            x: startX,
            y: 15,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 0,
            r: 6,
            bet: this.betAmount,
            isAuto: false
        });
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        if (!this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const gravity = 0.22;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            b.vy += gravity;
            b.x += b.vx;
            b.y += b.vy;

            // Peg collisions
            for (let peg of this.pegs) {
                const dx = b.x - peg.x;
                const dy = b.y - peg.y;
                const dist = Math.hypot(dx, dy);

                if (dist < b.r + peg.r) {
                    const angle = Math.atan2(dy, dx);
                    b.vx = Math.cos(angle) * 2.2 + (Math.random() - 0.5) * 0.4;
                    b.vy = Math.abs(Math.sin(angle)) * 2.0;

                    if (window.soundEngine) window.soundEngine.playBounce();
                }
            }

            // Bottom bounds / Bucket landing
            if (b.y > h - 25) {
                this.settleBall(b);
                this.balls.splice(i, 1);
            }
        }
    }

    settleBall(b) {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const multList = this.multipliers[this.risk] || this.multipliers.medium;
        const bucketWidth = w / multList.length;
        const bucketIdx = Math.min(multList.length - 1, Math.max(0, Math.floor(b.x / bucketWidth)));
        const mult = multList[bucketIdx];

        // Direct payout using authentic house-edged multiplier table (90% RTP)
        const winAmt = +(b.bet * mult).toFixed(2);
        if (window.arcadeWallet) {
            if (winAmt > 0) {
                window.arcadeWallet.add(winAmt);
            }
            if (window.arcadeWallet.stats && window.arcadeWallet.stats.plinko) {
                window.arcadeWallet.stats.plinko.totalDrops++;
                window.arcadeWallet.stats.plinko.totalWon += winAmt;
                if (winAmt > (window.arcadeWallet.stats.plinko.biggestWin || 0)) {
                    window.arcadeWallet.stats.plinko.biggestWin = winAmt;
                }
            }
        }

        // Highlight bucket
        const bEl = document.getElementById(`plinko-b-${bucketIdx}`);
        if (bEl) {
            if (mult === 0) {
                bEl.classList.add('zero-hit');
                setTimeout(() => bEl.classList.remove('zero-hit'), 350);
            } else {
                bEl.classList.add('hit');
                setTimeout(() => bEl.classList.remove('hit'), 250);
            }
        }

        // Handle Autobet Settlement
        if (this.autobetEngine && this.autobetEngine.isRunning && b.isAuto) {
            const won = mult > 1.0;
            this.autobetEngine.recordResult(won, winAmt, b.bet);
            if (mult === 0) {
                if (window.soundEngine && typeof window.soundEngine.playPlinkoLoss === 'function') {
                    window.soundEngine.playPlinkoLoss();
                }
            } else if (mult >= 2.0) {
                if (window.soundEngine && typeof window.soundEngine.playPlinkoWin === 'function') {
                    window.soundEngine.playPlinkoWin(mult);
                }
            }
        } else {
            // Manual mode toasts
            if (mult === 0) {
                if (window.soundEngine && typeof window.soundEngine.playPlinkoLoss === 'function') {
                    window.soundEngine.playPlinkoLoss();
                } else if (window.soundEngine) {
                    window.soundEngine.playLoss();
                }
                if (window.showToast) {
                    window.showToast('0x Zone — Loss', `Ball landed in 0x! -$${b.bet.toFixed(2)}`, 'error');
                }
            } else if (mult >= 2.0) {
                if (window.soundEngine && typeof window.soundEngine.playPlinkoWin === 'function') {
                    window.soundEngine.playPlinkoWin(mult);
                } else if (window.soundEngine) {
                    window.soundEngine.playWin();
                }
                if (mult >= 10.0 && window.triggerConfetti) window.triggerConfetti();
                if (window.showToast) {
                    window.showToast('🎉 Plinko Hit!', `Landed on ${mult}x! Won +$${winAmt.toFixed(2)}`, 'success');
                }
            } else if (mult < 1.0) {
                if (window.soundEngine) window.soundEngine.playBounce();
            } else {
                if (window.soundEngine) window.soundEngine.playClick();
            }
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        this.ctx.clearRect(0, 0, w, h);

        // Draw Pegs
        this.ctx.fillStyle = '#ffffff';
        for (let p of this.pegs) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw Balls
        this.ctx.fillStyle = '#ef4444';
        for (let b of this.balls) {
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

window.PlinkoGame = PlinkoGame;
