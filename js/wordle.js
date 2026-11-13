// Wordle Master Game Logic
class WordleGame {
    constructor() {
        this.boardEl = document.getElementById('wordle-board');
        this.keyboardEl = document.getElementById('wordle-keyboard');
        this.newGameBtn = document.getElementById('btn-wordle-new');
        this.statusMsgEl = document.getElementById('wordle-status-msg');
        this.playedEl = document.getElementById('wordle-played');
        this.winPctEl = document.getElementById('wordle-winpct');
        this.streakEl = document.getElementById('wordle-streak');

        this.wordList = [
            'APPLE', 'BEACH', 'BRAIN', 'BREAD', 'BRICK', 'CABLE', 'CHAIR', 'CHESS', 'CLOUD', 'CROWN',
            'DANCE', 'DREAM', 'EAGLE', 'EARTH', 'FLAME', 'FLASH', 'FLOOR', 'FROST', 'GHOST', 'GLASS',
            'GRAPE', 'GREEN', 'HEART', 'HONEY', 'HOUSE', 'JUICE', 'KNIFE', 'LEMON', 'LIGHT', 'LUCKY',
            'MAGIC', 'MANGO', 'MONEY', 'MUSIC', 'NIGHT', 'OCEAN', 'PAINT', 'PAPER', 'PEACH', 'PHONE',
            'PIANO', 'PILOT', 'PIXEL', 'PLANT', 'PLATE', 'POWER', 'PRIDE', 'QUEEN', 'QUEST', 'RADIO',
            'RAPID', 'REACT', 'RIVER', 'ROBOT', 'ROUND', 'SHARK', 'SHINE', 'SHIRT', 'SMART', 'SMILE',
            'SNAKE', 'SOLAR', 'SPACE', 'SPARK', 'SPEED', 'SPOON', 'STAGE', 'STAR', 'STEEL', 'STORM',
            'SUGAR', 'SWEET', 'TABLE', 'TIGER', 'TOAST', 'TRAIN', 'TRUCK', 'TULIP', 'VIPER', 'VOICE',
            'WATER', 'WHEEL', 'WHITE', 'WORLD', 'YOUTH', 'ZEBRA', 'ALERT', 'BLOOM', 'CHARM', 'CRANE',
            'DRIFT', 'EMBER', 'FAITH', 'GLIDE', 'HASTE', 'IVORY', 'JOLLY', 'KNEEL', 'LATCH', 'MIRTH'
        ];

        this.maxGuesses = 6;
        this.wordLength = 5;
        this.targetWord = '';
        this.guesses = [];
        this.currentGuess = '';
        this.isGameOver = false;
        this.isActive = false;

        this.stats = this.loadStats();
        this.keyListener = this.handleKeyDown.bind(this);

        this.init();
    }

    init() {
        this.renderKeyboard();
        this.updateStatsDisplay();

        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => this.startNewGame());
        }

        this.startNewGame();
    }

    loadStats() {
        try {
            const raw = localStorage.getItem('arcade_wordle_stats');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { played: 0, won: 0, streak: 0, maxStreak: 0 };
    }

    saveStats() {
        try {
            localStorage.setItem('arcade_wordle_stats', JSON.stringify(this.stats));
        } catch (e) {}
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        if (this.playedEl) this.playedEl.textContent = this.stats.played;
        if (this.streakEl) this.streakEl.textContent = this.stats.streak;
        if (this.winPctEl) {
            const pct = this.stats.played > 0 ? Math.round((this.stats.won / this.stats.played) * 100) : 0;
            this.winPctEl.textContent = `${pct}%`;
        }
    }

    startNewGame() {
        this.targetWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
        this.guesses = [];
        this.currentGuess = '';
        this.isGameOver = false;

        this.renderBoard();
        this.resetKeyboardColors();
        this.showMessage('Guess the 5-letter hidden word!');
    }

    activate() {
        this.isActive = true;
        window.removeEventListener('keydown', this.keyListener);
        window.addEventListener('keydown', this.keyListener);
    }

    deactivate() {
        this.isActive = false;
        window.removeEventListener('keydown', this.keyListener);
    }

    renderBoard() {
        if (!this.boardEl) return;
        this.boardEl.innerHTML = '';

        for (let r = 0; r < this.maxGuesses; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'wordle-row';
            rowEl.dataset.row = r;

            for (let c = 0; c < this.wordLength; c++) {
                const cellEl = document.createElement('div');
                cellEl.className = 'wordle-cell';
                cellEl.dataset.col = c;
                rowEl.appendChild(cellEl);
            }
            this.boardEl.appendChild(rowEl);
        }
    }

    renderKeyboard() {
        if (!this.keyboardEl) return;
        this.keyboardEl.innerHTML = '';

        const rows = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
        ];

        rows.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'wordle-kb-row';

            row.forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'wordle-key';
                btn.dataset.key = key;
                btn.textContent = key === 'DEL' ? '⌫' : key;
                if (key === 'ENTER' || key === 'DEL') {
                    btn.classList.add('wide');
                }

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleInput(key);
                });
                rowEl.appendChild(btn);
            });

            this.keyboardEl.appendChild(rowEl);
        });
    }

    resetKeyboardColors() {
        const keys = this.keyboardEl?.querySelectorAll('.wordle-key');
        if (keys) {
            keys.forEach(k => {
                k.classList.remove('correct', 'present', 'absent');
            });
        }
    }

    handleKeyDown(e) {
        if (!this.isActive || this.isGameOver) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

        const key = e.key.toUpperCase();
        if (key === 'ENTER') {
            e.preventDefault();
            this.handleInput('ENTER');
        } else if (key === 'BACKSPACE') {
            e.preventDefault();
            this.handleInput('DEL');
        } else if (/^[A-Z]$/.test(key)) {
            e.preventDefault();
            this.handleInput(key);
        }
    }

    handleInput(key) {
        if (this.isGameOver) return;

        if (key === 'DEL' || key === 'BACKSPACE') {
            if (this.currentGuess.length > 0) {
                this.currentGuess = this.currentGuess.slice(0, -1);
                this.updateCurrentRowDisplay();
                if (window.arcadeAudio) window.arcadeAudio.playWordKey();
            }
            return;
        }

        if (key === 'ENTER') {
            this.submitGuess();
            return;
        }

        if (/^[A-Z]$/.test(key) && this.currentGuess.length < this.wordLength) {
            this.currentGuess += key;
            this.updateCurrentRowDisplay();
            if (window.arcadeAudio) window.arcadeAudio.playWordKey();
        }
    }

    updateCurrentRowDisplay() {
        const rowIndex = this.guesses.length;
        const rowEl = this.boardEl?.querySelector(`.wordle-row[data-row="${rowIndex}"]`);
        if (!rowEl) return;

        const cells = rowEl.querySelectorAll('.wordle-cell');
        for (let i = 0; i < this.wordLength; i++) {
            const char = this.currentGuess[i] || '';
            cells[i].textContent = char;
            if (char) {
                cells[i].classList.add('pop');
                setTimeout(() => cells[i].classList.remove('pop'), 120);
            }
        }
    }

    submitGuess() {
        if (this.currentGuess.length < this.wordLength) {
            this.showMessage('Not enough letters (need 5)');
            return;
        }

        const guess = this.currentGuess;
        const rowIndex = this.guesses.length;
        const rowEl = this.boardEl?.querySelector(`.wordle-row[data-row="${rowIndex}"]`);
        const cells = rowEl ? rowEl.querySelectorAll('.wordle-cell') : [];

        // Evaluate letter positions (handles duplicate letters correctly)
        const targetLetters = this.targetWord.split('');
        const guessLetters = guess.split('');
        const results = new Array(this.wordLength).fill('absent');

        // Pass 1: exact matches (greens)
        for (let i = 0; i < this.wordLength; i++) {
            if (guessLetters[i] === targetLetters[i]) {
                results[i] = 'correct';
                targetLetters[i] = null;
            }
        }

        // Pass 2: misplaced matches (yellows)
        for (let i = 0; i < this.wordLength; i++) {
            if (results[i] === 'correct') continue;
            const targetIdx = targetLetters.indexOf(guessLetters[i]);
            if (targetIdx !== -1) {
                results[i] = 'present';
                targetLetters[targetIdx] = null;
            }
        }

        // Animate row flip
        for (let i = 0; i < this.wordLength; i++) {
            setTimeout(() => {
                if (cells[i]) {
                    cells[i].classList.add('flip');
                    cells[i].classList.add(results[i]);
                }
                this.updateKeyboardKey(guessLetters[i], results[i]);
            }, i * 200);
        }

        this.guesses.push(guess);
        this.currentGuess = '';

        setTimeout(() => {
            if (guess === this.targetWord) {
                this.handleWin();
            } else if (this.guesses.length >= this.maxGuesses) {
                this.handleLoss();
            }
        }, this.wordLength * 200 + 100);
    }

    updateKeyboardKey(letter, state) {
        const keyEl = this.keyboardEl?.querySelector(`.wordle-key[data-key="${letter}"]`);
        if (!keyEl) return;

        // Correct trumps present, present trumps absent
        if (state === 'correct') {
            keyEl.classList.remove('present', 'absent');
            keyEl.classList.add('correct');
        } else if (state === 'present' && !keyEl.classList.contains('correct')) {
            keyEl.classList.remove('absent');
            keyEl.classList.add('present');
        } else if (state === 'absent' && !keyEl.classList.contains('correct') && !keyEl.classList.contains('present')) {
            keyEl.classList.add('absent');
        }
    }

    handleWin() {
        this.isGameOver = true;
        this.stats.played++;
        this.stats.won++;
        this.stats.streak++;
        if (this.stats.streak > this.stats.maxStreak) {
            this.stats.maxStreak = this.stats.streak;
        }
        this.saveStats();

        const prize = 15;
        if (window.arcadeWallet) {
            window.arcadeWallet.recordWin('wordle', prize);
        }
        if (window.arcadeAudio) window.arcadeAudio.playWin();

        const msgs = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
        const praise = msgs[this.guesses.length - 1] || 'Well Done!';
        this.showMessage(`🎉 ${praise} Solved in ${this.guesses.length}/6! (+${prize} chips)`);
    }

    handleLoss() {
        this.isGameOver = true;
        this.stats.played++;
        this.stats.streak = 0;
        this.saveStats();

        if (window.arcadeWallet) {
            window.arcadeWallet.recordLoss('wordle', 0);
        }
        if (window.arcadeAudio) window.arcadeAudio.playLoss();

        this.showMessage(`Word was: ${this.targetWord}. Better luck next time!`);
    }

    showMessage(msg) {
        if (this.statusMsgEl) {
            this.statusMsgEl.textContent = msg;
        }
    }
}

window.WordleGame = WordleGame;

