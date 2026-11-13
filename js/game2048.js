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
                btn.addEventListener('touchstart', handleDpad, { passive: false });
                btn.addEventListener('click', handleDpad);
            });
        }

        // Bind Touch Swipe
        const board = document.getElementById('g2048-board');
        if (board) {
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

                if (Math.max(absDx, absDy) > 28) {
                    if (absDx > absDy) {
                        this.move(dx > 0 ? 1 : 3); // 1 = right, 3 = left
                    } else {
                        this.move(dy > 0 ? 2 : 0); // 2 = down, 0 = up
                    }
                }
            }, { passive: true });
        }

        // Bind Keyboard
        window.addEventListener('keydown', (e) => {
            const view = document.getElementById('view-game2048');
            if (!view || !view.classList.contains('active')) return;
            if (this.over) return;

            let handled = false;
            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { this.move(0); handled = true; }
            else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { this.move(1); handled = true; }
            else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { this.move(2); handled = true; }
            else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { this.move(3); handled = true; }

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

        // Rotate grid to normalize logic as sliding left
        let rotated = this.rotateGrid(this.grid, dir);

        for (let r = 0; r < 4; r++) {
            const originalRow = [...rotated[r]];
            const { row: newRow, scoreGained } = this.slideAndMergeRow(originalRow);
            rotated[r] = newRow;
            mergedScore += scoreGained;
            if (!this.arraysEqual(originalRow, newRow)) {
                moved = true;
            }
        }

        // Rotate back to original orientation
        this.grid = this.rotateGrid(rotated, (4 - dir) % 4);

        if (moved) {
            this.history = { grid: prevGrid, score: prevScore };
            this.score += mergedScore;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                localStorage.setItem('arcade_2048_best', this.bestScore);
                if (window.arcadeWallet) {
                    window.arcadeWallet.stats.game2048.bestScore = this.bestScore;
                    window.arcadeWallet.saveStats();
                }
            }

            if (mergedScore > 0) {
                window.soundEngine.playMerge();
            } else {
                window.soundEngine.playSlide();
            }

            const newTile = this.spawnRandomTile();
            this.render(newTile);
            this.updateScoreUI();

            this.checkGameStatus();
        }
    }

    slideAndMergeRow(row) {
        // Filter zeros
        let filtered = row.filter(val => val !== 0);
        let scoreGained = 0;

        for (let i = 0; i < filtered.length - 1; i++) {
            if (filtered[i] === filtered[i + 1]) {
                filtered[i] *= 2;
                scoreGained += filtered[i];
                filtered.splice(i + 1, 1);
            }
        }

        while (filtered.length < 4) {
            filtered.push(0);
        }

        return { row: filtered, scoreGained };
    }

    rotateGrid(grid, rotations) {
        let current = grid.map(r => [...r]);
        for (let i = 0; i < rotations; i++) {
            const next = Array(4).fill(null).map(() => Array(4).fill(0));
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    next[c][3 - r] = current[r][c];
                }
            }
            current = next;
        }
        return current;
    }

    arraysEqual(a, b) {
        return a.every((val, i) => val === b[i]);
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

