// Memory Match (Card Flip Pattern Acuity)
class MemoryGame {
    constructor() {
        this.gridEl = document.getElementById('memory-grid');
        this.movesEl = document.getElementById('memory-moves');
        this.timeEl = document.getElementById('memory-time');
        this.resetBtn = document.getElementById('memory-reset-btn');

        this.icons = [
            'fa-gamepad', 'fa-rocket', 'fa-shield-halved', 'fa-crown',
            'fa-bolt', 'fa-fire', 'fa-gem', 'fa-eye'
        ];

        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.moves = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.isProcessing = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.startNewGame();
    }

    bindEvents() {
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.startNewGame();
            });
        }
    }

    startNewGame() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timer = 0;
        this.moves = 0;
        this.matchedPairs = 0;
        this.flippedCards = [];
        this.isProcessing = false;

        if (this.movesEl) this.movesEl.textContent = '0';
        if (this.timeEl) this.timeEl.textContent = '00:00';

        // Duplicate and shuffle
        const deck = [...this.icons, ...this.icons];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        this.cards = deck;
        this.renderGrid();
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer++;
            const m = String(Math.floor(this.timer / 60)).padStart(2, '0');
            const s = String(this.timer % 60).padStart(2, '0');
            if (this.timeEl) this.timeEl.textContent = `${m}:${s}`;
        }, 1000);
    }

    renderGrid() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = '';

        this.cards.forEach((icon, idx) => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.dataset.idx = idx;
            card.dataset.icon = icon;

            card.innerHTML = `
                <div class="memory-card-inner">
                    <div class="memory-card-front"><i class="fa-solid fa-shapes"></i></div>
                    <div class="memory-card-back"><i class="fa-solid ${icon}"></i></div>
                </div>
            `;

            card.addEventListener('click', () => this.handleCardClick(card, idx));
            this.gridEl.appendChild(card);
        });
    }

    handleCardClick(card, idx) {
        if (this.isProcessing) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

        if (this.moves === 0 && this.timer === 0) {
            this.startTimer();
        }

        if (window.soundEngine) window.soundEngine.playCardFlip();
        card.classList.add('flipped');
        this.flippedCards.push({ card, idx, icon: card.dataset.icon });

        if (this.flippedCards.length === 2) {
            this.moves++;
            if (this.movesEl) this.movesEl.textContent = this.moves;
            this.checkMatch();
        }
    }

    checkMatch() {
        const [c1, c2] = this.flippedCards;
        this.isProcessing = true;

        if (c1.icon === c2.icon) {
            // Match
            setTimeout(() => {
                c1.card.classList.add('matched');
                c2.card.classList.add('matched');
                this.matchedPairs++;
                this.flippedCards = [];
                this.isProcessing = false;

                if (window.soundEngine) window.soundEngine.playSudokuPlace();

                if (this.matchedPairs === this.icons.length) {
                    this.handleWin();
                }
            }, 300);
        } else {
            // No match
            setTimeout(() => {
                c1.card.classList.remove('flipped');
                c2.card.classList.remove('flipped');
                this.flippedCards = [];
                this.isProcessing = false;
            }, 750);
        }
    }

    handleWin() {
        clearInterval(this.timerInterval);
        if (window.soundEngine) window.soundEngine.playWin();
        if (window.triggerConfetti) window.triggerConfetti();

        if (window.arcadeWallet) {
            window.arcadeWallet.add(25.00);
            if (window.arcadeWallet.stats && window.arcadeWallet.stats.memory) {
                window.arcadeWallet.stats.memory.completed++;
            }
        }

        if (window.showToast) {
            window.showToast('Memory Cleared! 🧠', `Completed in ${this.moves} moves and ${this.timer}s! Won +$25.00`, 'success');
        }
    }
}

window.MemoryGame = MemoryGame;

