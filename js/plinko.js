// Plinko Multiplier Game Physics Engine
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

        this.multipliers = {
            low: [5.6, 2.0, 1.2, 0.5, 0, 0.5, 1.2, 2.0, 5.6],
            medium: [13, 3.0, 1.2, 0, 0, 0, 1.2, 3.0, 13],
            high: [29, 4.0, 0, 0, 0, 0, 0, 4.0, 29]
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
        this.bucketsContainer.innerHTML = list.map((m, idx) => `
            <div class="plinko-bucket ${m === 0 ? 'zero-bucket' : ''}" id="plinko-b-${idx}" data-idx="${idx}">
                ${m === 0 ? '0x' : m + 'x'}
            </div>
        `).join('');
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
                window.soundEngine.playClick();
                chips.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.betAmount = parseFloat(btn.dataset.amount);
                if (this.betInput) this.betInput.value = this.betAmount;
            });
        });
    }

    dropBall() {
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(this.betAmount)) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Deposit funds to drop balls!', 'warning');
            if (window.paymentGateway) window.paymentGateway.open(this.betAmount * 5);
            return;
        }

        window.soundEngine.playClick();

        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const startX = w / 2 + (Math.random() - 0.5) * 12;

        this.balls.push({
            x: startX,
            y: 15,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 0,
            r: 6,
            bet: this.betAmount
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
        const bounce = 0.58;

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

        const winAmt = b.bet * mult;
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

        if (mult === 0) {
            if (window.soundEngine) window.soundEngine.playLoss();
            if (window.showToast) {
                window.showToast('0x Zone — Loss', `Ball landed in 0x! -$${b.bet.toFixed(2)}`, 'error');
            }
        } else if (mult >= 2.0) {
            if (window.soundEngine) window.soundEngine.playAviatorCashout();
            if (mult >= 10.0 && window.triggerConfetti) window.triggerConfetti();
        } else if (mult > 0 && mult < 1.0) {
            if (window.soundEngine) window.soundEngine.playBounce();
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

