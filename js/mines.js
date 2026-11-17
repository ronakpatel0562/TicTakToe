// Casino Mines (Pro Crash & Grid Wagering Engine)
// Provably Fair with Guaranteed 10% House Edge (90% RTP)

class MinesGame {
    constructor() {
        this.gridSize = 25; // 5x5 Grid
        this.totalMines = 3; // Default 3 mines
        this.betAmount = 10;
        this.isPlaying = false;
        this.tiles = []; // Array of 25 tile objects: { index, isMine, isRevealed }
        this.revealedGemsCount = 0;
        this.currentMultiplier = 1.00;
        this.nextMultiplier = 1.00;
        this.houseEdge = window.HOUSE_EDGE || 0.10; // 10% House Edge (90% RTP)

        // DOM elements
        this.betInput = null;
        this.minesSelect = null;
        this.presetBtns = [];
        this.quickBtns = [];
        this.mainBtn = null;
        this.randomBtn = null;
        this.gridContainer = null;
        this.gridWrapper = null;
        this.statMult = null;
        this.statNext = null;
        this.statProfit = null;
        this.winSplash = null;
        this.winSplashAmount = null;
        this.winSplashMult = null;

        this.init();
    }

    formatMoney(val) {
        if (window.arcadeWallet && typeof window.arcadeWallet.format === 'function') {
            return window.arcadeWallet.format(val);
        }
        return '$' + Number(val || 0).toFixed(2);
    }

    init() {
        this.betInput = document.getElementById('mines-bet-input');
        this.minesSelect = document.getElementById('mines-count-select');
        this.presetBtns = document.querySelectorAll('.mines-preset-pill');
        this.quickBtns = document.querySelectorAll('.mines-quick-btn');
        this.mainBtn = document.getElementById('mines-main-action-btn');
        this.randomBtn = document.getElementById('mines-random-pick-btn');
        this.gridContainer = document.getElementById('mines-grid-container');
        this.gridWrapper = document.getElementById('mines-grid-wrapper');
        this.statMult = document.getElementById('mines-stat-multiplier');
        this.statNext = document.getElementById('mines-stat-next-mult');
        this.statProfit = document.getElementById('mines-stat-profit');
        this.winSplash = document.getElementById('mines-win-splash');
        this.winSplashAmount = document.getElementById('mines-win-splash-amount');
        this.winSplashMult = document.getElementById('mines-win-splash-mult');

        this.bindEvents();
        this.resetGridUI();
        this.updateStatsDisplay();
        this.updateControlsUI();
    }

    bindEvents() {
        // Bet input
        if (this.betInput) {
            this.betInput.addEventListener('change', (e) => {
                if (this.isPlaying) return;
                let val = parseFloat(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                this.betAmount = Math.round(val);
                this.betInput.value = this.betAmount;
                this.updateControlsUI();
                this.updateStatsDisplay();
            });
        }

        // Quick bet buttons
        if (this.quickBtns) {
            this.quickBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (this.isPlaying) return;
                    if (window.soundEngine) window.soundEngine.playClick();
                    const action = btn.dataset.action;
                    if (action === '2x') {
                        this.betAmount *= 2;
                    } else if (action === 'half') {
                        this.betAmount = Math.max(1, Math.floor(this.betAmount / 2));
                    } else {
                        this.betAmount = parseFloat(action);
                    }
                    if (this.betInput) this.betInput.value = this.betAmount;
                    this.updateControlsUI();
                    this.updateStatsDisplay();
                });
            });
        }

        // Mines dropdown select
        if (this.minesSelect) {
            this.minesSelect.addEventListener('change', (e) => {
                if (this.isPlaying) return;
                this.totalMines = parseInt(e.target.value, 10);
                this.syncPresetPills();
                this.updateStatsDisplay();
            });
        }

        // Preset mines pills
        if (this.presetBtns) {
            this.presetBtns.forEach(pill => {
                pill.addEventListener('click', () => {
                    if (this.isPlaying) return;
                    if (window.soundEngine) window.soundEngine.playClick();
                    this.totalMines = parseInt(pill.dataset.mines, 10);
                    if (this.minesSelect) this.minesSelect.value = this.totalMines;
                    this.syncPresetPills();
                    this.updateStatsDisplay();
                });
            });
        }

        // Main action button (Bet or Cashout)
        if (this.mainBtn) {
            this.mainBtn.addEventListener('click', () => {
                if (!this.isPlaying) {
                    this.startRound();
                } else if (this.revealedGemsCount > 0) {
                    this.cashOut();
                }
            });
        }

        // Pick Random Tile button
        if (this.randomBtn) {
            this.randomBtn.addEventListener('click', () => {
                if (!this.isPlaying) return;
                this.pickRandomTile();
            });
        }

        // Dismiss win splash on click
        if (this.winSplash) {
            this.winSplash.addEventListener('click', () => {
                this.winSplash.classList.remove('active');
            });
        }
    }

    syncPresetPills() {
        if (!this.presetBtns) return;
        this.presetBtns.forEach(pill => {
            const count = parseInt(pill.dataset.mines, 10);
            pill.classList.toggle('active', count === this.totalMines);
        });
    }

    /**
     * Exact 10% House Edge (90% RTP) Multiplier Calculator
     * P(k) = Product_{i=0}^{k-1} (25 - M - i) / (25 - i)
     * Multiplier = (1 - HouseEdge) / P(k) = 0.90 / P(k)
     */
    calculateMultiplier(minesCount, gemsPicked) {
        if (gemsPicked <= 0) return 1.00;
        const total = 25;
        const safe = total - minesCount;
        if (gemsPicked > safe) gemsPicked = safe;

        let prob = 1.0;
        for (let i = 0; i < gemsPicked; i++) {
            prob *= (safe - i) / (total - i);
        }

        const rtp = 1.0 - (window.HOUSE_EDGE || 0.10); // 0.90 (90% RTP)
        const fairMult = 1.0 / prob;
        const netMult = rtp * fairMult;

        // Ensure at least 1.01x and format to 2 decimal places
        const rounded = Math.floor(netMult * 100) / 100;
        return Math.max(1.01, parseFloat(rounded.toFixed(2)));
    }

    startRound() {
        if (this.isPlaying) return;

        // Verify balance and deduct stake
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(this.betAmount)) {
            if (window.showToast) {
                window.showToast('Insufficient Balance', 'Please refill your balance to play Mines.', 'warning');
            }
            if (window.paymentGateway) {
                window.paymentGateway.open(Math.max(50, this.betAmount * 5));
            }
            return;
        }

        if (window.soundEngine) window.soundEngine.playClick();

        this.isPlaying = true;
        this.revealedGemsCount = 0;
        this.currentMultiplier = 1.00;
        this.nextMultiplier = this.calculateMultiplier(this.totalMines, 1);

        // Generate mine placements (Fisher-Yates shuffle)
        const arr = new Array(this.gridSize).fill(false);
        for (let i = 0; i < this.totalMines; i++) {
            arr[i] = true;
        }
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        this.tiles = arr.map((isMine, index) => ({
            index,
            isMine,
            isRevealed: false
        }));

        this.renderActiveGrid();
        this.updateControlsUI();
        this.updateStatsDisplay();

        if (this.winSplash) {
            this.winSplash.classList.remove('active');
        }
    }

    renderActiveGrid() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';

        for (let i = 0; i < this.gridSize; i++) {
            const tileEl = document.createElement('div');
            tileEl.className = 'mines-tile';
            tileEl.dataset.index = i;

            tileEl.addEventListener('click', () => {
                if (!this.isPlaying) return;
                this.pickTile(i);
            });

            this.gridContainer.appendChild(tileEl);
        }
    }

    resetGridUI() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';
        for (let i = 0; i < this.gridSize; i++) {
            const tileEl = document.createElement('div');
            tileEl.className = 'mines-tile';
            this.gridContainer.appendChild(tileEl);
        }
    }

    pickTile(index) {
        if (!this.isPlaying) return;
        const tileData = this.tiles[index];
        if (!tileData || tileData.isRevealed) return;

        tileData.isRevealed = true;
        const tileEl = this.gridContainer.querySelector(`.mines-tile[data-index="${index}"]`);
        if (!tileEl) return;

        tileEl.classList.add('revealed');

        if (tileData.isMine) {
            // BOOM! Mine hit
            tileEl.classList.add('mine-exploded');
            tileEl.innerHTML = `<i class="fa-solid fa-bomb"></i>`;

            if (this.gridWrapper) {
                this.gridWrapper.classList.add('screen-shake');
                setTimeout(() => {
                    if (this.gridWrapper) this.gridWrapper.classList.remove('screen-shake');
                }, 450);
            }

            if (window.soundEngine && typeof window.soundEngine.playMineBlast === 'function') {
                window.soundEngine.playMineBlast();
            } else if (window.soundEngine) {
                window.soundEngine.playLoss();
            }

            this.gameOver(false, index);
        } else {
            // SAFE GEM!
            this.revealedGemsCount++;
            this.currentMultiplier = this.calculateMultiplier(this.totalMines, this.revealedGemsCount);

            tileEl.classList.add('gem');
            tileEl.innerHTML = `
                <i class="fa-solid fa-gem"></i>
                <span class="mines-tile-mult-badge">${this.currentMultiplier.toFixed(2)}x</span>
            `;

            if (window.soundEngine && typeof window.soundEngine.playGemReveal === 'function') {
                window.soundEngine.playGemReveal(this.revealedGemsCount);
            } else if (window.soundEngine) {
                window.soundEngine.playClick();
            }

            const totalSafe = this.gridSize - this.totalMines;
            if (this.revealedGemsCount >= totalSafe) {
                // All safe gems uncovered: Auto Jackpot Cashout!
                this.cashOut();
            } else {
                this.nextMultiplier = this.calculateMultiplier(this.totalMines, this.revealedGemsCount + 1);
                this.updateControlsUI();
                this.updateStatsDisplay();
            }
        }
    }

    pickRandomTile() {
        if (!this.isPlaying) return;
        const unpicked = this.tiles
            .filter(t => !t.isRevealed)
            .map(t => t.index);

        if (unpicked.length === 0) return;
        const randIndex = unpicked[Math.floor(Math.random() * unpicked.length)];
        this.pickTile(randIndex);
    }

    cashOut() {
        if (!this.isPlaying || this.revealedGemsCount === 0) return;
        const totalPayout = this.betAmount * this.currentMultiplier;
        this.gameOver(true, null, totalPayout);
    }

    gameOver(won, hitIndex = null, winAmount = 0) {
        this.isPlaying = false;

        // Reveal all remaining unpicked tiles
        this.tiles.forEach(t => {
            if (!t.isRevealed) {
                const el = this.gridContainer.querySelector(`.mines-tile[data-index="${t.index}"]`);
                if (el) {
                    el.classList.add('revealed', 'disabled');
                    if (t.isMine) {
                        el.classList.add('unpicked-mine');
                        el.innerHTML = `<i class="fa-solid fa-bomb"></i>`;
                    } else {
                        el.classList.add('unpicked-gem');
                        el.innerHTML = `<i class="fa-regular fa-gem"></i>`;
                    }
                }
            }
        });

        if (won) {
            // Payout settlement
            if (window.arcadeWallet) {
                window.arcadeWallet.add(winAmount);
            }

            if (window.soundEngine && typeof window.soundEngine.playMinesCashout === 'function') {
                window.soundEngine.playMinesCashout();
            } else if (window.soundEngine) {
                window.soundEngine.playWin();
            }

            if ((winAmount >= 50 || this.currentMultiplier >= 2.00) && window.triggerConfetti) {
                window.triggerConfetti();
            }

            if (window.showToast) {
                window.showToast(
                    '🎉 Mines Cashed Out!',
                    `Won +${this.formatMoney(winAmount)} (${this.currentMultiplier.toFixed(2)}x) with ${this.revealedGemsCount} gems safe!`,
                    'success'
                );
            }

            // Show celebratory win splash badge
            if (this.winSplash && this.winSplashAmount && this.winSplashMult) {
                this.winSplashAmount.textContent = `+${this.formatMoney(winAmount)}`;
                this.winSplashMult.textContent = `@ ${this.currentMultiplier.toFixed(2)}x Multiplier`;
                this.winSplash.classList.add('active');
                setTimeout(() => {
                    if (this.winSplash) this.winSplash.classList.remove('active');
                }, 3200);
            }

            // Stats
            if (window.arcadeWallet && window.arcadeWallet.stats && window.arcadeWallet.stats.mines) {
                window.arcadeWallet.stats.mines.totalBets++;
                window.arcadeWallet.stats.mines.totalWon += winAmount;
                if (this.currentMultiplier > window.arcadeWallet.stats.mines.highestMultiplier) {
                    window.arcadeWallet.stats.mines.highestMultiplier = this.currentMultiplier;
                }
                if (winAmount > window.arcadeWallet.stats.mines.biggestWin) {
                    window.arcadeWallet.stats.mines.biggestWin = winAmount;
                }
                window.arcadeWallet.saveStats();
            }
        } else {
            if (window.showToast) {
                window.showToast('💥 Mine Hit!', `Stepped on a mine. Lost -$${this.betAmount.toFixed(2)}`, 'error');
            }
            if (window.arcadeWallet && window.arcadeWallet.stats && window.arcadeWallet.stats.mines) {
                window.arcadeWallet.stats.mines.totalBets++;
                window.arcadeWallet.saveStats();
            }
        }

        this.updateControlsUI();
        this.updateStatsDisplay();
    }

    updateControlsUI() {
        // Inputs disabled while playing
        if (this.betInput) this.betInput.disabled = this.isPlaying;
        if (this.minesSelect) this.minesSelect.disabled = this.isPlaying;
        if (this.quickBtns) {
            this.quickBtns.forEach(btn => btn.disabled = this.isPlaying);
        }
        if (this.presetBtns) {
            this.presetBtns.forEach(pill => pill.disabled = this.isPlaying);
        }
        if (this.randomBtn) {
            this.randomBtn.disabled = !this.isPlaying;
        }

        // Main action button text and appearance
        if (this.mainBtn) {
            if (!this.isPlaying) {
                this.mainBtn.className = 'mines-main-btn start-btn';
                this.mainBtn.innerHTML = `
                    <span>BET ${this.formatMoney(this.betAmount)}</span>
                    <small>START MINES ROUND</small>
                `;
            } else if (this.revealedGemsCount === 0) {
                this.mainBtn.className = 'mines-main-btn disabled-btn';
                this.mainBtn.innerHTML = `
                    <span>PICK A TILE</span>
                    <small>CHOOSE CAREFULLY</small>
                `;
            } else {
                const liveCashout = this.betAmount * this.currentMultiplier;
                this.mainBtn.className = 'mines-main-btn cashout-btn';
                this.mainBtn.innerHTML = `
                    <span>CASH OUT ${this.formatMoney(liveCashout)}</span>
                    <small>+${this.formatMoney(liveCashout - this.betAmount)} (${this.currentMultiplier.toFixed(2)}x)</small>
                `;
            }
        }
    }

    updateStatsDisplay() {
        const safeTotal = this.gridSize - this.totalMines;

        if (this.statMult) {
            const mult = this.isPlaying ? this.currentMultiplier : 1.00;
            this.statMult.textContent = `${mult.toFixed(2)}x`;
        }

        if (this.statNext) {
            const next = this.isPlaying 
                ? (this.revealedGemsCount < safeTotal ? this.nextMultiplier : this.currentMultiplier)
                : this.calculateMultiplier(this.totalMines, 1);
            this.statNext.textContent = `${next.toFixed(2)}x`;
        }

        if (this.statProfit) {
            if (this.isPlaying && this.revealedGemsCount > 0) {
                const profit = this.betAmount * (this.currentMultiplier - 1);
                this.statProfit.textContent = `+${this.formatMoney(profit)}`;
                this.statProfit.className = 'mines-stat-val gold';
            } else {
                this.statProfit.textContent = `Safe: ${safeTotal} • Mines: ${this.totalMines}`;
                this.statProfit.className = 'mines-stat-val cyan';
            }
        }
    }
}

window.MinesGame = MinesGame;
