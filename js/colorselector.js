// Color Prediction Game (Win Go / Color Parity Live Multi-Person Betting)
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
        this.betSummaryEl = document.getElementById('cp-bet-summary');

        // Pools
        this.poolGreenEl = document.getElementById('cp-pool-green');
        this.poolVioletEl = document.getElementById('cp-pool-violet');
        this.poolRedEl = document.getElementById('cp-pool-red');

        // Lists & Tables
        this.liveListEl = document.getElementById('cp-live-list');
        this.myBetsTableEl = document.getElementById('cp-my-bets-table');
        this.parityTableEl = document.getElementById('cp-parity-table');

        // Betting buttons
        this.colorBtns = document.querySelectorAll('.cp-btn-color');
        this.numBtns = document.querySelectorAll('.cp-btn-num');
        this.sizeBtns = document.querySelectorAll('.cp-btn-size');
        this.chipBtns = document.querySelectorAll('.cp-chip-btn');
        this.tabBtns = document.querySelectorAll('.cp-tab-btn');
        this.tabPanes = document.querySelectorAll('.cp-tab-pane');

        // State
        this.period = this.initPeriod();
        this.timer = 30; // 30-second rounds
        this.timerInterval = null;
        this.isLocked = false;
        this.selectedTarget = 'green'; // 'green', 'violet', 'red', 'num_X', 'big', 'small'
        this.selectedTargetType = 'color'; // 'color', 'number', 'size'
        this.selectedAmount = 10;
        this.activeUserBets = [];
        this.userBetHistory = [];
        this.history = [];
        this.communityBets = [];

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
    }

    getColorForNum(num) {
        if (num === 0) return 'split-red';
        if (num === 5) return 'split-green';
        if ([1, 3, 7, 9].includes(num)) return 'green';
        return 'red';
    }

    bindEvents() {
        // Color Betting
        this.colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isLocked) return;
                window.soundEngine.playClick();
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
                window.soundEngine.playClick();
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
                window.soundEngine.playClick();
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
                window.soundEngine.playClick();
                this.chipBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedAmount = parseInt(btn.dataset.val, 10);
                this.updateBetSummary();
            });
        });

        // Confirm Bet
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => {
                this.placeBet();
            });
        }

        // Tabs
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.soundEngine.playClick();
                const targetTab = btn.dataset.tab;

                this.tabBtns.forEach(b => b.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const pane = document.getElementById(`cp-tab-${targetTab}`);
                if (pane) pane.classList.add('active');
            });
        });

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
            targetLabel = `NUMBER ${this.selectedTarget.replace('num_', '')}`;
            oddsLabel = '9.0x';
        } else {
            targetLabel = this.selectedTarget.toUpperCase();
            oddsLabel = '2.0x';
        }

        this.betSummaryEl.innerHTML = `Bet: <strong>${targetLabel}</strong> (${oddsLabel}) • Amount: <strong>$${this.selectedAmount}</strong>`;
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

        window.soundEngine.playClick();

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

        if (window.showToast) {
            window.showToast('Bet Placed! 🎯', `Successfully placed $${this.selectedAmount} on ${this.selectedTarget.toUpperCase()} for Period #${this.period}`, 'success');
        }

        this.renderMyBetsTable();
    }

    startRound() {
        this.timer = 30;
        this.isLocked = false;
        this.activeUserBets = [];
        this.communityBets = [];

        if (this.periodValEl) this.periodValEl.textContent = `#${this.period}`;
        if (this.lockOverlayEl) this.lockOverlayEl.classList.remove('active');
        if (this.confirmBtn) this.confirmBtn.disabled = false;
        if (this.stageStatusEl) this.stageStatusEl.textContent = 'Betting Open';
        if (this.resultBannerEl) this.resultBannerEl.innerHTML = '<span style="color:var(--text-muted)">Waiting for countdown...</span>';

        // Reset orb
        if (this.revealOrbEl) {
            this.revealOrbEl.className = 'cp-reveal-orb';
            this.revealOrbEl.textContent = '?';
        }

        // Randomize initial pool bases
        this.poolGreen = Math.floor(10000 + Math.random() * 8000);
        this.poolViolet = Math.floor(2500 + Math.random() * 2500);
        this.poolRed = Math.floor(11000 + Math.random() * 8000);
        this.updatePoolsUI();

        this.renderLiveCommunityList();
        this.renderMyBetsTable();

        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            this.tick();
        }, 1000);
    }

    tick() {
        this.timer--;

        // Timer clock display
        if (this.timerClockEl) {
            const min = String(Math.floor(this.timer / 60)).padStart(2, '0');
            const sec = String(this.timer % 60).padStart(2, '0');
            this.timerClockEl.textContent = `${min}:${sec}`;
            this.timerClockEl.classList.toggle('warning', this.timer <= 5);
        }

        // Simulate multi-person community bets streaming in
        if (this.timer > 5 && Math.random() > 0.25) {
            this.addSimulatedCommunityBet();
        }

        // Lock betting at 5 seconds
        if (this.timer === 5) {
            this.lockBetting();
        }

        // Lock countdown overlay update
        if (this.timer <= 5 && this.timer > 0) {
            if (this.lockCountdownEl) this.lockCountdownEl.textContent = this.timer;
            if (window.soundEngine) window.soundEngine.playClick();
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
        if (this.lockOverlayEl) this.lockOverlayEl.classList.add('active');
        if (this.stageStatusEl) this.stageStatusEl.textContent = 'Betting Locked';
        if (this.lockCountdownEl) this.lockCountdownEl.textContent = '5';
    }

    addSimulatedCommunityBet() {
        const users = [
            'Alex_99', 'Rahul_Pro', 'CryptoKing', 'Priya_Trader', 'Vikram_Ace',
            'Sophia_VIP', 'GamerX', 'Zara_B', 'Neo_Matrix', 'David_7',
            'Sam_Ace', 'Elena_Pro', 'Trader_Max', 'Arjun_K', 'Maya_R'
        ];
        const amounts = [10, 20, 50, 100, 200, 500, 1000];
        const targetTypes = ['color', 'color', 'color', 'size', 'num'];
        const colors = ['green', 'red', 'violet'];

        const user = users[Math.floor(Math.random() * users.length)];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        const tType = targetTypes[Math.floor(Math.random() * targetTypes.length)];

        let target = '';
        let targetClass = '';

        if (tType === 'color') {
            target = colors[Math.floor(Math.random() * colors.length)];
            targetClass = target;
            if (target === 'green') this.poolGreen += amount;
            else if (target === 'red') this.poolRed += amount;
            else this.poolViolet += amount;
        } else if (tType === 'size') {
            target = Math.random() > 0.5 ? 'Big' : 'Small';
            targetClass = 'size';
        } else {
            const num = Math.floor(Math.random() * 10);
            target = `Num ${num}`;
            targetClass = 'num';
        }

        this.communityBets.unshift({
            user,
            target: target.toUpperCase(),
            targetClass,
            amount: `$${amount.toLocaleString()}`
        });

        if (this.communityBets.length > 20) this.communityBets.pop();

        this.updatePoolsUI();
        this.renderLiveCommunityList();
    }

    updatePoolsUI() {
        if (this.poolGreenEl) this.poolGreenEl.textContent = `$${this.poolGreen.toLocaleString()}`;
        if (this.poolVioletEl) this.poolVioletEl.textContent = `$${this.poolViolet.toLocaleString()}`;
        if (this.poolRedEl) this.poolRedEl.textContent = `$${this.poolRed.toLocaleString()}`;
    }

    renderLiveCommunityList() {
        if (!this.liveListEl) return;
        this.liveListEl.innerHTML = this.communityBets.map(b => `
            <div class="cp-live-item">
                <div class="cp-live-user">
                    <div class="cp-live-avatar"><i class="fa-solid fa-user"></i></div>
                    <span>${b.user}</span>
                </div>
                <span class="cp-live-target ${b.targetClass}">${b.target}</span>
                <span class="cp-live-amount">${b.amount}</span>
            </div>
        `).join('');
    }

    revealResult() {
        if (this.lockOverlayEl) this.lockOverlayEl.classList.remove('active');
        if (this.stageStatusEl) this.stageStatusEl.textContent = 'Revealing Result...';

        // Winning Number: 0 to 9
        const winNum = Math.floor(Math.random() * 10);
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
            if (window.soundEngine) window.soundEngine.playAviatorCashout();
            if (window.triggerConfetti) window.triggerConfetti();

            if (window.showToast) {
                window.showToast('Congratulations! 💰', `You won +$${totalWon.toLocaleString()} on Period #${this.period}!`, 'success');
            }
        } else if (this.activeUserBets.length > 0) {
            if (window.soundEngine) window.soundEngine.playDraw();
            if (window.showToast) {
                window.showToast('Round Ended', `Period #${this.period} result was ${winNum} ${colorName}. Good luck on the next round!`, 'info');
            }
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
        this.historyBarEl.innerHTML = this.history.slice(0, 15).map(h => `
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
                    <th>Number</th>
                    <th>Color</th>
                    <th>Big/Small</th>
                </tr>
            </thead>
            <tbody>
                ${this.history.slice(0, 15).map(h => `
                    <tr>
                        <td>#${h.period}</td>
                        <td><strong style="font-size:1.05rem;">${h.num}</strong></td>
                        <td><span class="cp-dot ${h.color}"></span> ${h.color.replace('split-', '').toUpperCase()}</td>
                        <td><strong>${h.size}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    }

    renderMyBetsTable() {
        if (!this.myBetsTableEl) return;
        if (this.userBetHistory.length === 0) {
            this.myBetsTableEl.innerHTML = `
                <tbody>
                    <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">No bets placed yet. Join Green, Violet, Red, or pick a direct number!</td></tr>
                </tbody>
            `;
            return;
        }

        this.myBetsTableEl.innerHTML = `
            <thead>
                <tr>
                    <th>Period</th>
                    <th>Selection</th>
                    <th>Bet</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${this.userBetHistory.slice(0, 15).map(b => `
                    <tr>
                        <td>#${b.period}</td>
                        <td><strong>${b.target}</strong></td>
                        <td>$${b.amount}</td>
                        <td class="${b.isWin ? 'cp-badge-win' : 'cp-badge-loss'}">${b.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    }

    start() {
        if (!this.timerInterval) {
            this.startRound();
        }
    }

    stop() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

// Global exposure
window.ColorSelectorGame = ColorSelectorGame;
