// Cosmic 2048 Engine & Interactive Controller
class Game2048 {
    constructor() {
        this.size = 4;
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.bestScore = 0;
        this.history = null;
        this.won = false;
        this.over = false;

        this.touchStartX = 0;
        this.touchStartY = 0;

        this.initDOM();
    }

    initDOM() {
        this.gridElement = document.getElementById('g2048-grid');
        this.scoreElement = document.getElementById('g2048-score');
        this.bestScoreElement = document.getElementById('g2048-best-score');
        this.undoBtn = document.getElementById('g2048-undo-btn');
        this.restartBtn = document.getElementById('g2048-restart-btn');
        this.overlay = document.getElementById('g2048-overlay');
        this.overlayTitle = document.getElementById('g2048-overlay-title');
        this.overlayBtn = document.getElementById('g2048-overlay-btn');

        if (!this.gridElement) return;

        // Load best score
        const savedBest = localStorage.getItem('arcade_2048_best');
        if (savedBest) this.bestScore = parseInt(savedBest, 10);
        this.updateScoreUI();

        // Bind buttons
        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.restart();
            });
        }
        if (this.undoBtn) {
            this.undoBtn.addEventListener('click', () => {
                this.undo();
            });
        }
        if (this.overlayBtn) {
            this.overlayBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.restart();
            });
        }

        // Bind D-pad
        const dpadBtns = document.querySelectorAll('.dpad-btn');
        if (dpadBtns) {
            dpadBtns.forEach(btn => {
                const handleDpad = (e) => {
                    e.preventDefault();
                    const dir = btn.dataset.dir;
                    if (dir === 'up') this.move(0);
                    else if (dir === 'right') this.move(1);
                    else if (dir === 'down') this.move(2);
                    else if (dir === 'left') this.move(3);
                };
                btn.addEventListener('pointerdown', handleDpad);
                btn.addEventListener('touchstart', handleDpad, { passive: false });
                btn.addEventListener('click', handleDpad);
            });
        }

        // Bind Touch & Mouse Swipe on Board
        const board = document.getElementById('g2048-board');
        if (board) {
            // Touch Swipe
            board.addEventListener('touchstart', (e) => {
                if (e.touches.length > 0) {
                    this.touchStartX = e.touches[0].clientX;
                    this.touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            board.addEventListener('touchmove', (e) => {
                e.preventDefault();
            }, { passive: false });

            board.addEventListener('touchend', (e) => {
                if (!e.changedTouches.length) return;
                const dx = e.changedTouches[0].clientX - this.touchStartX;
                const dy = e.changedTouches[0].clientY - this.touchStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (Math.max(absDx, absDy) > 24) {
                    if (absDx > absDy) {
                        this.move(dx > 0 ? 1 : 3); // 1 = right, 3 = left
                    } else {
                        this.move(dy > 0 ? 2 : 0); // 2 = down, 0 = up
                    }
                }
            }, { passive: true });

            // Mouse Drag on PC
            let isMouseDown = false;
            let mouseStartX = 0;
            let mouseStartY = 0;

            board.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                mouseStartX = e.clientX;
                mouseStartY = e.clientY;
            });

            window.addEventListener('mouseup', (e) => {
                if (!isMouseDown) return;
                isMouseDown = false;
                const dx = e.clientX - mouseStartX;
                const dy = e.clientY - mouseStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (Math.max(absDx, absDy) > 24) {
                    if (absDx > absDy) {
                        this.move(dx > 0 ? 1 : 3); // 1 = right, 3 = left
                    } else {
                        this.move(dy > 0 ? 2 : 0); // 2 = down, 0 = up
                    }
                }
            });
        }

        // Bind Keyboard (PC Support: Arrows + WASD + Numpad)
        window.addEventListener('keydown', (e) => {
            const view = document.getElementById('view-game2048');
            if (!view || !view.classList.contains('active')) return;
            if (this.over) return;

            let handled = false;
            const k = e.key;
            const code = e.code;

            if (k === 'ArrowUp' || k === 'w' || k === 'W' || code === 'KeyW' || code === 'ArrowUp' || k === 'Numpad8') {
                this.move(0); handled = true;
            } else if (k === 'ArrowRight' || k === 'd' || k === 'D' || code === 'KeyD' || code === 'ArrowRight' || k === 'Numpad6') {
                this.move(1); handled = true;
            } else if (k === 'ArrowDown' || k === 's' || k === 'S' || code === 'KeyS' || code === 'ArrowDown' || k === 'Numpad2') {
                this.move(2); handled = true;
            } else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || code === 'KeyA' || code === 'ArrowLeft' || k === 'Numpad4') {
                this.move(3); handled = true;
            }

            if (handled) e.preventDefault();
        });

        this.restart();
    }

    restart() {
        this.grid = Array(4).fill(null).map(() => Array(4).fill(0));
        this.score = 0;
        this.won = false;
        this.over = false;
        this.history = null;
        if (this.overlay) this.overlay.classList.remove('active');

        this.spawnRandomTile();
        this.spawnRandomTile();
        this.render();
        this.updateScoreUI();
    }

    spawnRandomTile() {
        const emptyCells = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.grid[r][c] === 0) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length === 0) return null;

        const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        return { r, c, val: this.grid[r][c] };
    }

    // Directions: 0 = up, 1 = right, 2 = down, 3 = left
    move(dir) {
        if (this.over) return;

        // Save history for undo
        const prevGrid = this.grid.map(row => [...row]);
        const prevScore = this.score;

        let moved = false;
        let mergedScore = 0;
        let newGrid = Array(4).fill(null).map(() => Array(4).fill(0));

        const slideRow = (row) => {
            let arr = row.filter(v => v !== 0);
            let score = 0;
            for (let i = 0; i < arr.length - 1; i++) {
                if (arr[i] === arr[i + 1]) {
                    arr[i] *= 2;
                    score += arr[i];
                    arr.splice(i + 1, 1);
                }
            }
            while (arr.length < 4) arr.push(0);
            return { row: arr, score };
        };

        if (dir === 3) { // LEFT
            for (let r = 0; r < 4; r++) {
                const res = slideRow(this.grid[r]);
                newGrid[r] = res.row;
                mergedScore += res.score;
                if (this.grid[r].some((v, i) => v !== newGrid[r][i])) moved = true;
            }
        } else if (dir === 1) { // RIGHT
            for (let r = 0; r < 4; r++) {
                const reversed = [...this.grid[r]].reverse();
                const res = slideRow(reversed);
                newGrid[r] = res.row.reverse();
                mergedScore += res.score;
                if (this.grid[r].some((v, i) => v !== newGrid[r][i])) moved = true;
            }
        } else if (dir === 0) { // UP
            for (let c = 0; c < 4; c++) {
                const col = [this.grid[0][c], this.grid[1][c], this.grid[2][c], this.grid[3][c]];
                const res = slideRow(col);
                for (let r = 0; r < 4; r++) newGrid[r][c] = res.row[r];
                mergedScore += res.score;
                if (col.some((v, i) => v !== res.row[i])) moved = true;
            }
        } else if (dir === 2) { // DOWN
            for (let c = 0; c < 4; c++) {
                const col = [this.grid[3][c], this.grid[2][c], this.grid[1][c], this.grid[0][c]];
                const res = slideRow(col);
                for (let r = 0; r < 4; r++) newGrid[3 - r][c] = res.row[r];
                mergedScore += res.score;
                if (col.some((v, i) => v !== res.row[i])) moved = true;
            }
        }

        if (moved) {
            this.grid = newGrid;
            this.history = { grid: prevGrid, score: prevScore };
            this.score += mergedScore;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                localStorage.setItem('arcade_2048_best', this.bestScore);
                if (window.arcadeWallet && window.arcadeWallet.stats && window.arcadeWallet.stats.game2048) {
                    window.arcadeWallet.stats.game2048.bestScore = this.bestScore;
                    window.arcadeWallet.saveStats();
                }
            }

            if (mergedScore > 0) {
                if (window.soundEngine) window.soundEngine.playMerge();
            } else {
                if (window.soundEngine) window.soundEngine.playSlide();
            }

            const newTile = this.spawnRandomTile();
            this.render(newTile);
            this.updateScoreUI();
            this.checkGameStatus();
        }
    }

    undo() {
        if (!this.history || this.over) return;
        this.grid = this.history.grid.map(row => [...row]);
        this.score = this.history.score;
        this.history = null;
        this.render();
        this.updateScoreUI();
        window.soundEngine.playClick();
        if (window.showToast) {
            window.showToast('Move Undone', 'Reverted to previous board state', 'info');
        }
    }

    checkGameStatus() {
        // Check for 2048 win
        if (!this.won) {
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (this.grid[r][c] >= 2048) {
                        this.won = true;
                        window.soundEngine.playWin();
                        if (window.triggerConfetti) window.triggerConfetti();
                        if (window.showToast) {
                            window.showToast('2048 Reached! 🌟', 'Cosmic victory achieved! You can continue playing for high scores.', 'success');
                        }
                    }
                }
            }
        }

        // Check for Game Over (no empty cells and no adjacent identical tiles)
        let canMove = false;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.grid[r][c] === 0) {
                    canMove = true;
                    break;
                }
                if (c < 3 && this.grid[r][c] === this.grid[r][c + 1]) canMove = true;
                if (r < 3 && this.grid[r][c] === this.grid[r + 1][c]) canMove = true;
            }
            if (canMove) break;
        }

        if (!canMove) {
            this.over = true;
            window.soundEngine.playDraw();
            if (this.overlay) {
                this.overlayTitle.textContent = 'Game Over!';
                this.overlay.classList.add('active');
            }
            if (window.showToast) {
                window.showToast('No Moves Left', `Final Score: ${this.score}`, 'error');
            }
        }
    }

    updateScoreUI() {
        if (this.scoreElement) this.scoreElement.textContent = this.score;
        if (this.bestScoreElement) this.bestScoreElement.textContent = this.bestScore;
    }

    render(newTile = null) {
        if (!this.gridElement) return;
        this.gridElement.innerHTML = '';

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cell = document.createElement('div');
                cell.className = 'g2048-cell';
                const val = this.grid[r][c];

                if (val > 0) {
                    cell.dataset.value = val;
                    cell.textContent = val;
                    if (newTile && newTile.r === r && newTile.c === c) {
                        cell.classList.add('pop');
                    }
                }
                this.gridElement.appendChild(cell);
            }
        }
    }
}

window.Game2048 = Game2048;

