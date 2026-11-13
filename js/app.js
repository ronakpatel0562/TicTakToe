// Main App Orchestration, Routing & Navigation
document.addEventListener('DOMContentLoaded', () => {
    // Game instances
    let tttInstance = null;
    let sudokuInstance = null;
    let aviatorInstance = null;
    let game2048Instance = null;
    let minesweeperInstance = null;
    let snakeInstance = null;
    let colorSelectorInstance = null;
    let rocketInstance = null;
    let connect4Instance = null;
    let plinkoInstance = null;
    let memoryInstance = null;
    let wordleInstance = null;
    let rouletteInstance = null;

    // Elements
    const views = {
        home: document.getElementById('view-home'),
        tictactoe: document.getElementById('view-tictactoe'),
        sudoku: document.getElementById('view-sudoku'),
        aviator: document.getElementById('view-aviator'),
        rocket: document.getElementById('view-rocket'),
        colorselector: document.getElementById('view-colorselector'),
        roulette: document.getElementById('view-roulette'),
        plinko: document.getElementById('view-plinko'),
        connect4: document.getElementById('view-connect4'),
        minesweeper: document.getElementById('view-minesweeper'),
        game2048: document.getElementById('view-game2048'),
        snake: document.getElementById('view-snake'),
        memory: document.getElementById('view-memory'),
        wordle: document.getElementById('view-wordle')
    };

    const navLobbyBtn = document.getElementById('nav-lobby-btn');
    const navSoundBtn = document.getElementById('nav-sound-btn');
    const navThemeBtn = document.getElementById('nav-theme-btn');
    const navWalletBalance = document.getElementById('nav-wallet-balance');
    const navAddFundsBtn = document.getElementById('nav-add-funds-btn');

    // Home game selection cards
    const cardTTT = document.getElementById('card-tictactoe');
    const cardSudoku = document.getElementById('card-sudoku');
    const cardAviator = document.getElementById('card-aviator');
    const cardRocket = document.getElementById('card-rocket');
    const cardColorSelector = document.getElementById('card-colorselector');
    const cardRoulette = document.getElementById('card-roulette');
    const cardPlinko = document.getElementById('card-plinko');
    const cardConnect4 = document.getElementById('card-connect4');
    const cardMinesweeper = document.getElementById('card-minesweeper');
    const card2048 = document.getElementById('card-game2048');
    const cardSnake = document.getElementById('card-snake');
    const cardMemory = document.getElementById('card-memory');
    const cardWordle = document.getElementById('card-wordle');

    // In-game return home buttons
    const returnButtons = document.querySelectorAll('.return-home-btn');

    // Modal elements
    const refillModal = document.getElementById('refill-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const refillAmounts = document.querySelectorAll('.refill-opt-btn');

    // Initialize Wallet UI sync
    window.arcadeWallet.subscribe((balance) => {
        if (navWalletBalance) {
            navWalletBalance.textContent = window.arcadeWallet.format(balance);
        }
    });

    // Sound button toggle
    if (navSoundBtn) {
        const updateSoundIcon = () => {
            const isMuted = window.soundEngine.muted;
            navSoundBtn.innerHTML = isMuted 
                ? '<i class="fa-solid fa-volume-xmark"></i>' 
                : '<i class="fa-solid fa-volume-high"></i>';
            navSoundBtn.classList.toggle('muted', isMuted);
        };
        updateSoundIcon();

        navSoundBtn.addEventListener('click', () => {
            const muted = window.soundEngine.toggleMute();
            updateSoundIcon();
            if (!muted) window.soundEngine.playClick();
        });
    }

    // Theme Mode Toggle (Dark / Light)
    let currentTheme = localStorage.getItem('arcade_theme');
    if (!currentTheme) {
        currentTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('arcade_theme', theme);

        if (navThemeBtn) {
            navThemeBtn.innerHTML = theme === 'light' 
                ? '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>' 
                : '<i class="fa-solid fa-moon"></i>';
        }

        // Redraw canvas if active
        if (aviatorInstance) aviatorInstance.draw();
        if (snakeInstance) snakeInstance.draw();
        if (rocketInstance) rocketInstance.resizeCanvas();
        if (rouletteInstance) rouletteInstance.resizeCanvas();
        if (plinkoInstance) {
            plinkoInstance.resizeCanvas();
            plinkoInstance.initPegs();
        }
    }

    applyTheme(currentTheme);

    if (navThemeBtn) {
        navThemeBtn.addEventListener('click', () => {
            window.soundEngine.playClick();
            applyTheme(currentTheme === 'light' ? 'dark' : 'light');
            if (window.showToast) {
                window.showToast('Theme Changed', `Switched to ${currentTheme.toUpperCase()} mode`, 'info');
            }
        });
    }

    // Navigation function
    function switchView(viewName) {
        window.soundEngine.playClick();

        Object.keys(views).forEach(key => {
            if (views[key]) {
                views[key].classList.remove('active');
            }
        });

        if (views[viewName]) {
            views[viewName].classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Handle Home button visibility in topbar
        if (navLobbyBtn) {
            navLobbyBtn.style.display = viewName === 'home' ? 'none' : 'flex';
        }

        // Initialize games on first open or resume
        if (viewName === 'tictactoe') {
            if (!tttInstance) {
                tttInstance = new window.TicTacToeGame();
            }
        } else if (viewName === 'sudoku') {
            if (!sudokuInstance) {
                sudokuInstance = new window.SudokuGame();
            }
        } else if (viewName === 'aviator') {
            if (!aviatorInstance) {
                aviatorInstance = new window.AviatorGame();
            }
            setTimeout(() => {
                if (aviatorInstance) aviatorInstance.resizeCanvas();
            }, 60);
        } else if (viewName === 'rocket') {
            if (!rocketInstance) {
                rocketInstance = new window.RocketGame();
            }
            setTimeout(() => {
                if (rocketInstance) rocketInstance.resizeCanvas();
            }, 60);
        } else if (viewName === 'game2048') {
            if (!game2048Instance) {
                game2048Instance = new window.Game2048();
            }
        } else if (viewName === 'minesweeper') {
            if (!minesweeperInstance) {
                minesweeperInstance = new window.MinesweeperGame();
            }
        } else if (viewName === 'snake') {
            if (!snakeInstance) {
                snakeInstance = new window.SnakeGame();
            } else {
                snakeInstance.startLoop();
            }
            setTimeout(() => {
                if (snakeInstance) snakeInstance.resizeCanvas();
            }, 60);
        } else if (viewName === 'colorselector') {
            if (!colorSelectorInstance) {
                colorSelectorInstance = new window.ColorSelectorGame();
            } else {
                colorSelectorInstance.start();
            }
        } else if (viewName === 'connect4') {
            if (!connect4Instance) {
                connect4Instance = new window.Connect4Game();
                window.c4Instance = connect4Instance;
            }
        } else if (viewName === 'plinko') {
            if (!plinkoInstance) {
                plinkoInstance = new window.PlinkoGame();
            }
            setTimeout(() => {
                if (plinkoInstance) {
                    plinkoInstance.resizeCanvas();
                    plinkoInstance.initPegs();
                }
            }, 60);
        } else if (viewName === 'memory') {
            if (!memoryInstance) {
                memoryInstance = new window.MemoryGame();
            }
        } else if (viewName === 'wordle') {
            if (!wordleInstance) {
                wordleInstance = new window.WordleGame();
            }
            wordleInstance.activate();
        } else if (viewName === 'roulette') {
            if (!rouletteInstance) {
                rouletteInstance = new window.RouletteGame();
            }
            setTimeout(() => {
                if (rouletteInstance) rouletteInstance.resizeCanvas();
            }, 60);
        }

        // Pause/stop background processes when switching away
        if (viewName !== 'aviator' && window.soundEngine) {
            window.soundEngine.stopAviatorFlight();
        }
        if (viewName !== 'snake' && snakeInstance && !snakeInstance.isGameOver) {
            snakeInstance.stopLoop();
        }
        if (viewName !== 'colorselector' && colorSelectorInstance) {
            colorSelectorInstance.stop();
        }
        if (viewName !== 'wordle' && wordleInstance) {
            wordleInstance.deactivate();
        }
    }

    // Bind Home Cards
    if (cardTTT) cardTTT.addEventListener('click', () => switchView('tictactoe'));
    if (cardSudoku) cardSudoku.addEventListener('click', () => switchView('sudoku'));
    if (cardAviator) cardAviator.addEventListener('click', () => switchView('aviator'));
    if (cardRocket) cardRocket.addEventListener('click', () => switchView('rocket'));
    if (cardColorSelector) cardColorSelector.addEventListener('click', () => switchView('colorselector'));
    if (cardRoulette) cardRoulette.addEventListener('click', () => switchView('roulette'));
    if (cardPlinko) cardPlinko.addEventListener('click', () => switchView('plinko'));
    if (cardConnect4) cardConnect4.addEventListener('click', () => switchView('connect4'));
    if (cardMinesweeper) cardMinesweeper.addEventListener('click', () => switchView('minesweeper'));
    if (card2048) card2048.addEventListener('click', () => switchView('game2048'));
    if (cardSnake) cardSnake.addEventListener('click', () => switchView('snake'));
    if (cardMemory) cardMemory.addEventListener('click', () => switchView('memory'));
    if (cardWordle) cardWordle.addEventListener('click', () => switchView('wordle'));

    // Bind Lobby Return
    if (navLobbyBtn) navLobbyBtn.addEventListener('click', () => switchView('home'));
    returnButtons.forEach(btn => btn.addEventListener('click', () => switchView('home')));

    // Modal Add Funds / Payment Gateway Trigger
    if (navAddFundsBtn) {
        navAddFundsBtn.addEventListener('click', () => {
            window.soundEngine.playClick();
            if (window.paymentGateway) {
                window.paymentGateway.open();
            }
        });
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === refillModal) {
            refillModal.classList.remove('active');
        }
    });

    // Toast System
    window.showToast = function(title, message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-xmark',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };

        const toast = document.createElement('div');
        toast.className = `arcade-toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    };

    // Confetti System
    window.triggerConfetti = function() {
        let canvas = document.getElementById('confetti-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'confetti-canvas';
            document.body.appendChild(canvas);
        }
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');

        const colors = ['#00f2fe', '#f72585', '#ffb703', '#10b981', '#7928ca', '#ffffff'];
        const particles = [];
        for (let i = 0; i < 90; i++) {
            particles.push({
                x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
                y: canvas.height * 0.4,
                vx: (Math.random() - 0.5) * 16,
                vy: -8 - Math.random() * 10,
                size: 6 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 10,
                opacity: 1
            });
        }

        let animFrame;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.38; // gravity
                p.rotation += p.vRot;
                p.opacity -= 0.009;

                if (p.opacity > 0) {
                    alive = true;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.max(0, p.opacity);
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
                    ctx.restore();
                }
            });

            if (alive) {
                animFrame = requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animFrame);
            }
        };
        animate();
    };

    // Check URL hash if any (e.g. #aviator, #rocket, #connect4, #roulette)
    const validViews = [
        'tictactoe', 'sudoku', 'aviator', 'rocket', 'colorselector',
        'roulette', 'plinko', 'connect4', 'minesweeper', 'game2048',
        'snake', 'memory', 'wordle'
    ];
    const hash = window.location.hash.replace('#', '');
    if (validViews.includes(hash)) {
        switchView(hash);
    } else {
        switchView('home');
    }
});
