// Roulette Royale - Live Multiplayer European Roulette Game Engine
class RouletteGame {
    constructor() {
        this.canvas = document.getElementById('roulette-canvas');
        this.ctx = null;
        this.timerEl = document.getElementById('roulette-timer');
        this.periodEl = document.getElementById('roulette-period');
        this.historyBar = document.getElementById('roulette-history-chips');
        this.simBetsContainer = document.getElementById('roulette-sim-bets');
        this.resultNumEl = document.getElementById('roulette-result-num');
        this.resultDescEl = document.getElementById('roulette-result-desc');
        this.spinBtn = document.getElementById('roulette-spin-btn');
        this.clearBtn = document.getElementById('roulette-clear-btn');
        this.doubleBtn = document.getElementById('roulette-double-btn');
        this.betSummaryEl = document.getElementById('roulette-bet-summary');
        this.sideTitleEl = document.querySelector('.roulette-side-title');
        this.winSplashEl = document.getElementById('roulette-win-splash');
        this.simulatedBets = [];
        this.sideTitleEl = document.querySelector('.roulette-side-title');
        this.simulatedBets = [];

        // European Wheel Layout: 37 pockets (0 to 36) in authentic clockwise sequence
        this.wheelNumbers = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];

        this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

        // State
        this.roundTime = 25;
        this.timeLeft = 25;
        this.periodId = 1001;
        this.roundTimer = null;
        this.isSpinning = false;
        this.selectedChip = 10;
        this.playerBets = []; // { type: 'num'|'color'|'parity'|'range'|'dozen', val: ..., amount: ... }

        // Wheel Physics
        this.wheelAngle = 0;
        this.winningNumber = 0;

        // Persistent History
        const savedHistory = localStorage.getItem('arcade_roulette_history');
        if (savedHistory) {
            try {
                this.history = JSON.parse(savedHistory);
            } catch (e) {
                this.history = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6];
            }
        } else {
            this.history = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6];
        }

        this.init();
    }

    init() {
        if (!this.canvas) return;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.renderHistory();
        this.bindEvents();
        this.initAutobet();
        this.startCountdown();
        this.animateWheel();
        this.populateSimBets();
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(rect.width, rect.height || rect.width) || 370;
        if (size <= 0) return;
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    getColor(num) {
        if (num === 0) return 'zero';
        return this.redNumbers.includes(num) ? 'red' : 'black';
    }

    renderHistory() {
        if (!this.historyBar) return;
        this.historyBar.innerHTML = this.history.map((num, idx) => {
            const color = this.getColor(num);
            const isLatest = idx === 0 ? 'latest-chip' : '';
            return `<div class="roulette-chip ${color} ${isLatest}" title="Pocket ${num} (${color.toUpperCase()})">${num}</div>`;
        }).join('');
    }

    bindEvents() {
        // Chip selector buttons
        const chipBtns = document.querySelectorAll('.roulette-chip-selector');
        chipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.soundEngine) window.soundEngine.playClick();
                chipBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedChip = parseFloat(btn.dataset.val);
            });
        });

        // Green Zero cell
        const zeroCell = document.querySelector('.roulette-zero-cell');
        if (zeroCell) {
            zeroCell.addEventListener('click', () => this.placeBet('num', 0, zeroCell));
        }

        // Inside Number cells (1 to 36)
        const numCells = document.querySelectorAll('.roulette-num-cell');
        numCells.forEach(cell => {
            cell.addEventListener('click', () => {
                const num = parseInt(cell.dataset.num, 10);
                this.placeBet('num', num, cell);
            });
        });

        // Outside Bets (2x and 3x)
        const outsideBtns = document.querySelectorAll('.roulette-outside-btn');
        outsideBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const val = btn.dataset.val;
                this.placeBet(type, val, btn);
            });
        });

        // Clear bets
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                if (this.isSpinning) return;
                this.clearBets();
            });
        }

        // 2x Double Bets button
        if (this.doubleBtn) {
            this.doubleBtn.addEventListener('click', () => {
                if (this.isSpinning) return;
                this.doubleBets();
            });
        }
    }

    placeBet(type, val, element, customAmount = null) {
        if (this.isSpinning) {
            if (window.showToast) window.showToast('Wheel Spinning', 'Bets closed for this round! Watching wheel...', 'warning');
            return;
        }

        const betAmt = customAmount || this.selectedChip;

        // Check wallet
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(betAmt)) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Please add funds to place bets!', 'warning');
            if (window.paymentGateway) window.paymentGateway.open(betAmt * 5);
            return;
        }

        if (window.soundEngine) window.soundEngine.playClick();

        this.playerBets.push({
            type,
            val,
            amount: betAmt
        });

        this.updateBetSummary();
        this.renderBetBadges();
    }

    doubleBets() {
        if (this.isSpinning) {
            if (window.showToast) window.showToast('Wheel Spinning', 'Bets closed for this round! Watching wheel...', 'warning');
            return;
        }

        if (this.playerBets.length === 0) {
            // Double the active chip if no bets yet
            this.selectedChip = Math.min(500, Math.round(this.selectedChip * 2));
            if (window.showToast) window.showToast('Chip Doubled 2×', `Chip amount doubled to $${this.selectedChip}`, 'info');
            return;
        }

        const currentTotal = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
        if (!window.arcadeWallet || !window.arcadeWallet.deduct(currentTotal)) {
            if (window.showToast) window.showToast('Insufficient Balance', `Need $${currentTotal} more to 2× double all bets!`, 'warning');
            if (window.paymentGateway) window.paymentGateway.open(currentTotal * 2);
            return;
        }

        if (window.soundEngine) window.soundEngine.playClick();
        this.playerBets.forEach(b => {
            b.amount *= 2;
        });

        this.updateBetSummary();
        this.renderBetBadges();
        if (window.showToast) {
            window.showToast('Bets Doubled 2×', `All bets doubled! Total stake: $${currentTotal * 2}`, 'success');
        }
    }

    renderBetBadges() {
        // Remove existing badges
        document.querySelectorAll('.roulette-cell-badge').forEach(b => b.remove());
        document.querySelectorAll('.roulette-zero-cell, .roulette-num-cell, .roulette-outside-btn').forEach(el => {
            el.classList.remove('selected');
        });

        // Group bets
        const map = new Map();
        this.playerBets.forEach(b => {
            const key = `${b.type}_${b.val}`;
            map.set(key, (map.get(key) || 0) + b.amount);
        });

        map.forEach((totalAmt, key) => {
            const [type, val] = key.split('_');
            let el = null;
            if (type === 'num') {
                if (val === '0') el = document.querySelector('.roulette-zero-cell');
                else el = document.querySelector(`.roulette-num-cell[data-num="${val}"]`);
            } else {
                el = document.querySelector(`.roulette-outside-btn[data-type="${type}"][data-val="${val}"]`);
            }

            if (el) {
                el.classList.add('selected');
                const badge = document.createElement('span');
                badge.className = 'roulette-cell-badge';
                badge.textContent = `$${totalAmt}`;
                el.appendChild(badge);
            }
        });
    }

    clearBets() {
        if (this.playerBets.length === 0) return;
        const refund = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
        if (window.arcadeWallet) window.arcadeWallet.add(refund);

        this.playerBets = [];
        document.querySelectorAll('.roulette-cell-badge').forEach(b => b.remove());
        document.querySelectorAll('.roulette-zero-cell, .roulette-num-cell, .roulette-outside-btn').forEach(el => {
            el.classList.remove('selected');
        });

        this.updateBetSummary();
        if (window.soundEngine) window.soundEngine.playClick();
    }

    updateBetSummary() {
        if (!this.betSummaryEl) return;
        const total = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
        this.betSummaryEl.textContent = `Total Staked: $${total.toFixed(2)} (${this.playerBets.length} Bet${this.playerBets.length === 1 ? '' : 's'})`;
    }

    startCountdown() {
        if (this.roundTimer) clearInterval(this.roundTimer);
        this.timeLeft = this.roundTime;
        if (this.periodEl) this.periodEl.textContent = `#ROU${this.periodId}`;

        // Update result description with previous winning pocket details
        if (this.resultDescEl && this.history.length > 0) {
            const lastWin = this.history[0];
            const lastColor = this.getColor(lastWin);
            const colorName = lastWin === 0 ? 'ZERO (GREEN)' : (lastColor === 'red' ? 'RED' : 'BLACK');
            const parity = lastWin === 0 ? '' : (lastWin % 2 === 0 ? ' • EVEN' : ' • ODD');
            this.resultDescEl.textContent = `${colorName}${parity}`;
        }

        // Automated Stake.com Autobet Placement
        if (this.autobetEngine && this.autobetEngine.isRunning && this.playerBets.length === 0) {
            setTimeout(() => {
                if (this.autobetEngine && this.autobetEngine.isRunning && this.playerBets.length === 0 && !this.isSpinning) {
                    this.placeAutobetStake();
                }
            }, 600);
        }

        this.roundTimer = setInterval(() => {
            this.timeLeft--;

            if (this.timerEl) {
                this.timerEl.textContent = `00:${this.timeLeft < 10 ? '0' : ''}${this.timeLeft}`;
                this.timerEl.classList.toggle('warning', this.timeLeft <= 5);
            }

            // User can bet all the way through the last 5 seconds!
            // When timer reaches 0, close bets and start the unobstructed wheel spin!
            if (this.timeLeft <= 0) {
                clearInterval(this.roundTimer);
                this.roundTimer = null;
                if (this.timerEl) {
                    this.timerEl.textContent = 'SPIN';
                    this.timerEl.classList.remove('warning');
                }
                this.spinWheel();
            }
        }, 1000);
    }

    stop() {
        if (this.roundTimer) {
            clearInterval(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.timerEl) this.timerEl.classList.remove('warning');
        this.isSpinning = false;
    }

    activate() {
        this.resizeCanvas();
        if (!this.roundTimer && !this.isSpinning) {
            this.startCountdown();
        }
    }

    spinWheel() {
        try {
            this.isSpinning = true;
            // Select winning pocket (with 10% House Edge)
            const houseEdge = window.HOUSE_EDGE || 0.10;
            if (this.playerBets.length > 0 && Math.random() < houseEdge) {
                // In 10% of player-active rounds, house steers towards a house-advantageous pocket
                const coveredNums = new Set(this.playerBets.filter(b => b.type === 'num').map(b => b.val));
                const safePool = [];
                for (let i = 0; i < 37; i++) {
                    if (!coveredNums.has(i)) safePool.push(i);
                }
                if (safePool.includes(0) && Math.random() < 0.6) {
                    this.winningNumber = 0; // Green 0 wipes all outside bets
                } else if (safePool.length > 0) {
                    this.winningNumber = safePool[Math.floor(Math.random() * safePool.length)];
                } else {
                    this.winningNumber = 0;
                }
            } else {
                this.winningNumber = Math.floor(Math.random() * 37);
            }

            // Display spinning state
            if (this.resultNumEl) {
                this.resultNumEl.className = 'roulette-result-num';
                this.resultNumEl.textContent = '?';
            }
            if (this.resultDescEl) {
                this.resultDescEl.textContent = 'WHEEL SPINNING...';
            }

            const count = 37;
            const arc = (Math.PI * 2) / count;
            const pocketIndex = this.wheelNumbers.indexOf(this.winningNumber);
            const pocketCenterAngle = pocketIndex * arc + arc / 2;

            // Pointer is at TOP CENTER (12 o'clock, which is -Math.PI / 2 or 1.5 * Math.PI)
            const twoPi = Math.PI * 2;
            let normTarget = (1.5 * Math.PI - pocketCenterAngle) % twoPi;
            if (normTarget < 0) normTarget += twoPi;

            let normCurrent = this.wheelAngle % twoPi;
            if (normCurrent < 0) normCurrent += twoPi;

            let delta = normTarget - normCurrent;
            if (delta <= 0) delta += twoPi;

            // 6 to 8 full spins plus the exact angular delta to land squarely on the winning pocket
            const extraSpins = 6 + Math.floor(Math.random() * 3);
            const startWheelAngle = this.wheelAngle;
            const targetWheelAngle = startWheelAngle + extraSpins * twoPi + delta;

            const duration = 4800; // ms
            const startTime = performance.now();

            if (window.soundEngine && typeof window.soundEngine.playRouletteSpin === 'function') {
                window.soundEngine.playRouletteSpin();
            }

            const spinAnim = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(1, elapsed / duration);
                // Cubic ease out deceleration
                const easeOut = 1 - Math.pow(1 - progress, 3);

                this.wheelAngle = startWheelAngle + (targetWheelAngle - startWheelAngle) * easeOut;

                if (progress < 1) {
                    requestAnimationFrame(spinAnim);
                } else {
                    this.wheelAngle = targetWheelAngle; // Lock exactly to target
                    if (window.soundEngine && typeof window.soundEngine.playRouletteBallDrop === 'function') {
                        window.soundEngine.playRouletteBallDrop();
                    }
                    this.settleRound();
                }
            };

            requestAnimationFrame(spinAnim);
        } catch (err) {
            console.error('Roulette spin error:', err);
            this.settleRound();
        }
    }

    settleRound() {
        try {
            this.isSpinning = false;

            const winNum = this.winningNumber;
            const winColor = this.getColor(winNum);

            // Update result display
            if (this.resultNumEl) {
                this.resultNumEl.className = `roulette-result-num ${winColor}`;
                this.resultNumEl.textContent = winNum;
            }
            if (this.resultDescEl) {
                const colorName = winNum === 0 ? 'ZERO (GREEN)' : (winColor === 'red' ? 'RED' : 'BLACK');
                this.resultDescEl.textContent = `${colorName} • ${winNum % 2 === 0 && winNum !== 0 ? 'EVEN' : (winNum !== 0 ? 'ODD' : 'NEITHER')}`;
            }

            // Add to persistent history
            this.history.unshift(winNum);
            if (this.history.length > 15) this.history.pop();
            try {
                localStorage.setItem('arcade_roulette_history', JSON.stringify(this.history));
            } catch (e) { }
            this.renderHistory();
            this.settleSimBets(winNum);

            // Calculate Payouts
            let totalPayout = 0;
            let winningBets = [];

            this.playerBets.forEach(bet => {
                let won = false;
                let mult = 0;

                if (bet.type === 'num') {
                    if (bet.val === winNum) {
                        won = true;
                        mult = 36.0; // Straight up 36x payout
                        winningBets.push(`Number ${winNum} (36x)`);
                    }
                } else if (winNum !== 0) { // Green 0 beats all outside bets!
                    if (bet.type === 'color') {
                        if (bet.val === winColor) {
                            won = true;
                            mult = 2.0;
                            winningBets.push(`${winColor.toUpperCase()} (2x)`);
                        }
                    } else if (bet.type === 'parity') {
                        if (bet.val === 'even' && winNum % 2 === 0) {
                            won = true;
                            mult = 2.0;
                            winningBets.push('EVEN (2x)');
                        }
                        if (bet.val === 'odd' && winNum % 2 !== 0) {
                            won = true;
                            mult = 2.0;
                            winningBets.push('ODD (2x)');
                        }
                    } else if (bet.type === 'range') {
                        if (bet.val === 'low' && winNum >= 1 && winNum <= 18) {
                            won = true;
                            mult = 2.0;
                            winningBets.push('1-18 (2x)');
                        }
                        if (bet.val === 'high' && winNum >= 19 && winNum <= 36) {
                            won = true;
                            mult = 2.0;
                            winningBets.push('19-36 (2x)');
                        }
                    } else if (bet.type === 'dozen') {
                        if (bet.val === '1' && winNum >= 1 && winNum <= 12) {
                            won = true;
                            mult = 3.0;
                            winningBets.push('1st 12 (3x)');
                        }
                        if (bet.val === '2' && winNum >= 13 && winNum <= 24) {
                            won = true;
                            mult = 3.0;
                            winningBets.push('2nd 12 (3x)');
                        }
                        if (bet.val === '3' && winNum >= 25 && winNum <= 36) {
                            won = true;
                            mult = 3.0;
                            winningBets.push('3rd 12 (3x)');
                        }
                    }
                }

                if (won) {
                    const houseRtp = 1 - (window.HOUSE_EDGE || 0.10);
                    totalPayout += bet.amount * mult * houseRtp;
                }
            });

            // Trigger Winning Board & Splash Celebration
            this.highlightWinningBets(winNum);
            this.showWinSplash(winNum, totalPayout, winningBets);

            if (totalPayout > 0 && window.arcadeWallet) {
                window.arcadeWallet.add(totalPayout);
                if (window.soundEngine) {
                    if (typeof window.soundEngine.playRouletteWin === 'function') {
                        window.soundEngine.playRouletteWin();
                    } else if (typeof window.soundEngine.playWin === 'function') {
                        window.soundEngine.playWin();
                    }
                }
                if (window.triggerConfetti) window.triggerConfetti();
                if (window.showToast) {
                    const detail = winningBets.length > 0 ? ` on ${winningBets.join(', ')}` : '';
                    window.showToast('🎉 Roulette Winner!', `Won +$${totalPayout.toFixed(2)}${detail}! Pocket: ${winNum}`, 'success');
                }
            } else if (this.playerBets.length > 0) {
                if (window.soundEngine) {
                    if (typeof window.soundEngine.playRouletteLoss === 'function') {
                        window.soundEngine.playRouletteLoss();
                    } else if (typeof window.soundEngine.playLoss === 'function') {
                        window.soundEngine.playLoss();
                    }
                }
                if (window.showToast) {
                    const totalLost = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
                    window.showToast('No Win', `Pocket was ${winNum} (${winColor.toUpperCase()}). -$${totalLost.toFixed(2)}`, 'error');
                }
            }

            // Handle Stake Autobet Settlement
            if (this.autobetEngine && this.autobetEngine.isRunning) {
                const totalStaked = this.playerBets.reduce((sum, b) => sum + b.amount, 0);
                const won = totalPayout > totalStaked;
                this.autobetEngine.recordResult(won, totalPayout, totalStaked);
            }
        } catch (err) {
            console.error('Roulette settle error:', err);
        } finally {
            this.isSpinning = false;

            // Reset for next round
            setTimeout(() => {
                this.hideWinSplash();
                this.clearWinningHighlights();
                this.playerBets = [];
                this.periodId++;
                document.querySelectorAll('.roulette-cell-badge').forEach(b => b.remove());
                document.querySelectorAll('.roulette-zero-cell, .roulette-num-cell, .roulette-outside-btn').forEach(el => {
                    el.classList.remove('selected');
                });
                this.updateBetSummary();
                this.populateSimBets();
                this.startCountdown();
            }, 3500);
        }
    }

    highlightWinningBets(winNum) {
        this.clearWinningHighlights();

        const winColor = this.getColor(winNum);
        const winDozen = winNum === 0 ? null : (winNum <= 12 ? '1' : (winNum <= 24 ? '2' : '3'));
        const winParity = winNum === 0 ? null : (winNum % 2 === 0 ? 'even' : 'odd');
        const winRange = winNum === 0 ? null : (winNum <= 18 ? 'low' : 'high');

        // Highlight straight pocket
        if (winNum === 0) {
            const zeroCell = document.querySelector('.roulette-zero-cell');
            if (zeroCell) zeroCell.classList.add('roulette-winning-highlight');
        } else {
            const numCell = document.querySelector(`.roulette-num-cell[data-num="${winNum}"]`);
            if (numCell) numCell.classList.add('roulette-winning-highlight');

            // Highlight outside bets
            const colorBtn = document.querySelector(`.roulette-outside-btn[data-type="color"][data-val="${winColor}"]`);
            if (colorBtn) colorBtn.classList.add('roulette-winning-highlight');

            if (winParity) {
                const parityBtn = document.querySelector(`.roulette-outside-btn[data-type="parity"][data-val="${winParity}"]`);
                if (parityBtn) parityBtn.classList.add('roulette-winning-highlight');
            }

            if (winRange) {
                const rangeBtn = document.querySelector(`.roulette-outside-btn[data-type="range"][data-val="${winRange}"]`);
                if (rangeBtn) rangeBtn.classList.add('roulette-winning-highlight');
            }

            if (winDozen) {
                const dozenBtn = document.querySelector(`.roulette-outside-btn[data-type="dozen"][data-val="${winDozen}"]`);
                if (dozenBtn) dozenBtn.classList.add('roulette-winning-highlight');
            }
        }

        // Add aura to wheel and bounce pointer
        const wheelContainer = document.querySelector('.roulette-wheel-container');
        if (wheelContainer) wheelContainer.classList.add('winner-aura');
        const pointer = document.querySelector('.roulette-pointer');
        if (pointer) pointer.classList.add('winner-bounce');
    }

    clearWinningHighlights() {
        document.querySelectorAll('.roulette-winning-highlight').forEach(el => {
            el.classList.remove('roulette-winning-highlight');
        });
        const wheelContainer = document.querySelector('.roulette-wheel-container');
        if (wheelContainer) wheelContainer.classList.remove('winner-aura');
        const pointer = document.querySelector('.roulette-pointer');
        if (pointer) pointer.classList.remove('winner-bounce');
    }

    showWinSplash(winNum, totalPayout, winningBets) {
        if (!this.winSplashEl) return;
        const winColor = this.getColor(winNum);
        const colorName = winNum === 0 ? 'GREEN ZERO' : (winColor === 'red' ? 'RED' : 'BLACK');
        const parity = winNum === 0 ? '' : (winNum % 2 === 0 ? 'EVEN' : 'ODD');

        const badgeEl = this.winSplashEl.querySelector('.roulette-win-pocket-badge');
        const titleEl = this.winSplashEl.querySelector('.roulette-win-title');
        const amtEl = this.winSplashEl.querySelector('.roulette-win-amount');
        const detailsEl = this.winSplashEl.querySelector('.roulette-win-details');

        if (badgeEl) {
            badgeEl.className = `roulette-win-pocket-badge ${winColor}`;
            badgeEl.textContent = winNum;
        }

        if (totalPayout > 0) {
            if (titleEl) {
                titleEl.textContent = '🎉 YOU WON!';
                titleEl.style.color = '#f59e0b';
            }
            if (amtEl) {
                amtEl.style.display = 'block';
                amtEl.textContent = `+$${totalPayout.toFixed(2)}`;
            }
            if (detailsEl) {
                detailsEl.textContent = `${colorName} ${parity ? '• ' + parity : ''}`;
            }
        } else {
            if (titleEl) {
                titleEl.textContent = `POCKET ${winNum}`;
                titleEl.style.color = '#ffffff';
            }
            if (amtEl) {
                amtEl.style.display = 'none';
            }
            if (detailsEl) {
                detailsEl.textContent = `${colorName} ${parity ? '• ' + parity : ''}`;
            }
        }

        this.winSplashEl.classList.add('active');
    }

    hideWinSplash() {
        if (this.winSplashEl) {
            this.winSplashEl.classList.remove('active');
        }
    }

    getRandomUsername() {
        const prefixes = [
            'Crypto', 'Apex', 'Neon', 'Lucky', 'Vegas', 'Golden', 'Cyber', 'Shadow',
            'Blaze', 'Quantum', 'Diamond', 'Phantom', 'Turbo', 'Mystic', 'Iron', 'Solar',
            'Alpha', 'Omega', 'Viper', 'Frost', 'Thunder', 'Titan', 'Cosmic', 'Pixel',
            'Savage', 'Echo', 'Drift', 'Nova', 'Hyper', 'Zenith', 'Ace', 'HighRoller',
            'Bullet', 'Matrix', 'Royal', 'Falcon', 'Rebel', 'Rocket', 'Stealth', 'Sonic'
        ];
        const suffixes = [
            'Wolf', 'Queen', 'Pilot', 'VIP', 'Rider', 'Pro', 'Gazer', 'King', 'Strike',
            'Samurai', 'Hunter', 'Blade', 'Master', 'Knight', 'Lord', 'Fox', 'Eagle',
            'Whale', 'Legend', 'Shredder', 'Hawk', 'Sniper', 'Captain', 'Gambler', 'Champ',
            'Boss', 'Titan', 'Ace', 'Baron', 'Duke'
        ];
        const p = prefixes[Math.floor(Math.random() * prefixes.length)];
        const s = suffixes[Math.floor(Math.random() * suffixes.length)];
        const tag = Math.random() < 0.35 ? `${Math.floor(Math.random() * 90 + 10)}` : (Math.random() < 0.2 ? '_VIP' : '');
        return `${p}${s}${tag}`;
    }

    getRandomAmount() {
        const amounts = [5, 10, 15, 20, 25, 35, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000];
        return amounts[Math.floor(Math.random() * amounts.length)];
    }

    getRandomUsername() {
        const prefixes = [
            'Crypto', 'Apex', 'Neon', 'Lucky', 'Vegas', 'Golden', 'Cyber', 'Shadow',
            'Blaze', 'Quantum', 'Diamond', 'Phantom', 'Turbo', 'Mystic', 'Iron', 'Solar',
            'Alpha', 'Omega', 'Viper', 'Frost', 'Thunder', 'Titan', 'Cosmic', 'Pixel',
            'Savage', 'Echo', 'Drift', 'Nova', 'Hyper', 'Zenith', 'Ace', 'HighRoller',
            'Bullet', 'Matrix', 'Royal', 'Falcon', 'Rebel', 'Rocket', 'Stealth', 'Sonic'
        ];
        const suffixes = [
            'Wolf', 'Queen', 'Pilot', 'VIP', 'Rider', 'Pro', 'Gazer', 'King', 'Strike',
            'Samurai', 'Hunter', 'Blade', 'Master', 'Knight', 'Lord', 'Fox', 'Eagle',
            'Whale', 'Legend', 'Shredder', 'Hawk', 'Sniper', 'Captain', 'Gambler', 'Champ',
            'Boss', 'Titan', 'Ace', 'Baron', 'Duke'
        ];
        const p = prefixes[Math.floor(Math.random() * prefixes.length)];
        const s = suffixes[Math.floor(Math.random() * suffixes.length)];
        const tag = Math.random() < 0.35 ? `${Math.floor(Math.random() * 90 + 10)}` : (Math.random() < 0.2 ? '_VIP' : '');
        return `${p}${s}${tag}`;
    }

    getRandomAmount() {
        const amounts = [5, 10, 15, 20, 25, 35, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000];
        return amounts[Math.floor(Math.random() * amounts.length)];
    }

    populateSimBets() {
        if (!this.simBetsContainer) return;
        const allTargets = [
            'RED', 'BLACK', 'EVEN', 'ODD', '1-18', '19-36',
            '1st 12', '2nd 12', '3rd 12', '0 (Green)',
            '7', '11', '17', '21', '26', '32', '36', '8', '14', '29', '3'
        ];

        // Random number of active players (8 to 12)
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
                    <div class="roulette-player-item winning">
                        <span class="roulette-player-name"><i class="fa-solid fa-crown" style="color:#f59e0b;"></i> ${b.name}</span>
                        <span class="roulette-player-target">${b.target}</span>
                        <span class="roulette-player-win-badge">+$${b.payout}</span>
                    </div>
                `;
            }
            return `
                <div class="roulette-player-item">
                    <span class="roulette-player-name"><i class="fa-solid fa-user-circle"></i> ${b.name}</span>
                    <span class="roulette-player-target">${b.target}</span>
                    <span class="roulette-player-bet">$${b.amount}</span>
                </div>
            `;
        }).join('');
    }

    settleSimBets(winNum) {
        if (!this.simBetsContainer || !this.simulatedBets || this.simulatedBets.length === 0) return;

        const winColor = this.getColor(winNum);
        const winDozen = winNum === 0 ? null : (winNum <= 12 ? '1st 12' : (winNum <= 24 ? '2nd 12' : '3rd 12'));
        const winParity = winNum === 0 ? null : (winNum % 2 === 0 ? 'EVEN' : 'ODD');
        const winRange = winNum === 0 ? null : (winNum <= 18 ? '1-18' : '19-36');
        const colorName = winNum === 0 ? '0 (Green)' : (winColor === 'red' ? 'RED' : 'BLACK');

        // Target pool of valid winning bets for this outcome
        const winningOptions = [
            { target: colorName, mult: 2.0 },
            { target: `${winNum}`, mult: 36.0 }
        ];
        if (winParity) winningOptions.push({ target: winParity, mult: 2.0 });
        if (winRange) winningOptions.push({ target: winRange, mult: 2.0 });
        if (winDozen) winningOptions.push({ target: winDozen, mult: 3.0 });

        // A random number of winning bets each round (2 to 5 winners)
        const maxWinners = Math.min(this.simulatedBets.length, 5);
        const minWinners = Math.min(2, maxWinners);
        const winnersCount = Math.floor(Math.random() * (maxWinners - minWinners + 1)) + minWinners;

        // Shuffle player indices to pick random winners
        const indices = this.simulatedBets.map((_, i) => i).sort(() => Math.random() - 0.5);
        const winnerIndices = new Set(indices.slice(0, winnersCount));

        this.simulatedBets.forEach((p, idx) => {
            if (winnerIndices.has(idx)) {
                // Assign a winning bet option
                const opt = winningOptions[Math.floor(Math.random() * winningOptions.length)];
                p.target = opt.target;
                p.won = true;
                p.payout = Math.round(p.amount * opt.mult);
            } else {
                p.won = false;
                p.payout = 0;
            }
        });

        // Sort so winning bets appear at the top!
        this.simulatedBets.sort((a, b) => (b.won ? 1 : 0) - (a.won ? 1 : 0));

        if (this.sideTitleEl) {
            this.sideTitleEl.innerHTML = `<i class="fa-solid fa-trophy" style="color:#f59e0b;"></i> <span style="color:#10b981; font-weight:800;">${winnersCount} Winning Bets!</span>`;
        }

        this.renderSimBets();
    }

    animateWheel() {
        this.drawWheel();
        requestAnimationFrame(() => this.animateWheel());
    }

    drawWheel() {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 10;

        this.ctx.clearRect(0, 0, w, h);

        const count = 37;
        const arc = (Math.PI * 2) / count;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.wheelAngle);

        // Draw Outer Rim with gold trim
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#d97706';
        this.ctx.stroke();

        // Draw Pockets
        for (let i = 0; i < count; i++) {
            const num = this.wheelNumbers[i];
            const angle = i * arc;

            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.arc(0, 0, radius - 4, angle, angle + arc);
            this.ctx.closePath();

            if (num === 0) {
                this.ctx.fillStyle = '#059669'; // Green Zero
            } else if (this.redNumbers.includes(num)) {
                this.ctx.fillStyle = '#dc2626'; // Red
            } else {
                this.ctx.fillStyle = '#111827'; // Dark Black
            }
            this.ctx.fill();
            this.ctx.strokeStyle = '#475569';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Pocket numbers - Large, crisp, bold font
            this.ctx.save();
            this.ctx.rotate(angle + arc / 2);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = '#ffffff';
            const pocketFontSize = Math.max(10, Math.floor(radius * 0.088));
            this.ctx.font = `800 ${pocketFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            this.ctx.fillText(num.toString(), radius - 12, pocketFontSize * 0.36);
            this.ctx.restore();
        }

        // Center hub - Outer cone
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.36, 0, Math.PI * 2);
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fill();
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.stroke();

        // Center hub - Inner turret
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
        this.ctx.fillStyle = '#2563eb';
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#93c5fd';
        this.ctx.stroke();

        this.ctx.restore();
    }

    initAutobet() {
        this.autobetEngine = null;

        // Tabs
        const tabBtns = document.querySelectorAll('#roulette-tabs .stake-tab-btn');
        const liveSection = document.getElementById('roulette-live-section');
        const autoPanel = document.getElementById('roulette-auto-panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                if (tab === 'auto') {
                    if (liveSection) liveSection.style.display = 'none';
                    if (autoPanel) autoPanel.style.display = 'flex';
                } else {
                    if (liveSection) liveSection.style.display = 'block';
                    if (autoPanel) autoPanel.style.display = 'none';
                }
            });
        });

        // Halve / Double
        const halfBtn = document.getElementById('roulette-auto-half');
        const doubleBtn = document.getElementById('roulette-auto-double');
        const betInput = document.getElementById('roulette-auto-bet-input');

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
        const presetBtns = document.querySelectorAll('#roulette-auto-presets .stake-pill-btn');
        const totalBetsInput = document.getElementById('roulette-auto-total-bets');
        const infLabel = document.getElementById('roulette-auto-inf-label');

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
        this.bindSegmentedToggle('roulette-onwin-toggle', 'roulette-onwin-pct-wrap');
        this.bindSegmentedToggle('roulette-onloss-toggle', 'roulette-onloss-pct-wrap');

        // Start / Stop Autobet Button
        const autobetBtn = document.getElementById('roulette-autobet-btn');
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
        const betInput = document.getElementById('roulette-auto-bet-input');
        const totalBetsInput = document.getElementById('roulette-auto-total-bets');
        const onWinBtn = document.querySelector('#roulette-onwin-toggle .stake-segment-btn.active');
        const onWinPctInput = document.getElementById('roulette-onwin-pct-input');
        const onLossBtn = document.querySelector('#roulette-onloss-toggle .stake-segment-btn.active');
        const onLossPctInput = document.getElementById('roulette-onloss-pct-input');
        const stopProfitInput = document.getElementById('roulette-auto-stop-profit');
        const stopLossInput = document.getElementById('roulette-auto-stop-loss');

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
                if (window.showToast) window.showToast('Roulette Autobet Stopped', reason, 'info');
            },
            onUpdate: (state) => {
                this.updateAutobetLiveStats(state);
            }
        });

        this.autobetEngine.start();

        // If betting is currently open (timeLeft > 5), place immediately
        if (!this.isSpinning && this.timeLeft > 5 && this.playerBets.length === 0) {
            this.placeAutobetStake();
        }
    }

    placeAutobetStake() {
        if (!this.autobetEngine || !this.autobetEngine.isRunning) return;
        const targetSelect = document.getElementById('roulette-auto-target-select');
        const target = targetSelect ? targetSelect.value : 'repeat';
        const currentBet = this.autobetEngine.currentBet;

        if (target === 'repeat') {
            if (this.playerBets.length === 0) {
                // If board was empty, default to Red
                this.placeBet('color', 'red', null, currentBet);
            }
        } else if (target === 'red' || target === 'black') {
            this.placeBet('color', target, null, currentBet);
        } else if (target === 'even' || target === 'odd') {
            this.placeBet('parity', target, null, currentBet);
        } else if (target === 'low' || target === 'high') {
            this.placeBet('range', target, null, currentBet);
        } else if (target === 'dozen1') {
            this.placeBet('dozen', '1', null, currentBet);
        } else if (target === 'dozen2') {
            this.placeBet('dozen', '2', null, currentBet);
        } else if (target === 'dozen3') {
            this.placeBet('dozen', '3', null, currentBet);
        } else if (target === 'zero') {
            this.placeBet('num', '0', null, currentBet);
        }
    }

    stopAutobet(reason) {
        if (this.autobetEngine) {
            this.autobetEngine.stop(reason);
        }
        this.updateAutobetButtonUI(false);
    }

    updateAutobetButtonUI(running) {
        const btn = document.getElementById('roulette-autobet-btn');
        const statsPill = document.getElementById('roulette-auto-stats-pill');
        if (!btn) return;

        if (running) {
            btn.className = 'stake-autobet-btn stop';
            btn.innerHTML = `<span><i class="fa-solid fa-stop"></i> STOP AUTOBET</span><small>AUTO SPINS RUNNING</small>`;
            if (statsPill) statsPill.classList.add('active');
        } else {
            btn.className = 'stake-autobet-btn start';
            btn.innerHTML = `<span><i class="fa-solid fa-play"></i> START AUTOBET</span><small>AUTO ROULETTE SPINS</small>`;
        }
    }

    updateAutobetLiveStats(state) {
        const betsEl = document.getElementById('roulette-auto-stat-bets');
        const profitEl = document.getElementById('roulette-auto-stat-profit');
        const autoBetInput = document.getElementById('roulette-auto-bet-input');

        if (autoBetInput) autoBetInput.value = state.currentBet;

        if (betsEl) {
            const tot = state.totalBets > 0 ? state.totalBets : '∞';
            betsEl.textContent = `Spin ${state.betsPlaced}/${tot}`;
        }
        if (profitEl) {
            const p = state.sessionNetProfit;
            const sign = p >= 0 ? '+' : '-';
            profitEl.textContent = `Net: ${sign}$${Math.abs(p).toFixed(2)}`;
            profitEl.className = `stats-profit ${p >= 0 ? 'positive' : 'negative'}`;
        }
    }
}

window.RouletteGame = RouletteGame;
