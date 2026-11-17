// Cyber Neon Snake Engine & Interactive Controller
class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('snake-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.stage = document.querySelector('.snake-stage') || this.canvas;

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
        this.speed = 'normal'; // 'slow' (135ms), 'normal' (90ms), 'turbo' (60ms)
        this.wallMode = 'solid'; // 'wrap', 'solid', 'cross', 'pillars', 'corners', 'labyrinth'
        this.walls = new Set();
        this.isGameOver = false;
        this.isPaused = false;
        this.gameInterval = null;

        this.touchStartX = 0;
        this.touchStartY = 0;

        this.initDOM();
    }

    initDOM() {
        if (!this.canvas) return;

        this.stage = document.querySelector('.snake-stage') || this.canvas;
        this.scoreElem = document.getElementById('snake-score');
        this.highScoreElem = document.getElementById('snake-best-score');
        this.speedSelector = document.getElementById('snake-speed-select');
        this.wallSelector = document.getElementById('snake-wall-select');
        this.pauseBtn = document.getElementById('snake-pause-btn');
        this.restartBtn = document.getElementById('snake-restart-btn');
        this.overlay = document.getElementById('snake-overlay');
        this.overlayBtn = document.getElementById('snake-overlay-btn');
        this.goRunScore = document.getElementById('snake-go-run-score');
        this.goBestScore = document.getElementById('snake-go-best-score');
        this.goNewBest = document.getElementById('snake-go-newbest');
        this.goSubtitle = document.getElementById('snake-go-subtitle');

        if (this.wallSelector) {
            this.wallMode = this.wallSelector.value || 'solid';
        }
        this.initWalls();

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
                this.initWalls();
                this.restart();
                if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
                    window.soundEngine.playClick();
                }
            });
        }

        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.togglePause());
        }

        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => {
                if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
                    window.soundEngine.playClick();
                }
                this.restart();
            });
        }

        if (this.overlayBtn) {
            this.overlayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
                    window.soundEngine.playClick();
                }
                this.restart();
            });
        }

        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
                        window.soundEngine.playClick();
                    }
                    this.restart();
                }
            });
        }

        // Virtual D-Pad for Mobile & Quick Controls
        const dpadBtns = document.querySelectorAll('.snake-dpad-btn');
        if (dpadBtns) {
            dpadBtns.forEach(btn => {
                const handleDpad = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const dir = btn.dataset.dir;
                    if (dir === 'up') this.setDirection(0, -1);
                    else if (dir === 'right') this.setDirection(1, 0);
                    else if (dir === 'down') this.setDirection(0, 1);
                    else if (dir === 'left') this.setDirection(-1, 0);
                    if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
                        window.soundEngine.playClick();
                    }
                };
                btn.addEventListener('pointerdown', handleDpad);
                btn.addEventListener('touchstart', handleDpad, { passive: false });
                btn.addEventListener('click', handleDpad);
            });
        }

        // Touch Arena Controls (Continuous Real-Time Swipe + Tap to Turn)
        const stage = this.stage || this.canvas;
        let isTouching = false;

        stage.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                isTouching = true;
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        stage.addEventListener('touchmove', (e) => {
            if (!isTouching || e.touches.length === 0) return;
            e.preventDefault();

            const curX = e.touches[0].clientX;
            const curY = e.touches[0].clientY;
            const dx = curX - this.touchStartX;
            const dy = curY - this.touchStartY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Responsive threshold: 16px of swipe changes direction immediately!
            if (Math.max(absDx, absDy) > 16) {
                if (absDx > absDy) {
                    this.setDirection(dx > 0 ? 1 : -1, 0);
                } else {
                    this.setDirection(0, dy > 0 ? 1 : -1);
                }
                this.touchStartX = curX;
                this.touchStartY = curY;
            }
        }, { passive: false });

        stage.addEventListener('touchend', () => {
            isTouching = false;
        }, { passive: true });

        // Tap on arena quadrants to turn (top/bottom/left/right)
        stage.addEventListener('click', (e) => {
            if (this.isPaused || this.isGameOver) return;
            const rect = stage.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width - 0.5;
            const relY = (e.clientY - rect.top) / rect.height - 0.5;

            if (Math.abs(relX) > Math.abs(relY)) {
                this.setDirection(relX > 0 ? 1 : -1, 0);
            } else {
                this.setDirection(0, relY > 0 ? 1 : -1);
            }
        });

        // Keyboard Controls (PC: Arrow Keys + WASD + Space/Enter to Reboot)
        window.addEventListener('keydown', (e) => {
            const view = document.getElementById('view-snake');
            if (!view || !view.classList.contains('active')) return;

            if (this.isGameOver) {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
                        window.soundEngine.playClick();
                    }
                    this.restart();
                    return;
                }
            }

            let handled = false;
            const k = e.key;
            const code = e.code;

            if (k === 'ArrowUp' || k === 'w' || k === 'W' || code === 'KeyW' || code === 'ArrowUp') {
                this.setDirection(0, -1); handled = true;
            } else if (k === 'ArrowRight' || k === 'd' || k === 'D' || code === 'KeyD' || code === 'ArrowRight') {
                this.setDirection(1, 0); handled = true;
            } else if (k === 'ArrowDown' || k === 's' || k === 'S' || code === 'KeyS' || code === 'ArrowDown') {
                this.setDirection(0, 1); handled = true;
            } else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || code === 'KeyA' || code === 'ArrowLeft') {
                this.setDirection(-1, 0); handled = true;
            } else if (k === ' ') {
                this.togglePause(); handled = true;
            }

            if (handled) e.preventDefault();
        });

        this.restart();
    }

    initWalls() {
        this.walls = new Set();
        const addWall = (x, y) => this.walls.add(`${x},${y}`);

        if (this.wallMode === 'cross') {
            // Vertical arms leaving center (y: 7..13) and ends clear
            for (let y = 2; y <= 6; y++) addWall(10, y);
            for (let y = 13; y <= 17; y++) addWall(10, y);
            // Horizontal arms leaving center (x: 6..14) clear for snake start
            for (let x = 2; x <= 5; x++) addWall(x, 10);
            for (let x = 15; x <= 18; x++) addWall(x, 10);
        } else if (this.wallMode === 'pillars') {
            // Two vertical laser barrier pillars leaving top, bottom, and center hallway open
            for (let y = 4; y <= 15; y++) {
                addWall(5, y);
                addWall(14, y);
            }
        } else if (this.wallMode === 'corners') {
            // Four corner tactical brackets creating chambers in each corner
            for (let i = 0; i <= 3; i++) {
                // Top-left
                addWall(4 + i, 4); addWall(4, 4 + i);
                // Top-right
                addWall(15 - i, 4); addWall(15, 4 + i);
                // Bottom-left
                addWall(4 + i, 15); addWall(4, 15 - i);
                // Bottom-right
                addWall(15 - i, 15); addWall(15, 15 - i);
            }
        } else if (this.wallMode === 'labyrinth') {
            // Upper dividing line with central doorway (x: 8..11)
            for (let x = 2; x <= 7; x++) addWall(x, 5);
            for (let x = 12; x <= 17; x++) addWall(x, 5);
            // Lower dividing line with central doorway (x: 8..11)
            for (let x = 2; x <= 7; x++) addWall(x, 14);
            for (let x = 12; x <= 17; x++) addWall(x, 14);
            // Side boundary lines creating distinct chambers
            for (let y = 8; y <= 11; y++) {
                addWall(4, y);
                addWall(15, y);
            }
        }

        if (this.stage) {
            this.stage.setAttribute('data-boundary', this.wallMode);
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
        this.initWalls();
        this.spawnFood();
        this.updateScoreUI();

        if (this.stage) {
            this.stage.classList.remove('collision-flash');
            this.stage.setAttribute('data-boundary', this.wallMode);
        }
        if (this.overlay) this.overlay.classList.remove('active');
        if (this.pauseBtn) this.pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

        this.startLoop();
    }

    spawnFood() {
        let valid = false;
        let attempts = 0;
        while (!valid && attempts < 500) {
            attempts++;
            const rx = Math.floor(Math.random() * this.gridSize);
            const ry = Math.floor(Math.random() * this.gridSize);
            const onSnake = this.snake.some(seg => seg.x === rx && seg.y === ry);
            const onWall = this.walls.has(`${rx},${ry}`);
            if (!onSnake && !onWall) {
                this.food = { x: rx, y: ry };
                valid = true;
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
        if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
            window.soundEngine.playClick();
        }
    }

    update() {
        this.velocity = { ...this.nextVelocity };
        let newHeadX = this.snake[0].x + this.velocity.x;
        let newHeadY = this.snake[0].y + this.velocity.y;

        // Outer Boundary collisions / wrapping
        if (this.wallMode === 'wrap') {
            newHeadX = (newHeadX + this.gridSize) % this.gridSize;
            newHeadY = (newHeadY + this.gridSize) % this.gridSize;
        } else {
            if (newHeadX < 0 || newHeadX >= this.gridSize || newHeadY < 0 || newHeadY >= this.gridSize) {
                this.handleDeath('PERIMETER BREACH • SOLID BOUNDARY');
                return;
            }
        }

        // Inner Obstacle Wall collisions
        if (this.walls.has(`${newHeadX},${newHeadY}`)) {
            this.handleDeath('IMPACT DETECTED • INTERNAL BARRIER');
            return;
        }

        // Self collision check
        if (this.snake.some(seg => seg.x === newHeadX && seg.y === newHeadY)) {
            this.handleDeath('SIGNAL OVERLOAD • SELF-COLLISION');
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
            if (window.soundEngine && typeof window.soundEngine.playEat === 'function') {
                window.soundEngine.playEat();
            }
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

    handleDeath(reason) {
        this.isGameOver = true;
        this.stopLoop();
        if (window.soundEngine) {
            if (typeof window.soundEngine.playSnakeDeath === 'function') {
                window.soundEngine.playSnakeDeath();
            } else if (typeof window.soundEngine.playLoss === 'function') {
                window.soundEngine.playLoss();
            } else if (typeof window.soundEngine.playClick === 'function') {
                window.soundEngine.playClick();
            }
        }

        // Visual collision flash effect on arena
        if (this.stage) {
            this.stage.classList.remove('collision-flash');
            void this.stage.offsetWidth; // Force DOM reflow to replay animation
            this.stage.classList.add('collision-flash');
        }

        const isNewBest = this.score > 0 && this.score >= this.highScore;

        if (this.goSubtitle && reason) {
            this.goSubtitle.textContent = reason;
        }
        if (this.goRunScore) this.goRunScore.textContent = this.score;
        if (this.goBestScore) this.goBestScore.textContent = this.highScore;
        if (this.goNewBest) {
            this.goNewBest.style.display = isNewBest ? 'inline-block' : 'none';
        }

        if (this.overlay) {
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

        // Draw Obstacle Walls (for cross, pillars, corners, labyrinth)
        if (this.walls.size > 0) {
            this.walls.forEach(key => {
                const parts = key.split(',');
                const wx = parseInt(parts[0], 10);
                const wy = parseInt(parts[1], 10);
                const bx = wx * cellW;
                const by = wy * cellH;
                const bw = cellW;
                const bh = cellH;

                this.ctx.save();
                // Outer wall body - dark obsidian cyber block
                this.ctx.fillStyle = isLight ? '#cbd5e1' : '#1e293b';
                this.ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);

                // Neon red barrier outline
                this.ctx.strokeStyle = '#ef4444';
                this.ctx.lineWidth = 1.5;
                this.ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);

                // Hazard warning field
                this.ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
                this.ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);

                // Center laser node
                this.ctx.fillStyle = '#f87171';
                this.ctx.beginPath();
                this.ctx.arc(bx + bw / 2, by + bh / 2, bw * 0.16, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.restore();
            });
        }

        // Draw Food (Clean Solid Glowing Orb)
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
                } else if (this.velocity.x === -1) { // Moving left
                    eye1X = sx + eyeOffset; eye1Y = sy + eyeOffset;
                    eye2X = sx + eyeOffset; eye2Y = sy + sh - eyeOffset;
                } else if (this.velocity.y === 1) { // Moving down
                    eye1X = sx + eyeOffset; eye1Y = sy + sh - eyeOffset;
                    eye2X = sx + sw - eyeOffset; eye2Y = sy + sh - eyeOffset;
                } else if (this.velocity.y === -1) { // Moving up
                    eye1X = sx + eyeOffset; eye1Y = sy + eyeOffset;
                    eye2X = sx + sw - eyeOffset; eye2Y = sy + eyeOffset;
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
