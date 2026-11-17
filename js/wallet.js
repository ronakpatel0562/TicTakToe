// Wallet & Global Arcade State Management
// Global Casino Configuration: 10% House Edge across all casino games
window.HOUSE_EDGE = 0.10;
window.HOUSE_RTP = 0.90;

class ArcadeWallet {
    constructor() {
        this.houseEdge = 0.10;
        this.houseRtp = 0.90;
        this.balanceKey = 'arcade_balance';
        this.statsKey = 'arcade_stats';
        this.txnKey = 'arcade_transactions';
        this.listeners = [];
        this.init();
    }

    init() {
        let savedBalance = localStorage.getItem(this.balanceKey);
        if (savedBalance === null || isNaN(parseFloat(savedBalance))) {
            this.balance = 1000.00;
            this.save();
        } else {
            this.balance = parseFloat(savedBalance);
        }

        let savedStats = localStorage.getItem(this.statsKey);
        if (savedStats) {
            try {
                this.stats = Object.assign(this.getDefaultStats(), JSON.parse(savedStats));
            } catch (e) {
                this.stats = this.getDefaultStats();
            }
        } else {
            this.stats = this.getDefaultStats();
            this.saveStats();
        }

        let savedTxns = localStorage.getItem(this.txnKey);
        if (savedTxns) {
            try {
                this.transactions = JSON.parse(savedTxns);
            } catch (e) {
                this.transactions = [];
            }
        } else {
            this.transactions = [
                {
                    id: 'TXN_' + Math.floor(10000000 + Math.random() * 90000000),
                    type: 'deposit',
                    title: 'Welcome Arcade Bonus',
                    method: 'System Credit',
                    amount: 1000.00,
                    time: 'Initial Credit',
                    status: 'COMPLETED'
                }
            ];
            this.saveTxns();
        }
    }

    getDefaultStats() {
        return {
            aviator: {
                totalBets: 0,
                totalWon: 0,
                highestMultiplier: 1.00,
                biggestWin: 0
            },
            tictactoe: {
                played: 0,
                xWins: 0,
                oWins: 0,
                ties: 0
            },
            sudoku: {
                gamesCompleted: 0,
                bestTime: null
            },
            game2048: {
                bestScore: 0,
                maxTile: 0
            },
            minesweeper: {
                won: 0,
                bestTime: null
            },
            mines: {
                totalBets: 0,
                totalWon: 0,
                highestMultiplier: 1.00,
                biggestWin: 0
            },
            snake: {
                highScore: 0,
                totalFood: 0
            },
            colorSelector: {
                highScore: 0,
                bestLevel: 0,
                highestRank: 'Novice'
            },
            connect4: {
                played: 0,
                playerWins: 0,
                aiWins: 0,
                ties: 0
            },
            plinko: {
                totalDrops: 0,
                totalWon: 0,
                biggestWin: 0
            },
            memory: {
                completed: 0,
                bestMoves: null,
                bestTime: null
            },
            wordle: {
                played: 0,
                won: 0,
                currentStreak: 0,
                maxStreak: 0
            },
            roulette: {
                totalBets: 0,
                totalWon: 0,
                biggestWin: 0
            }
        };
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.balance);
    }

    notify() {
        this.listeners.forEach(fn => fn(this.balance));
    }

    getBalance() {
        return this.balance;
    }

    save() {
        localStorage.setItem(this.balanceKey, this.balance.toFixed(2));
        this.notify();
    }

    saveStats() {
        localStorage.setItem(this.statsKey, JSON.stringify(this.stats));
    }

    saveTxns() {
        localStorage.setItem(this.txnKey, JSON.stringify(this.transactions));
    }

    addTransaction(txn) {
        if (!txn.id) txn.id = 'TXN_' + Date.now();
        if (!txn.time) {
            const now = new Date();
            txn.time = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (!txn.status) txn.status = 'COMPLETED';
        this.transactions.unshift(txn);
        if (this.transactions.length > 50) this.transactions.pop();
        this.saveTxns();
    }

    getTransactions() {
        return this.transactions;
    }

    deduct(amount) {
        if (this.balance >= amount) {
            this.balance -= amount;
            this.save();
            return true;
        }
        return false;
    }

    add(amount) {
        this.balance += amount;
        this.save();
    }

    resetBalance(amount = 1000.00) {
        this.balance = amount;
        this.save();
    }

    format(amount = this.balance) {
        return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

window.arcadeWallet = new ArcadeWallet();

