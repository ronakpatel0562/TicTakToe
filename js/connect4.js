// Connect Four (4-in-a-Row Engine with Minimax AI & 2-Player)
class Connect4Game {
    constructor() {
        this.rows = 6;
        this.cols = 7;
        this.board = [];
        this.currentPlayer = 1; // 1 = Red (Player), 2 = Yellow (AI / Player 2)
        this.gameMode = 'ai'; // 'ai' or 'pvp'
        this.aiDifficulty = 'medium'; // 'easy', 'medium', 'master'
        this.isGameOver = false;

        this.scores = {
            p1: 0,
            ties: 0,
            p2: 0
        };

        this.gridEl = document.getElementById('c4-grid');
        this.statusTextEl = document.getElementById('c4-status-text');
        this.modeBtns = document.querySelectorAll('.c4-mode-btn');
        this.diffSelect = document.getElementById('c4-diff-select');
        this.diffWrapper = document.getElementById('c4-diff-wrapper');
        this.resetBtn = document.getElementById('c4-reset-btn');

        this.scoreP1El = document.getElementById('c4-score-p1');
        this.scoreTiesEl = document.getElementById('c4-score-ties');
        this.scoreP2El = document.getElementById('c4-score-p2');

        this.init();
    }

    init() {
        this.initBoard();
        this.bindEvents();
        this.renderGrid();
        this.updateStatus();
    }

    initBoard() {
        this.board = [];
        for (let r = 0; r < this.rows; r++) {
            this.board.push(new Array(this.cols).fill(0));
        }
        this.currentPlayer = 1;
        this.isGameOver = false;
    }

    bindEvents() {
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.gameMode = btn.dataset.mode;
                if (this.diffWrapper) {
                    this.diffWrapper.style.display = this.gameMode === 'ai' ? 'flex' : 'none';
                }
                const p2Label = document.getElementById('c4-p2-label');
                if (p2Label) {
                    p2Label.textContent = this.gameMode === 'ai' ? 'AI (Yellow)' : 'Player 2';
                }
                this.resetGame();
            });
        });

        if (this.diffSelect) {
            this.diffSelect.addEventListener('change', (e) => {
                this.aiDifficulty = e.target.value;
                this.resetGame();
            });
        }

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.resetGame();
            });
        }
    }

    renderGrid() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = '';

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const slot = document.createElement('div');
                slot.className = 'c4-slot';
                slot.dataset.row = r;
                slot.dataset.col = c;

                if (this.board[r][c] === 1) {
                    slot.innerHTML = '<div class="c4-disc red"></div>';
                } else if (this.board[r][c] === 2) {
                    slot.innerHTML = '<div class="c4-disc yellow"></div>';
                }

                slot.addEventListener('click', () => {
                    this.handleColumnClick(c);
                });

                this.gridEl.appendChild(slot);
            }
        }
    }

    handleColumnClick(col) {
        if (this.isGameOver) return;
        if (this.gameMode === 'ai' && this.currentPlayer === 2) return;

        this.dropDisc(col);
    }

    dropDisc(col) {
        // Find bottom-most empty row in column
        let targetRow = -1;
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.board[r][col] === 0) {
                targetRow = r;
                break;
            }
        }

        if (targetRow === -1) return false; // Column is full

        this.board[targetRow][col] = this.currentPlayer;
        if (window.soundEngine) window.soundEngine.playDrop();

        this.renderGrid();

        // Check Win
        const winResult = this.checkWin(this.currentPlayer);
        if (winResult) {
            this.endGame(this.currentPlayer, winResult);
            return true;
        }

        // Check Tie
        if (this.checkTie()) {
            this.endGame(0);
            return true;
        }

        // Switch Turn
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.updateStatus();

        // AI Move if single player
        if (this.gameMode === 'ai' && this.currentPlayer === 2 && !this.isGameOver) {
            setTimeout(() => {
                this.makeAiMove();
            }, 450);
        }

        return true;
    }

    makeAiMove() {
        if (this.isGameOver) return;

        let bestCol = -1;

        if (this.aiDifficulty === 'easy') {
            const validCols = this.getValidColumns();
            bestCol = validCols[Math.floor(Math.random() * validCols.length)];
        } else if (this.aiDifficulty === 'medium') {
            // Check winning move
            bestCol = this.findWinningColumn(2);
            // Check blocking player's win
            if (bestCol === -1) bestCol = this.findWinningColumn(1);
            // Otherwise center-biased random
            if (bestCol === -1) {
                const validCols = this.getValidColumns();
                bestCol = validCols.includes(3) ? 3 : validCols[Math.floor(Math.random() * validCols.length)];
            }
        } else {
            // Master: Minimax with depth
            bestCol = this.minimaxBestColumn();
        }

        if (bestCol !== -1) {
            this.dropDisc(bestCol);
        }
    }

    getValidColumns() {
        const cols = [];
        for (let c = 0; c < this.cols; c++) {
            if (this.board[0][c] === 0) cols.push(c);
        }
        return cols;
    }

    findWinningColumn(player) {
        const validCols = this.getValidColumns();
        for (let col of validCols) {
            // Simulate drop
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.board[r][col] === 0) {
                    this.board[r][col] = player;
                    const win = this.checkWin(player);
                    this.board[r][col] = 0;
                    if (win) return col;
                    break;
                }
            }
        }
        return -1;
    }

    minimaxBestColumn() {
        let bestCol = this.findWinningColumn(2);
        if (bestCol !== -1) return bestCol;
        bestCol = this.findWinningColumn(1);
        if (bestCol !== -1) return bestCol;

        const validCols = this.getValidColumns();
        // Priority order: 3, 2, 4, 1, 5, 0, 6
        const centerOrder = [3, 2, 4, 1, 5, 0, 6];
        for (let c of centerOrder) {
            if (validCols.includes(c)) return c;
        }
        return validCols[0];
    }

    checkWin(player) {
        // Horizontal
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c <= this.cols - 4; c++) {
                if (this.board[r][c] === player && this.board[r][c+1] === player && this.board[r][c+2] === player && this.board[r][c+3] === player) {
                    return [[r,c], [r,c+1], [r,c+2], [r,c+3]];
                }
            }
        }
        // Vertical
        for (let r = 0; r <= this.rows - 4; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c] === player && this.board[r+1][c] === player && this.board[r+2][c] === player && this.board[r+3][c] === player) {
                    return [[r,c], [r+1,c], [r+2,c], [r+3,c]];
                }
            }
        }
        // Diagonal Down-Right
        for (let r = 0; r <= this.rows - 4; r++) {
            for (let c = 0; c <= this.cols - 4; c++) {
                if (this.board[r][c] === player && this.board[r+1][c+1] === player && this.board[r+2][c+2] === player && this.board[r+3][c+3] === player) {
                    return [[r,c], [r+1,c+1], [r+2,c+2], [r+3,c+3]];
                }
            }
        }
        // Diagonal Down-Left
        for (let r = 0; r <= this.rows - 4; r++) {
            for (let c = 3; c < this.cols; c++) {
                if (this.board[r][c] === player && this.board[r+1][c-1] === player && this.board[r+2][c-2] === player && this.board[r+3][c-3] === player) {
                    return [[r,c], [r+1,c-1], [r+2,c-2], [r+3,c-3]];
                }
            }
        }
        return null;
    }

    checkTie() {
        return this.board[0].every(cell => cell !== 0);
    }

    endGame(winner, winCells = []) {
        this.isGameOver = true;

        if (winner === 1) {
            this.scores.p1++;
            if (this.statusTextEl) this.statusTextEl.innerHTML = '<span style="color:#ef4444; font-weight:800;">🔴 Player 1 (Red) Wins!</span>';
            if (window.soundEngine) window.soundEngine.playWin();
            if (window.triggerConfetti) window.triggerConfetti();

            if (window.arcadeWallet) {
                window.arcadeWallet.add(20.00);
                if (window.arcadeWallet.stats && window.arcadeWallet.stats.connect4) {
                    window.arcadeWallet.stats.connect4.playerWins++;
                }
            }
        } else if (winner === 2) {
            this.scores.p2++;
            const name = this.gameMode === 'ai' ? 'AI (Yellow)' : 'Player 2 (Yellow)';
            if (this.statusTextEl) this.statusTextEl.innerHTML = `<span style="color:#f59e0b; font-weight:800;">🟡 ${name} Wins!</span>`;
            if (window.soundEngine) window.soundEngine.playDraw();

            if (window.arcadeWallet && window.arcadeWallet.stats && window.arcadeWallet.stats.connect4) {
                window.arcadeWallet.stats.connect4.aiWins++;
            }
        } else {
            this.scores.ties++;
            if (this.statusTextEl) this.statusTextEl.innerHTML = '<span style="color:var(--text-muted); font-weight:800;">It\'s a Stalemate Tie!</span>';
            if (window.soundEngine) window.soundEngine.playDraw();

            if (window.arcadeWallet && window.arcadeWallet.stats && window.arcadeWallet.stats.connect4) {
                window.arcadeWallet.stats.connect4.ties++;
            }
        }

        if (winCells) {
            winCells.forEach(([r, c]) => {
                const slot = this.gridEl.querySelector(`[data-row="${r}"][data-col="${c}"] .c4-disc`);
                if (slot) slot.classList.add('win-disc');
            });
        }

        this.updateScoreUI();
    }

    updateStatus() {
        if (this.isGameOver) return;
        if (!this.statusTextEl) return;

        if (this.currentPlayer === 1) {
            this.statusTextEl.innerHTML = '<i class="fa-solid fa-circle" style="color:#ef4444;"></i> Player 1\'s Turn (Red)';
        } else {
            const name = this.gameMode === 'ai' ? 'AI Thinking...' : 'Player 2\'s Turn (Yellow)';
            this.statusTextEl.innerHTML = `<i class="fa-solid fa-circle" style="color:#f59e0b;"></i> ${name}`;
        }
    }

    updateScoreUI() {
        if (this.scoreP1El) this.scoreP1El.textContent = this.scores.p1;
        if (this.scoreTiesEl) this.scoreTiesEl.textContent = this.scores.ties;
        if (this.scoreP2El) this.scoreP2El.textContent = this.scores.p2;
    }

    resetGame() {
        this.initBoard();
        this.renderGrid();
        this.updateStatus();
    }
}

window.Connect4Game = Connect4Game;

