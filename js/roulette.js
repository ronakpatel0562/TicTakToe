// Roulette Royale - Live Multiplayer European Roulette Game Engine
class RouletteGame {
    constructor() {
        this.canvas = document.getElementById('roulette-canvas');
        this.ctx = null;
        this.timerEl = document.getElementById('roulette-timer');
        this.periodEl = document.getElementById('roulette-period');
        this.historyBar = document.getElementById('roulette-history-chips');
        this.simBetsContainer = document.getElementById('roulette-sim-bets');
        this.resultNumEl = document.getElementById('roulette-result-num');
        this.resultDescEl = document.getElementById('roulette-result-desc');
        this.lockOverlay = document.getElementById('roulette-lock-overlay');
        this.lockCountdown = document.getElementById('roulette-lock-sec');
        this.spinBtn = document.getElementById('roulette-spin-btn');
        this.clearBtn = document.getElementById('roulette-clear-btn');
        this.betSummaryEl = document.getElementById('roulette-bet-summary');

        // European Wheel Layout: 37 pockets (0 to 36)
        this.wheelNumbers = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];

        this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

        // State
        this.roundTime = 25;
        this.timeLeft = 25;
        this.periodId = 1001;
        this.roundTimer = null;
        this.isSpinning = false;
        this.selectedChip = 10;
        this.playerBets = []; // { type: 'num'|'color'|'parity'|'range'|'dozen', val: ..., amount: ... }

        // Wheel Physics
        this.wheelAngle = 0;
        this.ballAngle = 0;
        this.ballRadius = 0;
        this.winningNumber = 0;
        this.history = [0, 32, 15, 19, 4, 21, 2, 25, 0, 17];

        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.renderHistory();
        this.bindEvents();
        this.startCountdown();
        this.animateWheel();
        this.populateSimBets();
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(rect.width, rect.height || 320);
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    getColor(num) {
        if (num === 0) return 'zero';
        return this.redNumbers.includes(num) ? 'red' : 'black';
    }

    renderHistory() {
        if (!this.historyBar) return;
        this.historyBar.innerHTML = this.history.map(num => {
            const color = this.getColor(num);
            return `<div class="roulette-chip ${color}">${num}</div>`;
        }).join('');
    }

    bindEvents() {
        // Chip selector buttons
        const chipBtns = document.querySelectorAll('.roulette-chip-selector');
        chipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.soundEngine) window.soundEngine.playClick();
                chipBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedChip = parseFloat(btn.dataset.val);
            });
        });

        // Green Zero cell
        const zeroCell = document.querySelector('.roulette-zero-cell');
        if (zeroCell) {
            zeroCell.addEventListener('click', () => this.placeBet('num', 0, zeroCell));
        }

        // Inside Number cells (1 to 36)
        const numCells = document.querySelectorAll('.roulette-num-cell');
        numCells.forEach(cell => {
            cell.addEventListener('click', () => {
                const num = parseInt(cell.dataset.num, 10);
                this.placeBet('num', num, cell);
            });
        });

        // Outside Bets
        const outsideBtns = document.querySelectorAll('.roulette-outside-btn');
        outsideBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const val = btn.dataset.val;
                this.placeBet(type, val, btn);
            });
        });

        // Clear bets
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                if (this.isSpinning || this.timeLeft <= 5) return;
                this.clearBets();
            });
        }
    }

    placeBet(type, val, element) {
        if (this.isSpinning || this.timeLeft <= 5) {
            if (window.showToast) window.showToast('Bets Locked', 'Wheel is spinning! Wait for next round.', 'warning');
            return;
        }

        // Check wallet
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(this.selectedChip)) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Please add funds to place bets!', 'warning');
            if (window.paymentGateway) window.paymentGateway.open(this.selectedChip * 5);
            return;
        }

        if (window.soundEngine) window.soundEngine.playClick();

        this.playerBets.push({
            type,
            val,
            amount: this.selectedChip
        });

        if (element) {
            element.classList.add('selected');
        }

        this.updateBetSummary();
    }

    clearBets() {
        if (this.playerBets.length === 0) return;
        const refund = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
        if (window.arcadeWallet) window.arcadeWallet.add(refund);

        this.playerBets = [];
        document.querySelectorAll('.roulette-zero-cell, .roulette-num-cell, .roulette-outside-btn').forEach(el => {
            el.classList.remove('selected');
        });

        this.updateBetSummary();
        if (window.soundEngine) window.soundEngine.playClick();
    }

    updateBetSummary() {
        if (!this.betSummaryEl) return;
        const total = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
        this.betSummaryEl.textContent = `Total Staked: $${total.toFixed(2)} (${this.playerBets.length} Bet${this.playerBets.length === 1 ? '' : 's'})`;
    }

    startCountdown() {
        if (this.roundTimer) clearInterval(this.roundTimer);
        this.timeLeft = this.roundTime;
        if (this.periodEl) this.periodEl.textContent = `#ROU${this.periodId}`;

        this.roundTimer = setInterval(() => {
            this.timeLeft--;

            if (this.timerEl) {
                this.timerEl.textContent = `00:${this.timeLeft < 10 ? '0' : ''}${this.timeLeft}`;
                this.timerEl.classList.toggle('warning', this.timeLeft <= 5);
            }

            // Lock overlay at 5s
            if (this.timeLeft <= 5 && this.timeLeft > 0) {
                if (this.lockOverlay) this.lockOverlay.classList.add('active');
                if (this.lockCountdown) this.lockCountdown.textContent = this.timeLeft;
            }

            if (this.timeLeft === 5) {
                this.spinWheel();
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.roundTimer);
            }
        }, 1000);
    }

    spinWheel() {
        this.isSpinning = true;
        // Select random winning pocket (0 to 36)
        this.winningNumber = Math.floor(Math.random() * 37);

        const pocketIndex = this.wheelNumbers.indexOf(this.winningNumber);
        const pocketAngle = (pocketIndex / 37) * Math.PI * 2;

        // Animate spin with deceleration
        const startWheelAngle = this.wheelAngle;
        const totalSpins = 5 + Math.random() * 2;
        const targetWheelAngle = startWheelAngle + totalSpins * Math.PI * 2 + (Math.PI * 1.5 - pocketAngle);

        const duration = 4800; // ms
        const startTime = performance.now();

        if (window.soundEngine) {
            window.soundEngine.playAviatorTakeoff();
        }

        const spinAnim = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);
            // Cubic ease out
            const easeOut = 1 - Math.pow(1 - progress, 3);

            this.wheelAngle = startWheelAngle + (targetWheelAngle - startWheelAngle) * easeOut;
            this.ballAngle = targetWheelAngle * (1 - easeOut * 0.4);

            if (progress < 1) {
                requestAnimationFrame(spinAnim);
            } else {
                this.settleRound();
            }
        };

        requestAnimationFrame(spinAnim);
    }

    settleRound() {
        this.isSpinning = false;
        if (this.lockOverlay) this.lockOverlay.classList.remove('active');

        const winNum = this.winningNumber;
        const winColor = this.getColor(winNum);

        // Update result display
        if (this.resultNumEl) {
            this.resultNumEl.className = `roulette-result-num ${winColor}`;
            this.resultNumEl.textContent = winNum;
        }
        if (this.resultDescEl) {
            const colorName = winNum === 0 ? 'ZERO (GREEN)' : (winColor === 'red' ? 'RED' : 'BLACK');
            this.resultDescEl.textContent = `${colorName} • ${winNum % 2 === 0 && winNum !== 0 ? 'EVEN' : (winNum !== 0 ? 'ODD' : 'NEITHER')}`;
        }

        // Add to history
        this.history.unshift(winNum);
        if (this.history.length > 12) this.history.pop();
        this.renderHistory();

        // Calculate Payouts
        let totalPayout = 0;
        let anyWon = false;

        this.playerBets.forEach(bet => {
            let won = false;
            let mult = 0;

            if (bet.type === 'num') {
                if (bet.val === winNum) {
                    won = true;
                    mult = 36.0; // Straight up 36x payout
                }
            } else if (winNum !== 0) { // Green 0 beats all outside bets!
                if (bet.type === 'color') {
                    if (bet.val === winColor) { won = true; mult = 2.0; }
                } else if (bet.type === 'parity') {
                    if (bet.val === 'even' && winNum % 2 === 0) { won = true; mult = 2.0; }
                    if (bet.val === 'odd' && winNum % 2 !== 0) { won = true; mult = 2.0; }
                } else if (bet.type === 'range') {
                    if (bet.val === 'low' && winNum >= 1 && winNum <= 18) { won = true; mult = 2.0; }
                    if (bet.val === 'high' && winNum >= 19 && winNum <= 36) { won = true; mult = 2.0; }
                } else if (bet.type === 'dozen') {
                    if (bet.val === '1' && winNum >= 1 && winNum <= 12) { won = true; mult = 3.0; }
                    if (bet.val === '2' && winNum >= 13 && winNum <= 24) { won = true; mult = 3.0; }
                    if (bet.val === '3' && winNum >= 25 && winNum <= 36) { won = true; mult = 3.0; }
                }
            }

            if (won) {
                anyWon = true;
                totalPayout += bet.amount * mult;
            }
        });

        if (totalPayout > 0 && window.arcadeWallet) {
            window.arcadeWallet.add(totalPayout);
            if (window.soundEngine) window.soundEngine.playWin();
            if (totalPayout >= 50 && window.triggerConfetti) window.triggerConfetti();
            if (window.showToast) {
                window.showToast('🎉 Roulette Winner!', `Won +$${totalPayout.toFixed(2)} on Pocket ${winNum}!`, 'success');
            }
        } else if (this.playerBets.length > 0) {
            if (window.soundEngine) window.soundEngine.playLoss();
            if (window.showToast) {
                const totalLost = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
                window.showToast('No Win', `Pocket was ${winNum} (${winColor.toUpperCase()}). -$${totalLost.toFixed(2)}`, 'error');
            }
        }

        // Reset for next round
        setTimeout(() => {
            this.playerBets = [];
            this.periodId++;
            document.querySelectorAll('.roulette-zero-cell, .roulette-num-cell, .roulette-outside-btn').forEach(el => {
                el.classList.remove('selected');
            });
            this.updateBetSummary();
            this.populateSimBets();
            this.startCountdown();
        }, 3500);
    }

    populateSimBets() {
        if (!this.simBetsContainer) return;
        const fakeUsers = ['CryptoWolf', 'RedQueen', 'AcePilot', 'LuckyVip', 'NeonRider', 'VegasPro', 'StarGazer'];
        const targets = ['RED', 'BLACK', 'EVEN', 'ODD', '0 (Green)', '1st 12', '7', '17', '36'];
        this.simBetsContainer.innerHTML = fakeUsers.map(u => {
            const amt = [5, 10, 25, 50, 100][Math.floor(Math.random() * 5)];
            const target = targets[Math.floor(Math.random() * targets.length)];
            return `
                <div class="roulette-player-item">
                    <span class="roulette-player-name"><i class="fa-solid fa-user-circle"></i> ${u}</span>
                    <span>${target}</span>
                    <span class="roulette-player-bet">$${amt}</span>
                </div>
            `;
        }).join('');
    }

    animateWheel() {
        this.drawWheel();
        requestAnimationFrame(() => this.animateWheel());
    }

    drawWheel() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 10;

        this.ctx.clearRect(0, 0, w, h);

        const count = 37;
        const arc = (Math.PI * 2) / count;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.wheelAngle);

        // Draw Outer Rim
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#334155';
        this.ctx.stroke();

        // Draw Pockets
        for (let i = 0; i < count; i++) {
            const num = this.wheelNumbers[i];
            const angle = i * arc;

            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.arc(0, 0, radius - 4, angle, angle + arc);
            this.ctx.closePath();

            if (num === 0) {
                this.ctx.fillStyle = '#059669'; // Green Zero
            } else if (this.redNumbers.includes(num)) {
                this.ctx.fillStyle = '#dc2626'; // Red
            } else {
                this.ctx.fillStyle = '#0f172a'; // Black
            }
            this.ctx.fill();
            this.ctx.strokeStyle = '#334155';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Pocket numbers
            this.ctx.save();
            this.ctx.rotate(angle + arc / 2);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 11px sans-serif';
            this.ctx.fillText(num.toString(), radius - 12, 4);
            this.ctx.restore();
        }

        // Center hub
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fill();
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#475569';
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fill();

        this.ctx.restore();
    }
}

window.RouletteGame = RouletteGame;

