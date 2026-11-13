// Cyber Neon Snake Engine & Interactive Controller
class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('snake-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.gridSize = 20; // 20x20 grid
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        this.velocity = { x: 1, y: 0 };
        this.nextVelocity = { x: 1, y: 0 };
        this.food = { x: 15, y: 10 };
        this.particles = [];

        this.score = 0;
        this.highScore = 0;
        this.speed = 'normal'; // 'slow' (130ms), 'normal' (90ms), 'turbo' (60ms)
        this.wallMode = 'wrap'; // 'wrap' or 'solid'
        this.isGameOver = false;
        this.isPaused = false;
        this.gameInterval = null;

        this.touchStartX = 0;
        this.touchStartY = 0;

        this.initDOM();
    }

    initDOM() {
        if (!this.canvas) return;

        this.scoreElem = document.getElementById('snake-score');
        this.highScoreElem = document.getElementById('snake-best-score');
        this.speedSelector = document.getElementById('snake-speed-select');
        this.wallSelector = document.getElementById('snake-wall-select');
        this.pauseBtn = document.getElementById('snake-pause-btn');
        this.restartBtn = document.getElementById('snake-restart-btn');
        this.overlay = document.getElementById('snake-overlay');
        this.overlayScore = document.getElementById('snake-overlay-score');
        this.overlayBtn = document.getElementById('snake-overlay-btn');

        // Load high score
        const saved = localStorage.getItem('arcade_snake_best');
        if (saved) this.highScore = parseInt(saved, 10);
        this.updateScoreUI();

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 120);
        });

        // Speed & Wall selection
        if (this.speedSelector) {
            this.speedSelector.addEventListener('change', (e) => {
                this.speed = e.target.value;
                if (!this.isGameOver && !this.isPaused) this.startLoop();
            });
        }

        if (this.wallSelector) {
            this.wallSelector.addEventListener('change', (e) => {
                this.wallMode = e.target.value;
            });
        }

        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.togglePause());
        }

        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.restart();
            });
        }

        if (this.overlayBtn) {
            this.overlayBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.restart();
            });
        }

        // Virtual D-Pad
        const dpadBtns = document.querySelectorAll('.snake-dpad-btn');
        if (dpadBtns) {
            dpadBtns.forEach(btn => {
                const handleDpad = (e) => {
                    e.preventDefault();
                    const dir = btn.dataset.dir;
                    if (dir === 'up') this.setDirection(0, -1);
                    else if (dir === 'right') this.setDirection(1, 0);
                    else if (dir === 'down') this.setDirection(0, 1);
                    else if (dir === 'left') this.setDirection(-1, 0);
                };
                btn.addEventListener('touchstart', handleDpad, { passive: false });
                btn.addEventListener('click', handleDpad);
            });
        }

        // Touch Swipe
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (!e.changedTouches.length) return;
            const dx = e.changedTouches[0].clientX - this.touchStartX;
            const dy = e.changedTouches[0].clientY - this.touchStartY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (Math.max(absDx, absDy) > 25) {
                if (absDx > absDy) {
                    this.setDirection(dx > 0 ? 1 : -1, 0);
                } else {
                    this.setDirection(0, dy > 0 ? 1 : -1);
                }
            }
        }, { passive: true });

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            const view = document.getElementById('view-snake');
            if (!view || !view.classList.contains('active')) return;

            let handled = false;
            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { this.setDirection(0, -1); handled = true; }
            else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { this.setDirection(1, 0); handled = true; }
            else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { this.setDirection(0, 1); handled = true; }
            else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { this.setDirection(-1, 0); handled = true; }
            else if (e.key === ' ') { this.togglePause(); handled = true; }

            if (handled) e.preventDefault();
        });

        this.restart();
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
        this.draw();
    }

    setDirection(vx, vy) {
        if (this.isPaused || this.isGameOver) return;
        // Prevent 180 degree reversing
        if (vx !== 0 && this.velocity.x === -vx) return;
        if (vy !== 0 && this.velocity.y === -vy) return;
        this.nextVelocity = { x: vx, y: vy };
    }

    restart() {
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        this.velocity = { x: 1, y: 0 };
        this.nextVelocity = { x: 1, y: 0 };
        this.particles = [];
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.spawnFood();
        this.updateScoreUI();

        if (this.overlay) this.overlay.classList.remove('active');
        if (this.pauseBtn) this.pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

        this.startLoop();
    }

    spawnFood() {
        let valid = false;
        while (!valid) {
            const rx = Math.floor(Math.random() * this.gridSize);
            const ry = Math.floor(Math.random() * this.gridSize);
            valid = !this.snake.some(seg => seg.x === rx && seg.y === ry);
            if (valid) {
                this.food = { x: rx, y: ry };
            }
        }
    }

    startLoop() {
        this.stopLoop();
        let intervalMs = 90;
        if (this.speed === 'slow') intervalMs = 135;
        else if (this.speed === 'turbo') intervalMs = 60;

        this.gameInterval = setInterval(() => {
            if (!this.isPaused && !this.isGameOver) {
                this.update();
                this.draw();
            }
        }, intervalMs);
    }

    stopLoop() {
        if (this.gameInterval) clearInterval(this.gameInterval);
    }

    togglePause() {
        if (this.isGameOver) return;
        this.isPaused = !this.isPaused;
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = this.isPaused 
                ? '<i class="fa-solid fa-play"></i> Resume' 
                : '<i class="fa-solid fa-pause"></i> Pause';
        }
        window.soundEngine.playClick();
    }

    update() {
        this.velocity = { ...this.nextVelocity };
        let newHeadX = this.snake[0].x + this.velocity.x;
        let newHeadY = this.snake[0].y + this.velocity.y;

        // Wall collisions / wrapping
        if (this.wallMode === 'wrap') {
            newHeadX = (newHeadX + this.gridSize) % this.gridSize;
            newHeadY = (newHeadY + this.gridSize) % this.gridSize;
        } else {
            if (newHeadX < 0 || newHeadX >= this.gridSize || newHeadY < 0 || newHeadY >= this.gridSize) {
                this.handleDeath();
                return;
            }
        }

        // Self collision check
        if (this.snake.some(seg => seg.x === newHeadX && seg.y === newHeadY)) {
            this.handleDeath();
            return;
        }

        const newHead = { x: newHeadX, y: newHeadY };
        this.snake.unshift(newHead);

        // Check if food eaten
        if (newHeadX === this.food.x && newHeadY === this.food.y) {
            this.score += 10;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('arcade_snake_best', this.highScore);
                if (window.arcadeWallet) {
                    window.arcadeWallet.stats.snake.highScore = this.highScore;
                    window.arcadeWallet.saveStats();
                }
            }
            this.updateScoreUI();
            window.soundEngine.playEat();
            this.spawnSparks(newHeadX, newHeadY);
            this.spawnFood();
        } else {
            this.snake.pop(); // Remove tail
        }

        // Update spark particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.04;
            if (p.alpha <= 0) this.particles.splice(i, 1);
        }
    }

    handleDeath() {
        this.isGameOver = true;
        this.stopLoop();
        window.soundEngine.playAviatorCrash();

        if (this.overlay) {
            this.overlayScore.textContent = `Score: ${this.score} • Best: ${this.highScore}`;
            this.overlay.classList.add('active');
        }

        if (window.showToast) {
            window.showToast('Signal Lost! 💀', `Snake perished with score: ${this.score}`, 'error');
        }
    }

    spawnSparks(gx, gy) {
        const cellW = (this.canvas.width / (window.devicePixelRatio || 1)) / this.gridSize;
        const cellH = (this.canvas.height / (window.devicePixelRatio || 1)) / this.gridSize;
        const centerX = (gx + 0.5) * cellW;
        const centerY = (gy + 0.5) * cellH;

        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 3,
                alpha: 1,
                color: Math.random() > 0.5 ? '#10b981' : '#00f2fe'
            });
        }
    }

    updateScoreUI() {
        if (this.scoreElem) this.scoreElem.textContent = this.score;
        if (this.highScoreElem) this.highScoreElem.textContent = this.highScore;
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const cellW = w / this.gridSize;
        const cellH = h / this.gridSize;

        this.ctx.clearRect(0, 0, w, h);

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        // Draw grid lines
        this.ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridSize; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * cellW, 0);
            this.ctx.lineTo(i * cellW, h);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, i * cellH);
            this.ctx.lineTo(w, i * cellH);
            this.ctx.stroke();
        }

        // Draw Food (Clean Solid Orb)
        const fx = this.food.x * cellW + cellW / 2;
        const fy = this.food.y * cellH + cellH / 2;
        const fr = cellW * 0.38;

        this.ctx.save();
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        // Draw Snake
        this.snake.forEach((seg, idx) => {
            const sx = seg.x * cellW + 1;
            const sy = seg.y * cellH + 1;
            const sw = cellW - 2;
            const sh = cellH - 2;

            this.ctx.save();
            if (idx === 0) {
                // Head
                this.ctx.fillStyle = '#10b981';
                this.roundRect(this.ctx, sx, sy, sw, sh, 4);
                this.ctx.fill();

                // Eyes
                this.ctx.fillStyle = '#ffffff';
                const eyeOffset = sw * 0.25;
                const eyeSize = sw * 0.16;

                let eye1X = sx + eyeOffset;
                let eye1Y = sy + eyeOffset;
                let eye2X = sx + sw - eyeOffset;
                let eye2Y = sy + eyeOffset;

                if (this.velocity.x === 1) { // Moving right
                    eye1X = sx + sw - eyeOffset; eye1Y = sy + eyeOffset;
                    eye2X = sx + sw - eyeOffset; eye2Y = sy + sh - eyeOffset;
                } else if (this.velocity.y === 1) { // Moving down
                    eye1X = sx + eyeOffset; eye1Y = sy + sh - eyeOffset;
                    eye2X = sx + sw - eyeOffset; eye2Y = sy + sh - eyeOffset;
                }

                this.ctx.beginPath();
                this.ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
                this.ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                this.ctx.fillStyle = '#059669';
                this.roundRect(this.ctx, sx, sy, sw, sh, 3);
                this.ctx.fill();
            }
            this.ctx.restore();
        });

        // Draw Sparks
        this.ctx.save();
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

window.SnakeGame = SnakeGame;
