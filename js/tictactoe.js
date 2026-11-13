// Modern Aesthetic Tic-Tac-Toe Game Engine with Minimax AI
class TicTacToeGame {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.gameMode = 'ai'; // 'pvp' or 'ai'
        this.aiDifficulty = 'unbeatable'; // 'easy', 'medium', 'unbeatable'
        this.aiPlayer = 'O';
        this.humanPlayer = 'X';
        this.scores = { X: 0, O: 0, ties: 0 };
        this.winningLines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]             // diagonals
        ];

        this.initDOM();
    }

    initDOM() {
        this.cells = document.querySelectorAll('.ttt-cell');
        this.statusText = document.getElementById('ttt-status');
        this.turnIndicator = document.getElementById('ttt-turn-badge');
        this.scoreX = document.getElementById('ttt-score-x');
        this.scoreO = document.getElementById('ttt-score-o');
        this.scoreTies = document.getElementById('ttt-score-ties');
        this.strikeLine = document.getElementById('ttt-strike-line');
        this.modeButtons = document.querySelectorAll('.ttt-mode-btn');
        this.diffSelector = document.getElementById('ttt-difficulty-select');
        this.diffContainer = document.getElementById('ttt-difficulty-container');
        this.resetBtn = document.getElementById('ttt-reset-btn');

        if (!this.cells.length) return;

        this.cells.forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.resetGame();
            });
        }

        if (this.modeButtons) {
            this.modeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    window.soundEngine.playClick();
                    this.modeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.gameMode = btn.dataset.mode;
                    if (this.diffContainer) {
                        this.diffContainer.style.display = this.gameMode === 'ai' ? 'flex' : 'none';
                    }
                    this.resetGame();
                });
            });
        }

        if (this.diffSelector) {
            this.diffSelector.addEventListener('change', (e) => {
                this.aiDifficulty = e.target.value;
                this.resetGame();
            });
        }

        this.updateScoreDisplay();
        this.resetGame();
    }

    handleCellClick(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        if (this.board[index] !== null || !this.gameActive) return;

        // If it's AI mode and not human turn, ignore
        if (this.gameMode === 'ai' && this.currentPlayer !== this.humanPlayer) return;

        this.makeMove(index, this.currentPlayer);

        if (this.gameActive && this.gameMode === 'ai' && this.currentPlayer === this.aiPlayer) {
            // Slight delay for natural AI feel
            setTimeout(() => this.makeAIMove(), 350);
        }
    }

    makeMove(index, player) {
        this.board[index] = player;
        const cell = this.cells[index];
        cell.classList.add('taken', player.toLowerCase());
        cell.innerHTML = player === 'X' ? this.getXIcon() : this.getOIcon();

        window.soundEngine.playMove(player === 'O');
        this.spawnCellSparks(cell, player);

        const winResult = this.checkWin(this.board);

        if (winResult) {
            this.handleWin(winResult);
        } else if (this.isBoardFull(this.board)) {
            this.handleDraw();
        } else {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            this.updateTurnUI();
        }
    }

    makeAIMove() {
        if (!this.gameActive) return;

        let bestIndex;
        if (this.aiDifficulty === 'easy') {
            const available = this.getEmptyIndices(this.board);
            bestIndex = available[Math.floor(Math.random() * available.length)];
        } else if (this.aiDifficulty === 'medium') {
            // 50% smart, 50% random
            if (Math.random() < 0.5) {
                const available = this.getEmptyIndices(this.board);
                bestIndex = available[Math.floor(Math.random() * available.length)];
            } else {
                bestIndex = this.getBestMoveMinimax();
            }
        } else {
            // Unbeatable minimax
            bestIndex = this.getBestMoveMinimax();
        }

        if (bestIndex !== undefined && bestIndex !== null) {
            this.makeMove(bestIndex, this.aiPlayer);
        }
    }

    getBestMoveMinimax() {
        // Fast Minimax implementation
        let bestVal = -Infinity;
        let bestMove = -1;
        const emptyCells = this.getEmptyIndices(this.board);

        // If board is empty, pick center or corner fast
        if (emptyCells.length === 9) return 4;
        if (emptyCells.length === 8 && this.board[4] === null) return 4;

        for (let idx of emptyCells) {
            this.board[idx] = this.aiPlayer;
            let moveVal = this.minimax(this.board, 0, false, -Infinity, Infinity);
            this.board[idx] = null;
            if (moveVal > bestVal) {
                bestVal = moveVal;
                bestMove = idx;
            }
        }
        return bestMove;
    }

    minimax(board, depth, isMaximizing, alpha, beta) {
        const win = this.checkWin(board);
        if (win) {
            return win.player === this.aiPlayer ? (10 - depth) : (depth - 10);
        }
        if (this.isBoardFull(board)) return 0;
        if (depth >= 6) return 0; // Optimization limit

        const empty = this.getEmptyIndices(board);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let idx of empty) {
                board[idx] = this.aiPlayer;
                let evaluation = this.minimax(board, depth + 1, false, alpha, beta);
                board[idx] = null;
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let idx of empty) {
                board[idx] = this.humanPlayer;
                let evaluation = this.minimax(board, depth + 1, true, alpha, beta);
                board[idx] = null;
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    checkWin(board) {
        for (let i = 0; i < this.winningLines.length; i++) {
            const [a, b, c] = this.winningLines[i];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { player: board[a], lineIndex: i, indices: [a, b, c] };
            }
        }
        return null;
    }

    isBoardFull(board) {
        return board.every(cell => cell !== null);
    }

    getEmptyIndices(board) {
        return board.map((v, i) => v === null ? i : null).filter(v => v !== null);
    }

    handleWin(winResult) {
        this.gameActive = false;
        this.scores[winResult.player]++;
        this.updateScoreDisplay();
        this.drawStrikeLine(winResult.lineIndex);

        winResult.indices.forEach(idx => {
            this.cells[idx].classList.add('win-cell');
        });

        window.soundEngine.playWin();

        const playerName = this.gameMode === 'ai' 
            ? (winResult.player === this.humanPlayer ? 'You Won! 🎉' : 'AI Won! 🤖')
            : `Player ${winResult.player} Won! 🎉`;

        this.statusText.innerHTML = `<span class="win-text ${winResult.player.toLowerCase()}">${playerName}</span>`;
        this.turnIndicator.className = 'ttt-turn-badge win';
        this.turnIndicator.textContent = 'WINNER';

        if (window.arcadeWallet && winResult.player === this.humanPlayer) {
            window.arcadeWallet.stats.tictactoe.xWins++;
            window.arcadeWallet.saveStats();
        }

        if (window.triggerConfetti && (this.gameMode === 'pvp' || winResult.player === this.humanPlayer)) {
            window.triggerConfetti();
        }
        if (window.showToast) {
            window.showToast('Round Winner! 🏆', playerName, 'info');
        }
    }

    handleDraw() {
        this.gameActive = false;
        this.scores.ties++;
        this.updateScoreDisplay();
        window.soundEngine.playDraw();

        this.statusText.innerHTML = `<span class="draw-text">It's a Draw! 🤝</span>`;
        this.turnIndicator.className = 'ttt-turn-badge tie';
        this.turnIndicator.textContent = 'DRAW';

        if (window.arcadeWallet) {
            window.arcadeWallet.stats.tictactoe.ties++;
            window.arcadeWallet.saveStats();
        }
    }

    drawStrikeLine(lineIndex) {
        if (!this.strikeLine) return;
        this.strikeLine.className = 'ttt-strike-line active';
        
        // Define classes matching CSS coordinate transforms
        const lineClasses = [
            'row-0', 'row-1', 'row-2',
            'col-0', 'col-1', 'col-2',
            'diag-main', 'diag-anti'
        ];
        this.strikeLine.classList.add(lineClasses[lineIndex]);
    }

    resetGame() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.gameActive = true;

        if (this.strikeLine) {
            this.strikeLine.className = 'ttt-strike-line';
        }

        this.cells.forEach(cell => {
            cell.className = 'ttt-cell';
            cell.innerHTML = '';
        });

        this.updateTurnUI();
    }

    resetScores() {
        this.scores = { X: 0, O: 0, ties: 0 };
        this.updateScoreDisplay();
        this.resetGame();
    }

    updateTurnUI() {
        if (!this.gameActive) return;
        const isX = this.currentPlayer === 'X';
        const label = this.gameMode === 'ai' 
            ? (isX ? 'Your Turn (X)' : 'AI Thinking... (O)')
            : `Player ${this.currentPlayer}'s Turn`;

        this.statusText.textContent = label;
        this.turnIndicator.className = `ttt-turn-badge ${this.currentPlayer.toLowerCase()}`;
        this.turnIndicator.textContent = `${this.currentPlayer} TURN`;
    }

    updateScoreDisplay() {
        if (this.scoreX) this.scoreX.textContent = this.scores.X;
        if (this.scoreO) this.scoreO.textContent = this.scores.O;
        if (this.scoreTies) this.scoreTies.textContent = this.scores.ties;
    }

    spawnCellSparks(cell, player) {
        const rect = cell.getBoundingClientRect();
        const color = player === 'X' ? '#00f2fe' : '#f72585';
        for (let i = 0; i < 8; i++) {
            const spark = document.createElement('div');
            spark.className = 'ttt-spark';
            spark.style.setProperty('--spark-color', color);
            const angle = (Math.PI * 2 / 8) * i;
            const dist = 35 + Math.random() * 25;
            spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
            spark.style.left = `${rect.width / 2}px`;
            spark.style.top = `${rect.height / 2}px`;
            cell.appendChild(spark);
            setTimeout(() => spark.remove(), 600);
        }
    }

    getXIcon() {
        return `
            <svg class="ttt-symbol x" viewBox="0 0 100 100">
                <line x1="22" y1="22" x2="78" y2="78" stroke="var(--color-accent, #3b82f6)" stroke-width="12" stroke-linecap="round" />
                <line x1="78" y1="22" x2="22" y2="78" stroke="var(--color-accent, #3b82f6)" stroke-width="12" stroke-linecap="round" />
            </svg>
        `;
    }

    getOIcon() {
        return `
            <svg class="ttt-symbol o" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="30" stroke="var(--color-danger, #ef4444)" stroke-width="11" fill="none" stroke-linecap="round" />
            </svg>
        `;
    }
}

window.TicTacToeGame = TicTacToeGame;

