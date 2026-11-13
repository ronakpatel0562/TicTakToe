// Aesthetic & Complete Sudoku Generator, Solver, and Interactive Controller
class SudokuGame {
    constructor() {
        this.board = Array(9).fill(null).map(() => Array(9).fill(0));
        this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
        this.initialBoard = Array(9).fill(null).map(() => Array(9).fill(0));
        this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));
        
        this.selectedCell = null; // { row, col }
        this.notesMode = false;
        this.difficulty = 'medium'; // 'easy', 'medium', 'hard', 'expert'
        this.mistakes = 0;
        this.maxMistakes = 3;
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.isGameOver = false;
        this.history = [];

        this.initDOM();
    }

    initDOM() {
        this.gridElement = document.getElementById('sudoku-grid');
        this.timerElement = document.getElementById('sudoku-timer');
        this.mistakesElement = document.getElementById('sudoku-mistakes');
        this.pauseBtn = document.getElementById('sudoku-pause-btn');
        this.newGameBtn = document.getElementById('sudoku-new-game-btn');
        this.diffSelector = document.getElementById('sudoku-diff-select');
        this.notesBtn = document.getElementById('sudoku-notes-toggle');
        this.eraseBtn = document.getElementById('sudoku-erase-btn');
        this.hintBtn = document.getElementById('sudoku-hint-btn');
        this.undoBtn = document.getElementById('sudoku-undo-btn');
        this.numpadButtons = document.querySelectorAll('.sudoku-numpad-btn');

        if (!this.gridElement) return;

        this.buildGridDOM();
        this.bindEvents();
        this.startNewGame();
    }

    buildGridDOM() {
        this.gridElement.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                // Add thick borders for 3x3 blocks
                if (r % 3 === 0 && r !== 0) cell.classList.add('border-top-thick');
                if (c % 3 === 0 && c !== 0) cell.classList.add('border-left-thick');

                // Value container
                const valSpan = document.createElement('span');
                valSpan.className = 'cell-value';
                cell.appendChild(valSpan);

                // Notes grid container (3x3 mini grid)
                const notesGrid = document.createElement('div');
                notesGrid.className = 'cell-notes-grid';
                for (let n = 1; n <= 9; n++) {
                    const noteItem = document.createElement('span');
                    noteItem.className = `note-item note-${n}`;
                    noteItem.textContent = n;
                    notesGrid.appendChild(noteItem);
                }
                cell.appendChild(notesGrid);

                cell.addEventListener('click', () => this.selectCell(r, c));
                this.gridElement.appendChild(cell);
            }
        }
    }

    bindEvents() {
        // Numpad clicks
        if (this.numpadButtons) {
            this.numpadButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseInt(btn.dataset.num);
                    if (val) this.inputNumber(val);
                });
            });
        }

        // Actions
        if (this.notesBtn) {
            this.notesBtn.addEventListener('click', () => this.toggleNotes());
        }
        if (this.eraseBtn) {
            this.eraseBtn.addEventListener('click', () => this.eraseSelected());
        }
        if (this.hintBtn) {
            this.hintBtn.addEventListener('click', () => this.giveHint());
        }
        if (this.undoBtn) {
            this.undoBtn.addEventListener('click', () => this.undo());
        }
        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.startNewGame();
            });
        }
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.togglePause());
        }
        if (this.diffSelector) {
            this.diffSelector.addEventListener('change', (e) => {
                this.difficulty = e.target.value;
                this.startNewGame();
            });
        }

        // Keyboard bindings
        window.addEventListener('keydown', (e) => {
            const sudokuView = document.getElementById('view-sudoku');
            if (!sudokuView || !sudokuView.classList.contains('active')) return;
            if (this.isPaused || this.isGameOver) return;

            if (e.key >= '1' && e.key <= '9') {
                this.inputNumber(parseInt(e.key));
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                this.eraseSelected();
            } else if (e.key.toLowerCase() === 'n') {
                this.toggleNotes();
            } else if (e.key.toLowerCase() === 'h') {
                this.giveHint();
            } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
                this.undo();
            } else if (e.key.startsWith('Arrow')) {
                this.handleArrowKey(e.key);
                e.preventDefault();
            }
        });
    }

    handleArrowKey(key) {
        if (!this.selectedCell) {
            this.selectCell(0, 0);
            return;
        }
        let { row, col } = this.selectedCell;
        if (key === 'ArrowUp') row = (row - 1 + 9) % 9;
        if (key === 'ArrowDown') row = (row + 1) % 9;
        if (key === 'ArrowLeft') col = (col - 1 + 9) % 9;
        if (key === 'ArrowRight') col = (col + 1) % 9;
        this.selectCell(row, col);
    }

    startNewGame() {
        this.isGameOver = false;
        this.isPaused = false;
        this.mistakes = 0;
        this.history = [];
        this.updateMistakesDisplay();
        this.generatePuzzle(this.difficulty);
        this.startTimer();
        this.renderBoard();
        this.selectCell(4, 4); // Select center
    }

    // --- Generation & Solver ---
    generatePuzzle(difficulty) {
        // Clear board
        this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
        this.fillDiagonalBlocks();
        this.solveSudoku(this.solution);

        // Copy solution to working board
        this.board = this.solution.map(row => [...row]);
        this.notes = Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()));

        // Number of clues to remove based on difficulty
        let attempts;
        switch (difficulty) {
            case 'easy': attempts = 38; break; // ~43 clues remain
            case 'medium': attempts = 48; break; // ~33 clues remain
            case 'hard': attempts = 54; break; // ~27 clues remain
            case 'expert': attempts = 58; break; // ~23 clues remain
            default: attempts = 46;
        }

        while (attempts > 0) {
            let row = Math.floor(Math.random() * 9);
            let col = Math.floor(Math.random() * 9);
            while (this.board[row][col] === 0) {
                row = Math.floor(Math.random() * 9);
                col = Math.floor(Math.random() * 9);
            }
            this.board[row][col] = 0;
            attempts--;
        }

        this.initialBoard = this.board.map(row => [...row]);
    }

    fillDiagonalBlocks() {
        for (let i = 0; i < 9; i += 3) {
            this.fillBox(i, i);
        }
    }

    fillBox(row, col) {
        let num;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                do {
                    num = Math.floor(Math.random() * 9) + 1;
                } while (!this.isSafeInBox(this.solution, row, col, num));
                this.solution[row + i][col + j] = num;
            }
        }
    }

    isSafeInBox(grid, startRow, startCol, num) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[startRow + i][startCol + j] === num) return false;
            }
        }
        return true;
    }

    isValidMove(grid, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (grid[row][i] === num) return false;
            if (grid[i][col] === num) return false;
        }
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[boxRow + i][boxCol + j] === num) return false;
            }
        }
        return true;
    }

    solveSudoku(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                    for (let num of numbers) {
                        if (this.isValidMove(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (this.solveSudoku(grid)) return true;
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // --- Interaction & Rendering ---
    selectCell(row, col) {
        if (this.isPaused) return;
        this.selectedCell = { row, col };
        this.highlightBoard();
        window.soundEngine.playClick();
    }

    highlightBoard() {
        const cells = this.gridElement.querySelectorAll('.sudoku-cell');
        if (!this.selectedCell) {
            cells.forEach(c => c.classList.remove('selected', 'highlighted', 'same-digit', 'conflict'));
            return;
        }

        const { row, col } = this.selectedCell;
        const selectedValue = this.board[row][col];
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        cells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            const val = this.board[r][c];

            cell.classList.remove('selected', 'highlighted', 'same-digit', 'conflict');

            if (r === row && c === col) {
                cell.classList.add('selected');
            } else if (r === row || c === col || (r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3)) {
                cell.classList.add('highlighted');
            }

            if (selectedValue > 0 && val === selectedValue) {
                cell.classList.add('same-digit');
            }
        });
    }

    inputNumber(num) {
        if (!this.selectedCell || this.isPaused || this.isGameOver) return;
        const { row, col } = this.selectedCell;

        // Cannot overwrite initial clue
        if (this.initialBoard[row][col] !== 0) return;

        if (this.notesMode) {
            // Notes toggle
            const cellNotes = this.notes[row][col];
            if (cellNotes.has(num)) {
                cellNotes.delete(num);
            } else {
                cellNotes.add(num);
            }
            window.soundEngine.playSudokuPlace();
            this.renderCell(row, col);
            return;
        }

        // Normal input mode
        if (this.board[row][col] === num) {
            return; // Already has this number
        }

        // Save history for undo
        this.history.push({
            row, col,
            prevVal: this.board[row][col],
            prevNotes: new Set(this.notes[row][col]),
            newVal: num
        });

        // Clear notes for this cell when a number is placed
        this.notes[row][col].clear();
        this.board[row][col] = num;

        // Verify if correct
        if (this.solution[row][col] !== num) {
            // Mistake
            this.mistakes++;
            this.updateMistakesDisplay();
            window.soundEngine.playSudokuError();

            const cellElem = this.getCellElement(row, col);
            cellElem.classList.add('error');
            setTimeout(() => cellElem.classList.remove('error'), 700);

            if (this.mistakes >= this.maxMistakes) {
                this.handleGameOver();
                return;
            }
        } else {
            window.soundEngine.playSudokuPlace();
            // Remove this number from notes in same row, column, and box!
            this.cleanCandidateNotes(row, col, num);
        }

        this.renderCell(row, col);
        this.highlightBoard();
        this.checkWinCondition();
    }

    cleanCandidateNotes(row, col, num) {
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 9; i++) {
            this.notes[row][i].delete(num);
            this.notes[i][col].delete(num);
        }
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                this.notes[boxRow + r][boxCol + c].delete(num);
            }
        }
        this.renderBoard();
    }

    eraseSelected() {
        if (!this.selectedCell || this.isPaused || this.isGameOver) return;
        const { row, col } = this.selectedCell;

        if (this.initialBoard[row][col] !== 0) return;

        if (this.board[row][col] !== 0 || this.notes[row][col].size > 0) {
            this.history.push({
                row, col,
                prevVal: this.board[row][col],
                prevNotes: new Set(this.notes[row][col]),
                newVal: 0
            });

            this.board[row][col] = 0;
            this.notes[row][col].clear();
            window.soundEngine.playSudokuErase();
            this.renderCell(row, col);
            this.highlightBoard();
        }
    }

    giveHint() {
        if (this.isPaused || this.isGameOver) return;
        
        // Find selected cell or first empty/wrong cell
        let targetRow = -1, targetCol = -1;
        if (this.selectedCell && this.initialBoard[this.selectedCell.row][this.selectedCell.col] === 0 && this.board[this.selectedCell.row][this.selectedCell.col] !== this.solution[this.selectedCell.row][this.selectedCell.col]) {
            targetRow = this.selectedCell.row;
            targetCol = this.selectedCell.col;
        } else {
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (this.board[r][c] !== this.solution[r][c]) {
                        targetRow = r;
                        targetCol = c;
                        break;
                    }
                }
                if (targetRow !== -1) break;
            }
        }

        if (targetRow !== -1) {
            const correctNum = this.solution[targetRow][targetCol];
            this.board[targetRow][targetCol] = correctNum;
            this.notes[targetRow][targetCol].clear();
            this.cleanCandidateNotes(targetRow, targetCol, correctNum);
            
            const cellElem = this.getCellElement(targetRow, targetCol);
            cellElem.classList.add('hinted');
            setTimeout(() => cellElem.classList.remove('hinted'), 1200);

            window.soundEngine.playWin();
            this.selectCell(targetRow, targetCol);
            this.renderCell(targetRow, targetCol);
            this.checkWinCondition();
        }
    }

    undo() {
        if (!this.history.length || this.isPaused || this.isGameOver) return;
        const lastAction = this.history.pop();
        this.board[lastAction.row][lastAction.col] = lastAction.prevVal;
        this.notes[lastAction.row][lastAction.col] = lastAction.prevNotes;
        this.selectCell(lastAction.row, lastAction.col);
        this.renderCell(lastAction.row, lastAction.col);
        this.highlightBoard();
        window.soundEngine.playClick();
    }

    toggleNotes() {
        this.notesMode = !this.notesMode;
        if (this.notesBtn) {
            this.notesBtn.classList.toggle('active', this.notesMode);
        }
        window.soundEngine.playClick();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = this.isPaused ? '<i class="fa-solid fa-play"></i> Resume' : '<i class="fa-solid fa-pause"></i> Pause';
        }
        if (this.gridElement) {
            this.gridElement.classList.toggle('board-paused', this.isPaused);
        }
    }

    checkWinCondition() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] !== this.solution[r][c]) return;
            }
        }

        // Win!
        this.isGameOver = true;
        this.stopTimer();
        window.soundEngine.playWin();

        if (window.arcadeWallet) {
            window.arcadeWallet.stats.sudoku.gamesCompleted++;
            if (!window.arcadeWallet.stats.sudoku.bestTime || this.timerSeconds < window.arcadeWallet.stats.sudoku.bestTime) {
                window.arcadeWallet.stats.sudoku.bestTime = this.timerSeconds;
            }
            window.arcadeWallet.saveStats();
        }

        // Show victory celebration
        if (window.triggerConfetti) {
            window.triggerConfetti();
        }
        if (window.showToast) {
            window.showToast('Sudoku Completed! 🎉', `Solved ${this.difficulty.toUpperCase()} in ${this.formatTime(this.timerSeconds)}!`, 'success');
        }
    }

    handleGameOver() {
        this.isGameOver = true;
        this.stopTimer();
        if (window.showToast) {
            window.showToast('Game Over ❌', 'You reached 3 mistakes. Click "New Game" to try again!', 'error');
        }
    }

    startTimer() {
        this.stopTimer();
        this.timerSeconds = 0;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && !this.isGameOver) {
                this.timerSeconds++;
                this.updateTimerDisplay();
            }
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
        if (this.timerElement) {
            this.timerElement.textContent = this.formatTime(this.timerSeconds);
        }
    }

    updateMistakesDisplay() {
        if (this.mistakesElement) {
            this.mistakesElement.textContent = `${this.mistakes}/${this.maxMistakes}`;
        }
    }

    renderBoard() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                this.renderCell(r, c);
            }
        }
    }

    renderCell(row, col) {
        const cell = this.getCellElement(row, col);
        if (!cell) return;

        const valSpan = cell.querySelector('.cell-value');
        const notesGrid = cell.querySelector('.cell-notes-grid');
        const val = this.board[row][col];
        const isClue = this.initialBoard[row][col] !== 0;

        cell.classList.remove('clue', 'user-digit', 'error');
        if (isClue) {
            cell.classList.add('clue');
        } else if (val !== 0) {
            cell.classList.add('user-digit');
            if (val !== this.solution[row][col]) {
                cell.classList.add('error');
            }
        }

        if (val !== 0) {
            valSpan.textContent = val;
            notesGrid.style.display = 'none';
        } else {
            valSpan.textContent = '';
            notesGrid.style.display = 'grid';
            const cellNotes = this.notes[row][col];
            for (let n = 1; n <= 9; n++) {
                const noteElem = notesGrid.querySelector(`.note-${n}`);
                if (noteElem) {
                    noteElem.style.visibility = cellNotes.has(n) ? 'visible' : 'hidden';
                }
            }
        }
    }

    getCellElement(row, col) {
        return this.gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }
}

window.SudokuGame = SudokuGame;

