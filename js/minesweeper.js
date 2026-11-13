// Cyber Minesweeper Engine & Interactive Controller
class MinesweeperGame {
    constructor() {
        this.difficulties = {
            easy: { rows: 8, cols: 8, mines: 10 },
            medium: { rows: 12, cols: 12, mines: 22 },
            hard: { rows: 14, cols: 14, mines: 38 }
        };

        this.currentDiff = 'easy';
        this.rows = 8;
        this.cols = 8;
        this.totalMines = 10;

        this.board = [];
        this.firstClick = true;
        this.gameOver = false;
        this.won = false;
        this.flagMode = false;
        this.flagsPlaced = 0;

        this.timer = 0;
        this.timerInterval = null;

        // Long press handling for mobile
        this.pressTimer = null;
        this.isLongPress = false;

        this.initDOM();
    }

    initDOM() {
        this.gridElement = document.getElementById('ms-grid');
        this.minesCountElement = document.getElementById('ms-mines-count');
        this.timerElement = document.getElementById('ms-timer');
        this.faceBtn = document.getElementById('ms-face-btn');
        this.diffSelector = document.getElementById('ms-diff-select');
        this.flagModeBtn = document.getElementById('ms-flag-mode-btn');
        this.newGameBtn = document.getElementById('ms-new-game-btn');

        if (!this.gridElement) return;

        if (this.diffSelector) {
            this.diffSelector.addEventListener('change', (e) => {
                this.currentDiff = e.target.value;
                this.startNewGame();
            });
        }

        if (this.faceBtn) {
            this.faceBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.startNewGame();
            });
        }

        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.startNewGame();
            });
        }

        if (this.flagModeBtn) {
            this.flagModeBtn.addEventListener('click', () => {
                this.flagMode = !this.flagMode;
                this.flagModeBtn.classList.toggle('active', this.flagMode);
                window.soundEngine.playClick();
            });
        }

        this.startNewGame();
    }

    startNewGame() {
        const config = this.difficulties[this.currentDiff] || this.difficulties.easy;
        this.rows = config.rows;
        this.cols = config.cols;
        this.totalMines = config.mines;

        this.firstClick = true;
        this.gameOver = false;
        this.won = false;
        this.flagsPlaced = 0;
        this.stopTimer();
        this.timer = 0;
        this.updateTimerDisplay();
        this.updateMinesDisplay();

        if (this.faceBtn) this.faceBtn.innerHTML = '<i class="fa-solid fa-face-smile"></i>';

        this.buildBoardData();
        this.renderGrid();
    }

    buildBoardData() {
        this.board = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    r, c,
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0
                });
            }
            this.board.push(row);
        }
    }

    placeMines(safeR, safeC) {
        let placed = 0;
        // Avoid safe cell and its 8 neighbors for a generous first reveal opening
        const forbidden = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                forbidden.add(`${safeR + dr},${safeC + dc}`);
            }
        }

        while (placed < this.totalMines) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (!this.board[r][c].isMine && !forbidden.has(`${r},${c}`)) {
                this.board[r][c].isMine = true;
                placed++;
            }
        }

        // Calculate neighbor numbers
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.board[r][c].isMine) {
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (this.isValid(nr, nc) && this.board[nr][nc].isMine) {
                                count++;
                            }
                        }
                    }
                    this.board[r][c].neighborMines = count;
                }
            }
        }
    }

    isValid(r, c) {
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    renderGrid() {
        this.gridElement.innerHTML = '';
        this.gridElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        this.gridElement.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

        // Adjust font size based on column density
        const fontSize = this.cols <= 8 ? 'clamp(1rem, 4vw, 1.4rem)' : (this.cols <= 12 ? 'clamp(0.8rem, 3vw, 1.1rem)' : 'clamp(0.7rem, 2.5vw, 0.95rem)');

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cellElem = document.createElement('div');
                cellElem.className = 'ms-cell';
                cellElem.style.fontSize = fontSize;
                cellElem.dataset.r = r;
                cellElem.dataset.c = c;

                // Mouse events
                cellElem.addEventListener('click', (e) => this.handleCellClick(r, c));
                cellElem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.toggleFlag(r, c);
                });

                // Touch events for long-press flagging
                cellElem.addEventListener('touchstart', (e) => {
                    this.isLongPress = false;
                    this.pressTimer = setTimeout(() => {
                        this.isLongPress = true;
                        this.toggleFlag(r, c);
                    }, 350);
                }, { passive: true });

                cellElem.addEventListener('touchmove', () => {
                    if (this.pressTimer) clearTimeout(this.pressTimer);
                }, { passive: true });

                cellElem.addEventListener('touchcancel', () => {
                    if (this.pressTimer) clearTimeout(this.pressTimer);
                }, { passive: true });

                cellElem.addEventListener('touchend', () => {
                    if (this.pressTimer) clearTimeout(this.pressTimer);
                }, { passive: true });

                this.gridElement.appendChild(cellElem);
            }
        }
    }

    handleCellClick(r, c) {
        if (this.gameOver || this.won) return;
        if (this.isLongPress) {
            setTimeout(() => { this.isLongPress = false; }, 80);
            return;
        }
        const cell = this.board[r][c];

        if (this.flagMode) {
            this.toggleFlag(r, c);
            return;
        }

        if (cell.isFlagged) return;

        if (this.firstClick) {
            this.firstClick = false;
            this.placeMines(r, c);
            this.startTimer();
        }

        if (cell.isRevealed) {
            // Chord click: if already revealed and flags equal neighbor mines, reveal adjacent
            this.handleChord(r, c);
            return;
        }

        this.revealCell(r, c);
    }

    revealCell(r, c) {
        if (!this.isValid(r, c)) return;
        const cell = this.board[r][c];
        if (cell.isRevealed || cell.isFlagged) return;

        cell.isRevealed = true;
        const elem = this.getCellElement(r, c);
        elem.classList.add('revealed');

        if (cell.isMine) {
            // Exploded!
            this.handleDetonation(r, c);
            return;
        }

        window.soundEngine.playClick();

        if (cell.neighborMines > 0) {
            elem.textContent = cell.neighborMines;
            elem.dataset.num = cell.neighborMines;
        } else {
            // Cascade reveal empty neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr !== 0 || dc !== 0) {
                        this.revealCell(r + dr, c + dc);
                    }
                }
            }
        }

        this.checkWinCondition();
    }

    handleChord(r, c) {
        const cell = this.board[r][c];
        if (cell.neighborMines === 0) return;

        let flagCount = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (this.isValid(nr, nc) && this.board[nr][nc].isFlagged) {
                    flagCount++;
                }
            }
        }

        if (flagCount === cell.neighborMines) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (this.isValid(nr, nc) && !this.board[nr][nc].isFlagged && !this.board[nr][nc].isRevealed) {
                        this.revealCell(nr, nc);
                    }
                }
            }
        }
    }

    toggleFlag(r, c) {
        if (this.gameOver || this.won) return;
        const cell = this.board[r][c];
        if (cell.isRevealed) return;

        cell.isFlagged = !cell.isFlagged;
        const elem = this.getCellElement(r, c);

        if (cell.isFlagged) {
            this.flagsPlaced++;
            elem.classList.add('flagged');
            elem.innerHTML = '<i class="fa-solid fa-flag"></i>';
            window.soundEngine.playFlag();
        } else {
            this.flagsPlaced--;
            elem.classList.remove('flagged');
            elem.innerHTML = '';
            window.soundEngine.playClick();
        }

        this.updateMinesDisplay();
        this.checkWinCondition();
    }

    handleDetonation(hitR, hitC) {
        this.gameOver = true;
        this.stopTimer();
        window.soundEngine.playAviatorCrash();

        if (this.faceBtn) this.faceBtn.innerHTML = '<i class="fa-solid fa-face-dizzy"></i>';

        // Reveal all mines
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                const elem = this.getCellElement(r, c);
                if (cell.isMine) {
                    elem.classList.add('revealed', 'mine');
                    if (r === hitR && c === hitC) {
                        elem.classList.add('detonated');
                    }
                    elem.innerHTML = '<i class="fa-solid fa-bomb"></i>';
                } else if (cell.isFlagged) {
                    // False flag
                    elem.innerHTML = '<i class="fa-solid fa-xmark" style="color:#f43f5e"></i>';
                }
            }
        }

        if (window.showToast) {
            window.showToast('Sector Compromised 💥', 'Mine triggered! Tap the smiley to deploy again.', 'error');
        }
    }

    checkWinCondition() {
        if (this.gameOver) return;

        let unrevealedSafe = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                if (!cell.isMine && !cell.isRevealed) {
                    unrevealedSafe++;
                }
            }
        }

        if (unrevealedSafe === 0) {
            this.won = true;
            this.stopTimer();
            window.soundEngine.playWin();

            if (this.faceBtn) this.faceBtn.innerHTML = '<i class="fa-solid fa-face-sunglasses"></i>';

            // Auto flag remaining mines
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.board[r][c];
                    if (cell.isMine && !cell.isFlagged) {
                        cell.isFlagged = true;
                        const elem = this.getCellElement(r, c);
                        elem.classList.add('flagged');
                        elem.innerHTML = '<i class="fa-solid fa-flag"></i>';
                    }
                }
            }
            this.flagsPlaced = this.totalMines;
            this.updateMinesDisplay();

            if (window.triggerConfetti) window.triggerConfetti();
            if (window.showToast) {
                window.showToast('Sector Cleared! 🛡️', `Radar clear in ${this.formatTime(this.timer)}!`, 'success');
            }

            if (window.arcadeWallet) {
                window.arcadeWallet.stats.minesweeper.won++;
                if (!window.arcadeWallet.stats.minesweeper.bestTime || this.timer < window.arcadeWallet.stats.minesweeper.bestTime) {
                    window.arcadeWallet.stats.minesweeper.bestTime = this.timer;
                }
                window.arcadeWallet.saveStats();
            }
        }
    }

    startTimer() {
        this.stopTimer();
        this.timer = 0;
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    updateTimerDisplay() {
        if (this.timerElement) this.timerElement.textContent = this.formatTime(this.timer);
    }

    updateMinesDisplay() {
        if (this.minesCountElement) {
            const rem = Math.max(0, this.totalMines - this.flagsPlaced);
            this.minesCountElement.textContent = rem.toString().padStart(2, '0');
        }
    }

    getCellElement(r, c) {
        return this.gridElement.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    }
}

window.MinesweeperGame = MinesweeperGame;

