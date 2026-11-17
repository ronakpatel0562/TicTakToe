// Color Prediction Game (Win Go / Color Parity Live Multi-Person Betting Engine)
// Authentic 10% House Edge (90% RTP) & Compact 2-Column Multiplayer Arena

class ColorSelectorGame {
    constructor() {
        this.periodValEl = document.getElementById('cp-period-val');
        this.timerClockEl = document.getElementById('cp-timer-clock');
        this.historyBarEl = document.getElementById('cp-history-bar');
        this.revealOrbEl = document.getElementById('cp-reveal-orb');
        this.resultBannerEl = document.getElementById('cp-result-banner');
        this.stageStatusEl = document.getElementById('cp-stage-status');
        this.lockOverlayEl = document.getElementById('cp-lock-overlay');
        this.lockCountdownEl = document.getElementById('cp-lock-countdown');
        this.confirmBtn = document.getElementById('cp-confirm-btn');
        this.doubleBtn = document.getElementById('cp-double-btn');
        this.clearBtn = document.getElementById('cp-clear-btn');
        this.betSummaryEl = document.getElementById('cp-bet-summary');

        // Winning result badge (matching Roulette)
        this.lastWinBadgeEl = document.getElementById('cp-last-win-badge');
        this.lastWinDescEl = document.getElementById('cp-last-win-desc');
        this.winSplashEl = document.getElementById('cp-win-splash');
        this.winSplashNumEl = document.getElementById('cp-win-splash-num');
        this.winSplashDescEl = document.getElementById('cp-win-splash-desc');
        this.winSplashPayoutEl = document.getElementById('cp-win-splash-payout');

        // Pools
        this.poolGreenEl = document.getElementById('cp-pool-green');
        this.poolVioletEl = document.getElementById('cp-pool-violet');
        this.poolRedEl = document.getElementById('cp-pool-red');

        // Simulated Community Players (matching Roulette)
        this.simBetsContainer = document.getElementById('cp-sim-bets');
        this.sideTitleEl = document.querySelector('.cp-side-title');
        this.simulatedBets = [];

        // Lists & Tables
        this.myBetsTableEl = document.getElementById('cp-my-bets-table');
        this.parityTableEl = document.getElementById('cp-parity-table');

        // Betting buttons
        this.colorBtns = document.querySelectorAll('.cp-btn-color');
        this.numBtns = document.querySelectorAll('.cp-btn-num');
        this.sizeBtns = document.querySelectorAll('.cp-btn-size');
        this.chipBtns = document.querySelectorAll('.cp-chip-btn');

        // State
        this.period = this.initPeriod();
        this.timer = 30; // 30-second rounds
        this.timerInterval = null;
        this.isLocked = false;
        this.isViewActive = true;
        this.selectedTarget = 'green'; // 'green', 'violet', 'red', 'num_X', 'big', 'small'
        this.selectedTargetType = 'color'; // 'color', 'number', 'size'
        this.selectedAmount = 10;
        this.activeUserBets = [];
        this.userBetHistory = [];
        this.history = [];

        // Pool amounts
        this.poolGreen = 12500;
        this.poolViolet = 3400;
        this.poolRed = 14200;

        this.init();
    }

    initPeriod() {
        const saved = localStorage.getItem('cp_period_id');
        if (saved) return parseInt(saved, 10);
        const d = new Date();
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        return parseInt(`${ymd}001`, 10);
    }

    init() {
        this.seedHistory();
        this.renderHistory();
        this.renderParityTable();
        this.bindEvents();
        this.initAutobet();
        this.startRound();
    }

    seedHistory() {
        // Pre-populate with 12 recent results
        for (let i = 12; i >= 1; i--) {
            const num = Math.floor(Math.random() * 10);
            this.history.push({
                period: this.period - i,
                num: num,
                color: this.getColorForNum(num),
                size: num >= 5 ? 'Big' : 'Small'
            });
        }
        if (this.history.length > 0) {
            const last = this.history[0];
            this.updateLastWinDisplay(last.num, last.color, last.size);
        }
    }

    getColorForNum(num) {
        if (num === 0) return 'split-red';
        if (num === 5) return 'split-green';
        if ([1, 3, 7, 9].includes(num)) return 'green';
        return 'red';
    }

    updateLastWinDisplay(num, color, size) {
        if (this.lastWinBadgeEl) {
            this.lastWinBadgeEl.className = `cp-last-win-badge ${color}`;
            this.lastWinBadgeEl.textContent = num;
        }
        if (this.lastWinDescEl) {
            let colorName = color === 'split-red' ? 'RED+VIOLET' : (color === 'split-green' ? 'GREEN+VIOLET' : color.toUpperCase());
            this.lastWinDescEl.textContent = `${colorName} • ${size.toUpperCase()}`;
        }
    }

    bindEvents() {
        // Color Betting
        this.colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isLocked) return;
                if (window.soundEngine) window.soundEngine.playClick();
                this.clearSelection();
                btn.classList.add('selected');
                this.selectedTarget = btn.dataset.color;
                this.selectedTargetType = 'color';
                this.updateBetSummary();
            });
        });

        // Number Betting
        this.numBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isLocked) return;
                if (window.soundEngine) window.soundEngine.playClick();
                this.clearSelection();
                btn.classList.add('selected');
                this.selectedTarget = `num_${btn.dataset.num}`;
                this.selectedTargetType = 'number';
                this.updateBetSummary();
            });
        });

        // Size Betting (Big / Small)
        this.sizeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isLocked) return;
                if (window.soundEngine) window.soundEngine.playClick();
                this.clearSelection();
                btn.classList.add('selected');
                this.selectedTarget = btn.dataset.size;
                this.selectedTargetType = 'size';
                this.updateBetSummary();
            });
        });

        // Chip selection
        this.chipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.soundEngine) window.soundEngine.playClick();
                this.chipBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedAmount = parseInt(btn.dataset.val, 10);
                this.updateBetSummary();
            });
        });

        // 2x Double Button (matching Roulette)
        if (this.doubleBtn) {
            this.doubleBtn.addEventListener('click', () => {
                this.doubleBets();
            });
        }

        // Clear Button (matching Roulette)
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                this.clearBets();
            });
        }

        // Confirm Bet
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => {
                this.placeBet();
            });
        }

        // Side card Sub-tabs (My Bets & Parity)
        const subTabBtns = document.querySelectorAll('.cp-sub-tab-btn');
        const subTabPanes = document.querySelectorAll('.cp-sub-tab-pane');
        subTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.soundEngine) window.soundEngine.playClick();
                subTabBtns.forEach(b => b.classList.remove('active'));
                subTabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(`cp-tab-pane-${btn.dataset.tab}`);
                if (target) target.classList.add('active');
            });
        });

        // Dismiss Win Splash on click
        if (this.winSplashEl) {
            this.winSplashEl.addEventListener('click', () => {
                this.winSplashEl.classList.remove('active');
            });
        }

        // Initial Selection
        if (this.colorBtns[0]) this.colorBtns[0].classList.add('selected');
        this.updateBetSummary();
    }

    clearSelection() {
        this.colorBtns.forEach(b => b.classList.remove('selected'));
        this.numBtns.forEach(b => b.classList.remove('selected'));
        this.sizeBtns.forEach(b => b.classList.remove('selected'));
    }

    updateBetSummary() {
        if (!this.betSummaryEl) return;
        let targetLabel = '';
        let oddsLabel = '';

        if (this.selectedTargetType === 'color') {
            targetLabel = this.selectedTarget.toUpperCase();
            oddsLabel = this.selectedTarget === 'violet' ? '4.5x' : '2.0x';
        } else if (this.selectedTargetType === 'number') {
            targetLabel = `NUM ${this.selectedTarget.replace('num_', '')}`;
            oddsLabel = '9.0x';
        } else {
            targetLabel = this.selectedTarget.toUpperCase();
            oddsLabel = '2.0x';
        }

        const totalStaked = this.activeUserBets.reduce((sum, b) => sum + b.amount, 0);
        const betCount = this.activeUserBets.length;

        if (betCount > 0) {
            this.betSummaryEl.innerHTML = `Selected: <strong>${targetLabel}</strong> (${oddsLabel}) &nbsp;|&nbsp; <span style="color:#f59e0b; font-weight:800;"><i class="fa-solid fa-coins"></i> Total Staked: $${totalStaked} (${betCount} Bet${betCount === 1 ? '' : 's'})</span>`;
        } else {
            this.betSummaryEl.innerHTML = `Bet: <strong>${targetLabel}</strong> (${oddsLabel}) • Amount: <strong>$${this.selectedAmount}</strong>`;
        }
    }

    doubleBets() {
        if (this.isLocked) {
            if (window.showToast) window.showToast('Betting Locked', 'Wait for next round to modify bets!', 'warning');
            return;
        }

        if (this.activeUserBets.length === 0) {
            // Double the active chip selection if no bets placed yet
            this.selectedAmount = Math.min(1000, this.selectedAmount * 2);
            this.chipBtns.forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.val, 10) === this.selectedAmount);
            });
            this.updateBetSummary();
            if (window.soundEngine) window.soundEngine.playClick();
            if (window.showToast) {
                window.showToast('Chip Doubled 2×', `Chip amount doubled to $${this.selectedAmount}`, 'info');
            }
            return;
        }

        // Double all active bets on the board (matching Roulette)
        const currentTotal = this.activeUserBets.reduce((sum, b) => sum + b.amount, 0);
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(currentTotal)) {
            if (window.showToast) window.showToast('Insufficient Balance', `Need $${currentTotal} more to 2× double all active bets!`, 'warning');
            if (window.paymentGateway) window.paymentGateway.open(currentTotal * 2);
            return;
        }

        if (window.soundEngine) window.soundEngine.playClick();
        this.activeUserBets.forEach(b => {
            if (b.target === 'green') this.poolGreen += b.amount;
            else if (b.target === 'red') this.poolRed += b.amount;
            else if (b.target === 'violet') this.poolViolet += b.amount;
            b.amount *= 2;
        });

        this.updatePoolsUI();
        this.updateBetSummary();
        this.renderBetBadges();
        this.renderMyBetsTable();

        if (window.showToast) {
            window.showToast('Bets Doubled 2×', `All active bets doubled! Total stake: $${currentTotal * 2}`, 'success');
        }
    }

    clearBets() {
        if (this.isLocked) {
            if (window.showToast) window.showToast('Betting Locked', 'Bets cannot be cleared after lock!', 'warning');
            return;
        }

        if (this.activeUserBets.length === 0) {
            if (window.showToast) window.showToast('No Bets', 'You have no active bets in this round to clear.', 'info');
            return;
        }

        const refund = this.activeUserBets.reduce((sum, b) => sum + b.amount, 0);
        if (window.arcadeWallet) window.arcadeWallet.add(refund);

        this.activeUserBets.forEach(b => {
            if (b.target === 'green') this.poolGreen = Math.max(0, this.poolGreen - b.amount);
            else if (b.target === 'red') this.poolRed = Math.max(0, this.poolRed - b.amount);
            else if (b.target === 'violet') this.poolViolet = Math.max(0, this.poolViolet - b.amount);
        });
        this.updatePoolsUI();

        this.activeUserBets = [];
        this.renderBetBadges();
        this.updateBetSummary();
        this.renderMyBetsTable();

        if (window.soundEngine) window.soundEngine.playClick();
        if (window.showToast) {
            window.showToast('Bets Cleared', `Refunded $${refund} to your balance.`, 'info');
        }
    }

    renderBetBadges() {
        // Remove existing badges & active-bet classes
        document.querySelectorAll('.cp-cell-badge').forEach(b => b.remove());
        document.querySelectorAll('.cp-btn-color, .cp-btn-num, .cp-btn-size').forEach(el => {
            el.classList.remove('has-active-bet');
        });

        if (!this.activeUserBets || this.activeUserBets.length === 0) return;

        // Group active bets by target
        const map = new Map();
        this.activeUserBets.forEach(b => {
            map.set(b.target, (map.get(b.target) || 0) + b.amount);
        });

        map.forEach((totalAmt, target) => {
            let el = null;
            if (target === 'green' || target === 'violet' || target === 'red') {
                el = document.querySelector(`.cp-btn-color[data-color="${target}"]`);
            } else if (target.startsWith('num_')) {
                const num = target.replace('num_', '');
                el = document.querySelector(`.cp-btn-num[data-num="${num}"]`);
            } else if (target === 'big' || target === 'small') {
                el = document.querySelector(`.cp-btn-size[data-size="${target}"]`);
            }

            if (el) {
                el.classList.add('has-active-bet');
                const badge = document.createElement('span');
                badge.className = 'cp-cell-badge';
                badge.dataset.target = target;
                badge.textContent = `$${totalAmt}`;
                el.appendChild(badge);
            }
        });
    }

    placeBet() {
        if (this.isLocked) {
            if (window.showToast) window.showToast('Betting Locked', 'Wait for next round to place bets!', 'warning');
            return;
        }

        if (!window.arcadeWallet || !window.arcadeWallet.deduct(this.selectedAmount)) {
            if (window.showToast) window.showToast('Insufficient Funds', 'Opening Payment Gateway to deposit funds...', 'warning');
            if (window.paymentGateway) {
                window.paymentGateway.open(Math.max(50, this.selectedAmount * 5));
            }
            return;
        }

        if (window.soundEngine) window.soundEngine.playClick();

        const bet = {
            id: Date.now(),
            period: this.period,
            target: this.selectedTarget,
            targetType: this.selectedTargetType,
            amount: this.selectedAmount
        };

        this.activeUserBets.push(bet);

        // Update pool
        if (this.selectedTarget === 'green') this.poolGreen += this.selectedAmount;
        else if (this.selectedTarget === 'red') this.poolRed += this.selectedAmount;
        else if (this.selectedTarget === 'violet') this.poolViolet += this.selectedAmount;
        this.updatePoolsUI();

        // Render visual badges & update summary
        this.renderBetBadges();
        this.updateBetSummary();
        this.renderMyBetsTable();

        if (window.showToast) {
            const displayTarget = this.selectedTarget.toUpperCase().replace('NUM_', 'NUM ');
            window.showToast('Bet Placed! 🎯', `Placed $${this.selectedAmount} on ${displayTarget}`, 'success');
        }
    }

    startRound() {
        this.timer = 30;
        this.isLocked = false;
        this.activeUserBets = [];
        this.renderBetBadges();
        this.updateBetSummary();
        this.renderMyBetsTable();

        // Clear winning highlight rings from previous round
        document.querySelectorAll('.cp-winning-highlight').forEach(el => {
            el.classList.remove('cp-winning-highlight');
        });

        if (this.winSplashEl) {
            this.winSplashEl.classList.remove('active');
        }

        if (this.periodValEl) this.periodValEl.textContent = `#${this.period}`;
        if (this.lockOverlayEl) this.lockOverlayEl.classList.remove('active');
        if (this.confirmBtn) this.confirmBtn.disabled = false;
        if (this.clearBtn) this.clearBtn.disabled = false;
        if (this.doubleBtn) this.doubleBtn.disabled = false;
        if (this.stageStatusEl) this.stageStatusEl.textContent = 'Betting Open';
        if (this.resultBannerEl) this.resultBannerEl.innerHTML = '<span style="color:var(--text-muted)">Waiting for countdown...</span>';

        // Reset orb
        if (this.revealOrbEl) {
            this.revealOrbEl.className = 'cp-reveal-orb';
            this.revealOrbEl.textContent = '?';
        }

        // Randomize initial pools
        this.poolGreen = Math.floor(10000 + Math.random() * 8000);
        this.poolViolet = Math.floor(2500 + Math.random() * 2500);
        this.poolRed = Math.floor(11000 + Math.random() * 8000);
        this.updatePoolsUI();

        this.populateSimBets();
        this.renderMyBetsTable();
        this.autoBetPlacedThisRound = false;

        // Automated Stake Autobet Placement
        if (this.autobetEngine && this.autobetEngine.isRunning && !this.isLocked) {
            setTimeout(() => {
                if (this.autobetEngine && this.autobetEngine.isRunning && !this.isLocked && !this.autoBetPlacedThisRound) {
                    this.placeAutobetStake();
                }
            }, 600);
        }

        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            this.tick();
        }, 1000);
    }

    stop() {
        this.isViewActive = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    start() {
        this.isViewActive = true;
        if (!this.timerInterval) {
            this.startTimer();
        }
    }

    tick() {
        if (!this.isViewActive) return;
        this.timer--;

        // Timer clock display
        if (this.timerClockEl) {
            const min = String(Math.floor(this.timer / 60)).padStart(2, '0');
            const sec = String(this.timer % 60).padStart(2, '0');
            this.timerClockEl.textContent = `${min}:${sec}`;
            this.timerClockEl.classList.toggle('warning', this.timer <= 5);
        }

        // Lock betting at 5 seconds
        if (this.timer === 5) {
            this.lockBetting();
            if (this.isViewActive && window.soundEngine && typeof window.soundEngine.playWinGoLock === 'function') {
                window.soundEngine.playWinGoLock();
            }
        }

        // Lock countdown overlay update
        if (this.timer <= 5 && this.timer > 0) {
            if (this.lockCountdownEl) this.lockCountdownEl.textContent = this.timer;
            if (this.isViewActive && window.soundEngine) {
                if (typeof window.soundEngine.playWinGoTick === 'function') {
                    window.soundEngine.playWinGoTick();
                } else {
                    window.soundEngine.playClick();
                }
            }
        }

        // Time up -> Reveal Result
        if (this.timer <= 0) {
            clearInterval(this.timerInterval);
            this.revealResult();
        }
    }

    lockBetting() {
        this.isLocked = true;
        if (this.confirmBtn) this.confirmBtn.disabled = true;
        if (this.clearBtn) this.clearBtn.disabled = true;
        if (this.doubleBtn) this.doubleBtn.disabled = true;
        if (this.lockOverlayEl) this.lockOverlayEl.classList.add('active');
        if (this.stageStatusEl) this.stageStatusEl.textContent = 'Betting Locked';
        if (this.lockCountdownEl) this.lockCountdownEl.textContent = '5';
    }

    /* ================= DYNAMIC MULTIPLAYER (MATCHING ROULETTE) ================= */
    getRandomUsername() {
        const prefixes = [
            'Crypto', 'Lucky', 'Vegas', 'Neon', 'Apex', 'Cyber', 'Star', 'Zenith',
            'Nova', 'Hyper', 'Shadow', 'Golden', 'Alpha', 'Blaze', 'Iron', 'Silver',
            'Diamond', 'Turbo', 'Elite', 'Thunder'
        ];
        const suffixes = [
            'Wolf', 'Pilot', 'Pro', 'King', 'Queen', 'Rider', 'Ghost', 'Viper',
            'Whale', 'Legend', 'Hawk', 'Sniper', 'Captain', 'Gambler', 'Champ',
            'Ace', 'Titan', 'Baron'
        ];
        const p = prefixes[Math.floor(Math.random() * prefixes.length)];
        const s = suffixes[Math.floor(Math.random() * suffixes.length)];
        const tag = Math.random() < 0.35 ? `${Math.floor(Math.random() * 90 + 10)}` : (Math.random() < 0.2 ? '_VIP' : '');
        return `${p}${s}${tag}`;
    }

    getRandomAmount() {
        const amounts = [10, 15, 20, 25, 35, 50, 75, 100, 150, 200, 250, 500, 1000];
        return amounts[Math.floor(Math.random() * amounts.length)];
    }

    populateSimBets() {
        if (!this.simBetsContainer) return;
        const allTargets = [
            'GREEN', 'RED', 'VIOLET', 'BIG', 'SMALL',
            'Num 0', 'Num 1', 'Num 2', 'Num 3', 'Num 4',
            'Num 5', 'Num 6', 'Num 7', 'Num 8', 'Num 9'
        ];

        // Random 8 to 12 active players
        const playerCount = Math.floor(Math.random() * 5) + 8;
        const usedNames = new Set();
        this.simulatedBets = [];

        for (let i = 0; i < playerCount; i++) {
            let name = this.getRandomUsername();
            while (usedNames.has(name)) {
                name = this.getRandomUsername();
            }
            usedNames.add(name);

            const target = allTargets[Math.floor(Math.random() * allTargets.length)];
            const amount = this.getRandomAmount();

            this.simulatedBets.push({
                name,
                target,
                amount,
                won: false,
                payout: 0
            });
        }

        if (this.sideTitleEl) {
            this.sideTitleEl.innerHTML = `<i class="fa-solid fa-users" style="color:var(--color-accent);"></i> <span>Live Table Players (${this.simulatedBets.length})</span>`;
        }

        this.renderSimBets();
    }

    renderSimBets() {
        if (!this.simBetsContainer) return;
        this.simBetsContainer.innerHTML = this.simulatedBets.map(b => {
            if (b.won) {
                return `
                    <div class="cp-player-item winning">
                        <span class="cp-player-name"><i class="fa-solid fa-crown" style="color:#f59e0b;"></i> ${b.name}</span>
                        <span class="cp-player-target">${b.target}</span>
                        <span class="cp-player-win-badge">+$${b.payout}</span>
                    </div>
                `;
            }
            return `
                <div class="cp-player-item">
                    <span class="cp-player-name"><i class="fa-solid fa-user-circle"></i> ${b.name}</span>
                    <span class="cp-player-target">${b.target}</span>
                    <span class="cp-player-bet">$${b.amount}</span>
                </div>
            `;
        }).join('');
    }

    settleSimBets(winNum, winColor, winSize) {
        if (!this.simBetsContainer || !this.simulatedBets || this.simulatedBets.length === 0) return;

        // Valid winning options for this round
        const winningOptions = [
            { target: `Num ${winNum}`, mult: 9.0 },
            { target: winSize.toUpperCase(), mult: 2.0 }
        ];

        if (winColor === 'green') {
            winningOptions.push({ target: 'GREEN', mult: 2.0 });
        } else if (winColor === 'red') {
            winningOptions.push({ target: 'RED', mult: 2.0 });
        } else if (winColor === 'split-green') {
            winningOptions.push({ target: 'GREEN', mult: 1.5 });
            winningOptions.push({ target: 'VIOLET', mult: 4.5 });
        } else if (winColor === 'split-red') {
            winningOptions.push({ target: 'RED', mult: 1.5 });
            winningOptions.push({ target: 'VIOLET', mult: 4.5 });
        }

        // Random 2 to 5 winners
        const maxWinners = Math.min(this.simulatedBets.length, 5);
        const minWinners = Math.min(2, maxWinners);
        const winnersCount = Math.floor(Math.random() * (maxWinners - minWinners + 1)) + minWinners;

        // Shuffle player indices
        const indices = this.simulatedBets.map((_, i) => i).sort(() => Math.random() - 0.5);
        const winnerIndices = new Set(indices.slice(0, winnersCount));

        this.simulatedBets.forEach((p, idx) => {
            if (winnerIndices.has(idx)) {
                const opt = winningOptions[Math.floor(Math.random() * winningOptions.length)];
                p.target = opt.target;
                p.won = true;
                p.payout = Math.round(p.amount * opt.mult);
            } else {
                p.won = false;
                p.payout = 0;
            }
        });

        // Sort so winners appear at the top!
        this.simulatedBets.sort((a, b) => (b.won ? 1 : 0) - (a.won ? 1 : 0));

        if (this.sideTitleEl) {
            this.sideTitleEl.innerHTML = `<i class="fa-solid fa-trophy" style="color:#f59e0b;"></i> <span style="color:#10b981; font-weight:800;">${winnersCount} Winning Bets!</span>`;
        }

        this.renderSimBets();
    }

    updatePoolsUI() {
        if (this.poolGreenEl) this.poolGreenEl.textContent = `$${this.poolGreen.toLocaleString()}`;
        if (this.poolVioletEl) this.poolVioletEl.textContent = `$${this.poolViolet.toLocaleString()}`;
        if (this.poolRedEl) this.poolRedEl.textContent = `$${this.poolRed.toLocaleString()}`;
    }

    revealResult() {
        if (this.lockOverlayEl) this.lockOverlayEl.classList.remove('active');
        if (this.stageStatusEl) this.stageStatusEl.textContent = 'Revealing Result...';

        // Winning Number: 0 to 9 with authentic 10% House Edge
        const houseEdge = window.HOUSE_EDGE || 0.10;
        let winNum;
        if (this.activeUserBets.length > 0 && Math.random() < houseEdge) {
            const betNums = this.activeUserBets.filter(b => b.targetType === 'number').map(b => parseInt(b.target.replace('num_', ''), 10));
            const safePool = [0, 5, 1, 2, 3, 4, 6, 7, 8, 9].filter(n => !betNums.includes(n));
            winNum = safePool[Math.floor(Math.random() * safePool.length)];
        } else {
            winNum = Math.floor(Math.random() * 10);
        }
        const winColor = this.getColorForNum(winNum);
        const winSize = winNum >= 5 ? 'Big' : 'Small';

        // Animate Orb Shuffle
        if (this.revealOrbEl) {
            this.revealOrbEl.classList.add('spinning');
        }

        let spinCount = 0;
        const spinInterval = setInterval(() => {
            if (this.revealOrbEl) {
                this.revealOrbEl.textContent = Math.floor(Math.random() * 10);
            }
            spinCount++;
            if (spinCount >= 14) {
                clearInterval(spinInterval);
                this.finalizeResult(winNum, winColor, winSize);
            }
        }, 110);
    }

    highlightWinningTargets(winNum, winColor, winSize) {
        // Clear old highlights
        document.querySelectorAll('.cp-winning-highlight').forEach(el => el.classList.remove('cp-winning-highlight'));

        // Highlight winning number button
        const numBtn = document.querySelector(`.cp-btn-num[data-num="${winNum}"]`);
        if (numBtn) numBtn.classList.add('cp-winning-highlight');

        // Highlight winning color button
        if (winColor === 'green' || winColor === 'split-green') {
            const btn = document.querySelector('.cp-btn-green');
            if (btn) btn.classList.add('cp-winning-highlight');
        }
        if (winColor === 'red' || winColor === 'split-red') {
            const btn = document.querySelector('.cp-btn-red');
            if (btn) btn.classList.add('cp-winning-highlight');
        }
        if (winColor === 'split-green' || winColor === 'split-red') {
            const btn = document.querySelector('.cp-btn-violet');
            if (btn) btn.classList.add('cp-winning-highlight');
        }

        // Highlight winning size button
        const sizeBtn = document.querySelector(`.cp-btn-size[data-size="${winSize.toLowerCase()}"]`);
        if (sizeBtn) sizeBtn.classList.add('cp-winning-highlight');

        // Highlight winning badges on cells
        const winningTargets = new Set();
        winningTargets.add(`num_${winNum}`);
        winningTargets.add(winSize.toLowerCase());
        if (winColor === 'green' || winColor === 'split-green') winningTargets.add('green');
        if (winColor === 'red' || winColor === 'split-red') winningTargets.add('red');
        if (winColor === 'split-green' || winColor === 'split-red') winningTargets.add('violet');

        document.querySelectorAll('.cp-cell-badge').forEach(badge => {
            if (winningTargets.has(badge.dataset.target)) {
                badge.classList.add('won');
            }
        });
    }

    showWinSplash(winNum, colorDesc, winAmount) {
        if (!this.winSplashEl) return;
        if (this.winSplashNumEl) this.winSplashNumEl.textContent = winNum;
        if (this.winSplashDescEl) this.winSplashDescEl.textContent = colorDesc;
        if (this.winSplashPayoutEl) this.winSplashPayoutEl.textContent = `+$${winAmount.toLocaleString()}`;

        this.winSplashEl.classList.add('active');
        setTimeout(() => {
            if (this.winSplashEl) this.winSplashEl.classList.remove('active');
        }, 3600);
    }

    finalizeResult(winNum, winColor, winSize) {
        if (this.revealOrbEl) {
            this.revealOrbEl.classList.remove('spinning');
            this.revealOrbEl.textContent = winNum;
            this.revealOrbEl.className = `cp-reveal-orb ${winColor}`;
        }

        // Color label for display
        let colorName = '';
        if (winColor === 'split-red') colorName = 'Red + Violet';
        else if (winColor === 'split-green') colorName = 'Green + Violet';
        else if (winColor === 'green') colorName = 'Green';
        else colorName = 'Red';

        if (this.resultBannerEl) {
            this.resultBannerEl.innerHTML = `
                Result: <strong style="color:var(--color-accent); font-size:1.3rem;">${winNum}</strong> • 
                <span class="cp-dot ${winColor}"></span> <strong>${colorName}</strong> (${winSize})
            `;
        }

        // Update top winning result badge
        this.updateLastWinDisplay(winNum, winColor, winSize);

        // Highlight winning buttons on the board
        this.highlightWinningTargets(winNum, winColor, winSize);

        // Settle simulated community bets
        this.settleSimBets(winNum, winColor, winSize);

        // Settle active user bets
        let totalWon = 0;
        let anyWon = false;

        this.activeUserBets.forEach(bet => {
            let win = false;
            let multiplier = 0;

            if (bet.targetType === 'color') {
                if (bet.target === 'green') {
                    if ([1, 3, 7, 9].includes(winNum)) {
                        win = true; multiplier = 2.0;
                    } else if (winNum === 5) {
                        win = true; multiplier = 1.5;
                    }
                } else if (bet.target === 'red') {
                    if ([2, 4, 6, 8].includes(winNum)) {
                        win = true; multiplier = 2.0;
                    } else if (winNum === 0) {
                        win = true; multiplier = 1.5;
                    }
                } else if (bet.target === 'violet') {
                    if ([0, 5].includes(winNum)) {
                        win = true; multiplier = 4.5;
                    }
                }
            } else if (bet.targetType === 'number') {
                const targetNum = parseInt(bet.target.replace('num_', ''), 10);
                if (targetNum === winNum) {
                    win = true; multiplier = 9.0;
                }
            } else if (bet.targetType === 'size') {
                if (bet.target.toLowerCase() === winSize.toLowerCase()) {
                    win = true; multiplier = 2.0;
                }
            }

            const payout = win ? Math.round(bet.amount * multiplier) : 0;
            if (win) {
                totalWon += payout;
                anyWon = true;
            }

            this.userBetHistory.unshift({
                period: bet.period,
                target: bet.target.toUpperCase(),
                amount: bet.amount,
                result: `${winNum} (${winColor})`,
                status: win ? `+$${payout.toFixed(2)}` : `-$${bet.amount.toFixed(2)}`,
                isWin: win
            });
        });

        // Pay out winnings
        if (anyWon && totalWon > 0) {
            if (window.arcadeWallet) window.arcadeWallet.add(totalWon);
            if (this.isViewActive && window.soundEngine) {
                if (typeof window.soundEngine.playWinGoWin === 'function') {
                    window.soundEngine.playWinGoWin();
                } else {
                    window.soundEngine.playWin();
                }
            }
            if (this.isViewActive && window.triggerConfetti) window.triggerConfetti();

            this.showWinSplash(winNum, `${colorName.toUpperCase()} • ${winSize.toUpperCase()}`, totalWon);

            if (window.showToast) {
                window.showToast('🎉 Win Go Winner!', `You won +$${totalWon.toLocaleString()} on Period #${this.period}!`, 'success');
            }
        } else if (this.activeUserBets.length > 0) {
            if (this.isViewActive && window.soundEngine) window.soundEngine.playLoss();
            const totalLost = this.activeUserBets.reduce((sum, b) => sum + b.amount, 0);
            if (window.showToast) {
                window.showToast('Round Ended', `Period #${this.period} result was ${winNum} ${colorName}. -$${totalLost.toFixed(2)}`, 'error');
            }
        }

        // Handle Stake Autobet Settlement
        if (this.autobetEngine && this.autobetEngine.isRunning) {
            const totalStaked = this.activeUserBets.reduce((sum, b) => sum + b.amount, 0);
            const won = anyWon && totalWon > totalStaked;
            this.autobetEngine.recordResult(won, totalWon, totalStaked);
        }

        // Add to history
        this.history.unshift({
            period: this.period,
            num: winNum,
            color: winColor,
            size: winSize
        });

        if (this.history.length > 30) this.history.pop();

        this.renderHistory();
        this.renderParityTable();
        this.renderMyBetsTable();

        // Increment period and save
        this.period++;
        localStorage.setItem('cp_period_id', this.period);

        // Advance to next round after 4.5 seconds
        setTimeout(() => {
            this.startRound();
        }, 4500);
    }

    renderHistory() {
        if (!this.historyBarEl) return;
        this.historyBarEl.innerHTML = this.history.slice(0, 16).map(h => `
            <div class="cp-history-chip">
                <span class="cp-dot ${h.color}"></span>
                <span>${h.num}</span>
            </div>
        `).join('');
    }

    renderParityTable() {
        if (!this.parityTableEl) return;
        this.parityTableEl.innerHTML = `
            <thead>
                <tr>
                    <th>Period</th>
                    <th>Num</th>
                    <th>Color</th>
                    <th>Size</th>
                </tr>
            </thead>
            <tbody>
                ${this.history.slice(0, 10).map(h => `
                    <tr>
                        <td>#${h.period}</td>
                        <td><strong>${h.num}</strong></td>
                        <td><span class="cp-dot ${h.color}"></span></td>
                        <td><strong>${h.size}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    }

    renderMyBetsTable() {
        if (!this.myBetsTableEl) return;
        if (this.userBetHistory.length === 0 && (!this.activeUserBets || this.activeUserBets.length === 0)) {
            this.myBetsTableEl.innerHTML = `<tbody><tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1rem;">No bets placed yet</td></tr></tbody>`;
            return;
        }

        let rows = '';
        // Active bets for current period
        if (this.activeUserBets && this.activeUserBets.length > 0) {
            this.activeUserBets.forEach(b => {
                const targetDisplay = b.target.toUpperCase().replace('NUM_', 'NUM ');
                rows += `
                    <tr style="background: rgba(245, 158, 11, 0.08);">
                        <td>#${b.period}</td>
                        <td><strong>${targetDisplay}</strong></td>
                        <td>$${b.amount}</td>
                        <td style="color:#f59e0b; font-weight:800;"><i class="fa-solid fa-spinner fa-spin"></i> Active</td>
                    </tr>
                `;
            });
        }

        // Settled history
        this.userBetHistory.slice(0, 8).forEach(b => {
            rows += `
                <tr>
                    <td>#${b.period}</td>
                    <td><strong>${b.target}</strong></td>
                    <td>$${b.amount}</td>
                    <td style="color:${b.isWin ? '#10b981' : '#ef4444'}; font-weight:800;">${b.status}</td>
                </tr>
            `;
        });

        this.myBetsTableEl.innerHTML = `
            <thead>
                <tr>
                    <th>Period</th>
                    <th>Target</th>
                    <th>Stake</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        `;
    }

    initAutobet() {
        this.autobetEngine = null;
        this.autoBetPlacedThisRound = false;

        // Tabs
        const tabBtns = document.querySelectorAll('#cp-tabs .stake-tab-btn');
        const manualContainer = document.getElementById('cp-manual-container');
        const autoPanel = document.getElementById('cp-auto-panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                if (tab === 'auto') {
                    if (manualContainer) manualContainer.style.display = 'none';
                    if (autoPanel) autoPanel.style.display = 'flex';
                } else {
                    if (manualContainer) manualContainer.style.display = 'block';
                    if (autoPanel) autoPanel.style.display = 'none';
                }
            });
        });

        // Halve / Double
        const halfBtn = document.getElementById('cp-auto-half');
        const doubleBtn = document.getElementById('cp-auto-double');
        const betInput = document.getElementById('cp-auto-bet-input');

        if (halfBtn && betInput) {
            halfBtn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                let v = parseFloat(betInput.value) || 10;
                v = Math.max(1, Math.floor(v / 2));
                betInput.value = v;
            });
        }
        if (doubleBtn && betInput) {
            doubleBtn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                let v = parseFloat(betInput.value) || 10;
                betInput.value = v * 2;
            });
        }

        // Presets
        const presetBtns = document.querySelectorAll('#cp-auto-presets .stake-pill-btn');
        const totalBetsInput = document.getElementById('cp-auto-total-bets');
        const infLabel = document.getElementById('cp-auto-inf-label');

        presetBtns.forEach(pill => {
            pill.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) return;
                if (window.soundEngine) window.soundEngine.playClick();
                presetBtns.forEach(b => b.classList.remove('active'));
                pill.classList.add('active');
                const val = parseInt(pill.dataset.val, 10);
                if (totalBetsInput) totalBetsInput.value = val;
                if (infLabel) infLabel.textContent = val === 0 ? '∞' : val;
            });
        });

        if (totalBetsInput) {
            totalBetsInput.addEventListener('input', () => {
                const val = parseInt(totalBetsInput.value, 10) || 0;
                if (infLabel) infLabel.textContent = val === 0 ? '∞' : val;
            });
        }

        // Segmented On Win / On Loss toggles
        this.bindSegmentedToggle('cp-onwin-toggle', 'cp-onwin-pct-wrap');
        this.bindSegmentedToggle('cp-onloss-toggle', 'cp-onloss-pct-wrap');

        // Start / Stop Autobet Button
        const autobetBtn = document.getElementById('cp-autobet-btn');
        if (autobetBtn) {
            autobetBtn.addEventListener('click', () => {
                if (this.autobetEngine && this.autobetEngine.isRunning) {
                    this.stopAutobet('User stopped autobet');
                } else {
                    this.startAutobet();
                }
            });
        }
    }

    bindSegmentedToggle(containerId, pctWrapId) {
        const container = document.getElementById(containerId);
        const pctWrap = document.getElementById(pctWrapId);
        if (!container) return;

        const btns = container.querySelectorAll('.stake-segment-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const action = btn.dataset.action;
                if (pctWrap) {
                    pctWrap.style.display = action === 'increase' ? 'flex' : 'none';
                }
            });
        });
    }

    startAutobet() {
        const betInput = document.getElementById('cp-auto-bet-input');
        const totalBetsInput = document.getElementById('cp-auto-total-bets');
        const onWinBtn = document.querySelector('#cp-onwin-toggle .stake-segment-btn.active');
        const onWinPctInput = document.getElementById('cp-onwin-pct-input');
        const onLossBtn = document.querySelector('#cp-onloss-toggle .stake-segment-btn.active');
        const onLossPctInput = document.getElementById('cp-onloss-pct-input');
        const stopProfitInput = document.getElementById('cp-auto-stop-profit');
        const stopLossInput = document.getElementById('cp-auto-stop-loss');

        const baseBet = Math.max(1, parseFloat(betInput ? betInput.value : 10) || 10);
        const totalBets = parseInt(totalBetsInput ? totalBetsInput.value : 10, 10) || 0;
        const onWinAction = onWinBtn ? onWinBtn.dataset.action : 'reset';
        const onWinPercent = parseFloat(onWinPctInput ? onWinPctInput.value : 100) || 100;
        const onLossAction = onLossBtn ? onLossBtn.dataset.action : 'reset';
        const onLossPercent = parseFloat(onLossPctInput ? onLossPctInput.value : 100) || 100;
        const stopOnProfit = parseFloat(stopProfitInput ? stopProfitInput.value : 0) || 0;
        const stopOnLoss = parseFloat(stopLossInput ? stopLossInput.value : 0) || 0;

        if (window.arcadeWallet && window.arcadeWallet.getBalance() < baseBet) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Please deposit funds to start Autobet.', 'warning');
            if (window.paymentGateway) window.paymentGateway.open(baseBet * 5);
            return;
        }

        this.autobetEngine = new window.StakeAutobetEngine({
            baseBet,
            totalBets,
            onWinAction,
            onWinPercent,
            onLossAction,
            onLossPercent,
            stopOnProfit,
            stopOnLoss,
            onStart: () => {
                this.updateAutobetButtonUI(true);
            },
            onStop: (reason) => {
                this.updateAutobetButtonUI(false);
                if (window.showToast) window.showToast('Win Go Autobet Stopped', reason, 'info');
            },
            onUpdate: (state) => {
                this.updateAutobetLiveStats(state);
            }
        });

        this.autobetEngine.start();

        // If betting is currently open (timer > 5), place immediately
        if (!this.isLocked && this.timer > 5 && !this.autoBetPlacedThisRound) {
            this.placeAutobetStake();
        }
    }

    placeAutobetStake() {
        if (!this.autobetEngine || !this.autobetEngine.isRunning || this.isLocked || this.autoBetPlacedThisRound) return;
        const targetSelect = document.getElementById('cp-auto-target-select');
        const target = targetSelect ? targetSelect.value : 'green';
        const currentBet = this.autobetEngine.currentBet;

        let targetType = 'color';
        if (target === 'small' || target === 'big') targetType = 'size';

        if (!window.arcadeWallet || !window.arcadeWallet.deduct(currentBet)) {
            this.stopAutobet('Insufficient balance');
            return;
        }

        this.autoBetPlacedThisRound = true;
        if (window.soundEngine) window.soundEngine.playClick();

        const bet = {
            id: Date.now(),
            period: this.period,
            target: target,
            targetType: targetType,
            amount: currentBet
        };

        this.activeUserBets.push(bet);
        if (target === 'green') this.poolGreen += currentBet;
        else if (target === 'red') this.poolRed += currentBet;
        else if (target === 'violet') this.poolViolet += currentBet;
        this.updatePoolsUI();

        this.renderBetBadges();
        this.updateBetSummary();
        this.renderMyBetsTable();
    }

    stopAutobet(reason) {
        if (this.autobetEngine) {
            this.autobetEngine.stop(reason);
        }
        this.updateAutobetButtonUI(false);
    }

    updateAutobetButtonUI(running) {
        const btn = document.getElementById('cp-autobet-btn');
        const statsPill = document.getElementById('cp-auto-stats-pill');
        if (!btn) return;

        if (running) {
            btn.className = 'stake-autobet-btn stop';
            btn.innerHTML = `<span><i class="fa-solid fa-stop"></i> STOP AUTOBET</span><small>AUTO ROUNDS IN PROGRESS</small>`;
            if (statsPill) statsPill.classList.add('active');
        } else {
            btn.className = 'stake-autobet-btn start';
            btn.innerHTML = `<span><i class="fa-solid fa-play"></i> START AUTOBET</span><small>AUTO COLOR PREDICTION</small>`;
        }
    }

    updateAutobetLiveStats(state) {
        const betsEl = document.getElementById('cp-auto-stat-bets');
        const profitEl = document.getElementById('cp-auto-stat-profit');
        const autoBetInput = document.getElementById('cp-auto-bet-input');

        if (autoBetInput) autoBetInput.value = state.currentBet;

        if (betsEl) {
            const tot = state.totalBets > 0 ? state.totalBets : '∞';
            betsEl.textContent = `Round ${state.betsPlaced}/${tot}`;
        }
        if (profitEl) {
            const p = state.sessionNetProfit;
            const sign = p >= 0 ? '+' : '-';
            profitEl.textContent = `Net: ${sign}$${Math.abs(p).toFixed(2)}`;
            profitEl.className = `stats-profit ${p >= 0 ? 'positive' : 'negative'}`;
        }
    }
}

window.ColorSelectorGame = ColorSelectorGame;
