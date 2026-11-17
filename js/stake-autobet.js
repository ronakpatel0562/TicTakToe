// Stake.com Autobet Core Engine
// Handles Martingale, Profit/Loss Limits, Bet Scaling & Auto Orchestration

class StakeAutobetEngine {
    constructor(config = {}) {
        this.baseBet = config.baseBet || 10;
        this.currentBet = this.baseBet;
        this.totalBets = config.totalBets || 0; // 0 = infinite (∞)
        this.betsPlaced = 0;

        // On Win: 'reset' or 'increase'
        this.onWinAction = config.onWinAction || 'reset';
        this.onWinPercent = config.onWinPercent || 100;

        // On Loss: 'reset' or 'increase'
        this.onLossAction = config.onLossAction || 'reset';
        this.onLossPercent = config.onLossPercent || 100;

        // Stop conditions ($)
        this.stopOnProfit = config.stopOnProfit || 0; // 0 = disabled
        this.stopOnLoss = config.stopOnLoss || 0;     // 0 = disabled

        // Live session metrics
        this.isRunning = false;
        this.sessionNetProfit = 0;
        this.sessionWins = 0;
        this.sessionLosses = 0;

        // Callbacks
        this.onStart = config.onStart || null;
        this.onStop = config.onStop || null;
        this.onUpdate = config.onUpdate || null;
    }

    start() {
        this.isRunning = true;
        this.currentBet = this.baseBet;
        this.betsPlaced = 0;
        this.sessionNetProfit = 0;
        this.sessionWins = 0;
        this.sessionLosses = 0;

        if (this.onStart) this.onStart(this.getState());
        if (this.onUpdate) this.onUpdate(this.getState());
    }

    stop(reason = 'User stopped autobet') {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.onStop) this.onStop(reason, this.getState());
        if (this.onUpdate) this.onUpdate(this.getState());
    }

    /**
     * Record outcome of a completed round
     * @param {boolean} won - whether the round resulted in a win
     * @param {number} payout - total money returned from the round
     * @param {number} stake - money wagered in the round
     * @returns {boolean} - true if autobet should continue, false if stopped
     */
    recordResult(won, payout, stake) {
        if (!this.isRunning) return false;

        this.betsPlaced++;
        const profit = won ? (payout - stake) : -stake;
        this.sessionNetProfit += profit;

        if (won) {
            this.sessionWins++;
            if (this.onWinAction === 'reset') {
                this.currentBet = this.baseBet;
            } else if (this.onWinAction === 'increase') {
                const mult = 1 + (this.onWinPercent / 100);
                this.currentBet = Math.max(1, Math.round(this.currentBet * mult));
            }
        } else {
            this.sessionLosses++;
            if (this.onLossAction === 'reset') {
                this.currentBet = this.baseBet;
            } else if (this.onLossAction === 'increase') {
                const mult = 1 + (this.onLossPercent / 100);
                this.currentBet = Math.max(1, Math.round(this.currentBet * mult));
            }
        }

        // Check Stop on Profit
        if (this.stopOnProfit > 0 && this.sessionNetProfit >= this.stopOnProfit) {
            this.stop(`Profit target reached (+$${this.sessionNetProfit.toFixed(2)}) 🎯`);
            return false;
        }

        // Check Stop on Loss
        if (this.stopOnLoss > 0 && this.sessionNetProfit <= -this.stopOnLoss) {
            this.stop(`Stop-loss triggered (-$${Math.abs(this.sessionNetProfit).toFixed(2)}) 🛡️`);
            return false;
        }

        // Check Target Number of Bets
        if (this.totalBets > 0 && this.betsPlaced >= this.totalBets) {
            this.stop(`Completed all ${this.totalBets} auto bets! ✅`);
            return false;
        }

        // Check Wallet Balance
        if (typeof window !== 'undefined' && window.arcadeWallet && window.arcadeWallet.getBalance() < this.currentBet) {
            this.stop(`Insufficient balance for next bet ($${this.currentBet}) ⚠️`);
            return false;
        }

        if (this.onUpdate) this.onUpdate(this.getState());
        return true;
    }

    getState() {
        return {
            isRunning: this.isRunning,
            baseBet: this.baseBet,
            currentBet: this.currentBet,
            totalBets: this.totalBets,
            betsPlaced: this.betsPlaced,
            remainingBets: this.totalBets > 0 ? Math.max(0, this.totalBets - this.betsPlaced) : '∞',
            sessionNetProfit: this.sessionNetProfit,
            sessionWins: this.sessionWins,
            sessionLosses: this.sessionLosses
        };
    }
}

if (typeof window !== 'undefined') {
    window.StakeAutobetEngine = StakeAutobetEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StakeAutobetEngine;
}
