/**
 * ═══════════════════════════════════════════════════════════
 *  UI MANAGER
 *  Handles all DOM-based UI: screens, keyboard, HUD, overlays
 * ═══════════════════════════════════════════════════════════
 */

const KEYBOARD_ROWS = [
    'QWERTYUIOP',
    'ASDFGHJKL',
    'ZXCVBNM'
];

export class UIManager {
    constructor() {
        // Screen elements
        this.screens = {
            menu:    document.getElementById('menu-screen'),
            game:    document.getElementById('game-screen'),
            pause:   document.getElementById('pause-screen'),
            levelUp: document.getElementById('levelup-screen'),
            gameOver:document.getElementById('gameover-screen'),
        };

        // HUD elements
        this.el = {
            healthHearts:    document.getElementById('health-hearts'),
            shieldIndicator: document.getElementById('shield-indicator'),
            freezeIndicator: document.getElementById('freeze-indicator'),
            wordDisplay:     document.getElementById('word-display'),
            wordCategory:    document.getElementById('word-category'),
            score:           document.getElementById('game-score'),
            level:           document.getElementById('game-level'),
            timerBlock:      document.getElementById('timer-block'),
            timer:           document.getElementById('game-timer'),
            progressFill:    document.getElementById('word-progress-fill'),
            comboDisplay:    document.getElementById('combo-display'),
            comboCount:      document.getElementById('combo-count'),
            powerupNotif:    document.getElementById('powerup-notification'),
            wrongOverlay:    document.getElementById('wrong-guess-overlay'),
            menuHighScore:   document.getElementById('menu-high-score'),
            levelUpWord:     document.getElementById('levelup-word'),
            levelUpStats:    document.getElementById('levelup-stats'),
            gameOverStats:   document.getElementById('gameover-stats'),
            newHighScore:    document.getElementById('new-highscore'),
        };

        // Keyboard button references
        this.keyButtons = {};

        // Timeout handles for auto-hiding notifications
        this._comboTimeout  = null;
        this._powerupTimeout = null;
    }

    // ──── Screen Management ────

    /**
     * Show a screen by name ("menu", "game", "pause", "levelUp", "gameOver").
     * Hides all others except game (game stays visible under overlays).
     */
    showScreen(name) {
        Object.entries(this.screens).forEach(([key, el]) => {
            if (key === name) {
                el.classList.add('active');
            } else if (key === 'game' && ['pause', 'levelUp', 'gameOver'].includes(name)) {
                // Keep game screen visible under overlays
            } else {
                el.classList.remove('active');
            }
        });
    }

    /** Hide a specific overlay (pause, levelUp, gameOver). */
    hideOverlay(name) {
        if (this.screens[name]) {
            this.screens[name].classList.remove('active');
        }
    }

    /** Hide all overlays. */
    hideAllOverlays() {
        ['pause', 'levelUp', 'gameOver'].forEach(n => this.hideOverlay(n));
    }

    // ──── Keyboard ────

    /**
     * Build the on-screen keyboard.
     * @param {function} onKeyPress - Callback for when a key is pressed (receives letter).
     */
    createKeyboard(onKeyPress) {
        this.keyButtons = {};
        const rows = [
            document.getElementById('kb-row-1'),
            document.getElementById('kb-row-2'),
            document.getElementById('kb-row-3'),
        ];

        rows.forEach((row, i) => {
            row.innerHTML = '';
            const letters = KEYBOARD_ROWS[i];
            for (const letter of letters) {
                const btn = document.createElement('button');
                btn.className = 'key-btn';
                btn.textContent = letter;
                btn.dataset.letter = letter;
                btn.id = `key-${letter}`;

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!btn.classList.contains('used')) {
                        onKeyPress(letter);
                    }
                });

                // Prevent double-tap zoom on mobile
                btn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    if (!btn.classList.contains('used')) {
                        onKeyPress(letter);
                    }
                });

                row.appendChild(btn);
                this.keyButtons[letter] = btn;
            }
        });
    }

    /**
     * Mark a key as used and highlight correct/wrong.
     */
    highlightKey(letter, correct) {
        const btn = this.keyButtons[letter];
        if (!btn) return;
        btn.classList.add('used');
        btn.classList.add(correct ? 'correct' : 'wrong');
    }

    /** Reset all keyboard keys to default state. */
    resetKeyboard() {
        Object.values(this.keyButtons).forEach(btn => {
            btn.classList.remove('used', 'correct', 'wrong');
        });
    }

    // ──── Word Display ────

    /**
     * Render the word display with revealed/hidden letters.
     */
    updateWordDisplay(word, guessedLetters) {
        this.el.wordDisplay.innerHTML = '';
        for (const letter of word) {
            const span = document.createElement('span');
            span.className = 'word-letter';
            if (guessedLetters.includes(letter)) {
                span.textContent = letter;
                span.classList.add('revealed');
            } else {
                span.textContent = '_';
                span.classList.add('placeholder');
            }
            this.el.wordDisplay.appendChild(span);
        }
    }

    /** Set the word category display. */
    setWordCategory(category) {
        this.el.wordCategory.textContent = `Category: ${category}`;
    }

    /** Update word progress bar. */
    updateProgress(uniqueRevealed, totalUnique) {
        const pct = totalUnique > 0 ? (uniqueRevealed / totalUnique) * 100 : 0;
        this.el.progressFill.style.width = `${pct}%`;
    }

    // ──── HUD ────

    /**
     * Update health display (hearts).
     */
    updateHealth(current, max) {
        this.el.healthHearts.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';
            if (i >= current) {
                heart.classList.add('lost');
                heart.textContent = '🖤';
            } else {
                heart.textContent = '❤️';
            }
            this.el.healthHearts.appendChild(heart);
        }
    }

    /** Animate a heart loss. */
    animateHeartLoss(index) {
        const hearts = this.el.healthHearts.querySelectorAll('.heart');
        if (hearts[index]) {
            hearts[index].classList.add('damage');
        }
    }

    /** Update score display with optional pop animation. */
    updateScore(score, animate = false) {
        this.el.score.textContent = score.toLocaleString();
        if (animate) {
            this.el.score.classList.remove('score-pop');
            // Force reflow for re-triggering the animation
            void this.el.score.offsetWidth;
            this.el.score.classList.add('score-pop');
        }
    }

    /** Update level display. */
    updateLevel(level) {
        this.el.level.textContent = level;
    }

    /** Show/hide timer (for Time Attack mode). */
    showTimer(visible) {
        this.el.timerBlock.style.display = visible ? 'flex' : 'none';
    }

    /** Update timer display. */
    updateTimer(seconds) {
        this.el.timer.textContent = Math.ceil(seconds);
        if (seconds <= 10) {
            this.el.timer.classList.add('urgent');
        } else {
            this.el.timer.classList.remove('urgent');
        }
    }

    /** Toggle shield indicator visibility. */
    showShield(visible) {
        this.el.shieldIndicator.classList.toggle('visible', visible);
    }

    /** Toggle freeze indicator visibility. */
    showFreeze(visible) {
        this.el.freezeIndicator.classList.toggle('visible', visible);
    }

    // ──── Notifications ────

    /** Show combo counter. */
    showCombo(count) {
        if (count < 2) {
            this.el.comboDisplay.classList.remove('visible');
            return;
        }
        this.el.comboCount.textContent = count;
        this.el.comboDisplay.classList.add('visible');

        clearTimeout(this._comboTimeout);
        this._comboTimeout = setTimeout(() => {
            this.el.comboDisplay.classList.remove('visible');
        }, 2000);
    }

    /** Show power-up notification. */
    showPowerUpNotification(text) {
        this.el.powerupNotif.textContent = text;
        this.el.powerupNotif.classList.add('visible');

        clearTimeout(this._powerupTimeout);
        this._powerupTimeout = setTimeout(() => {
            this.el.powerupNotif.classList.remove('visible');
        }, 1500);
    }

    /** Flash the wrong-guess red overlay. */
    flashWrongOverlay() {
        this.el.wrongOverlay.classList.add('flash');
        setTimeout(() => {
            this.el.wrongOverlay.classList.remove('flash');
        }, 200);
    }

    // ──── Level Up Overlay ────

    showLevelUp(word, stats) {
        this.el.levelUpWord.textContent = word;
        this.el.levelUpStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-item-label">Score</span>
                <span class="stat-item-value">${stats.score.toLocaleString()}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Wrong Guesses</span>
                <span class="stat-item-value">${stats.wrongGuesses}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Best Combo</span>
                <span class="stat-item-value">${stats.bestCombo}×</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Obstacles Dodged</span>
                <span class="stat-item-value">${stats.obstaclesDodged}</span>
            </div>
        `;
        this.showScreen('levelUp');
    }

    // ──── Game Over Overlay ────

    showGameOver(stats, isNewHighScore) {
        this.el.gameOverStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-item-label">Final Score</span>
                <span class="stat-item-value">${stats.score.toLocaleString()}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Level Reached</span>
                <span class="stat-item-value">${stats.level}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Words Completed</span>
                <span class="stat-item-value">${stats.wordsCompleted}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Obstacles Dodged</span>
                <span class="stat-item-value">${stats.totalObstaclesDodged}</span>
            </div>
        `;

        this.el.newHighScore.classList.toggle('visible', isNewHighScore);
        this.showScreen('gameOver');
    }

    // ──── Menu ────

    updateMenuHighScore(score) {
        this.el.menuHighScore.textContent = score.toLocaleString();
    }

    // ──── Menu Background Particles ────

    /**
     * Create floating decorative particles on the menu screen.
     */
    initMenuParticles() {
        const container = document.getElementById('menu-particles');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            const size = 2 + Math.random() * 4;
            const duration = 15 + Math.random() * 25;
            const delay = Math.random() * duration;
            const startX = Math.random() * 100;

            Object.assign(particle.style, {
                position: 'absolute',
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                background: `hsl(${180 + Math.random() * 60}, 100%, ${60 + Math.random() * 20}%)`,
                opacity: (0.15 + Math.random() * 0.25).toString(),
                left: `${startX}%`,
                bottom: '-10px',
                animation: `menuParticleFloat ${duration}s ${delay}s linear infinite`,
                pointerEvents: 'none',
            });

            container.appendChild(particle);
        }

        // Add the keyframe animation if not already present
        if (!document.getElementById('menu-particle-style')) {
            const style = document.createElement('style');
            style.id = 'menu-particle-style';
            style.textContent = `
                @keyframes menuParticleFloat {
                    0%   { transform: translateY(0) translateX(0); opacity: 0; }
                    10%  { opacity: 0.3; }
                    90%  { opacity: 0.3; }
                    100% { transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}40px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
