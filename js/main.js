/**
 * ═══════════════════════════════════════════════════════════════
 *  MAIN — Entry Point
 *  Orchestrates game engine, UI, audio, word system, and state.
 *  Handles the game loop, input events, and game flow.
 * ═══════════════════════════════════════════════════════════════
 */

import { GameEngine } from './engine.js';
import { UIManager }  from './ui.js';
import { AudioManager } from './audio.js';
import { getRandomWord, getUniqueLetters, isWordComplete, resetWordHistory } from './words.js';

// ──── Game Mode Configurations ────
const MODE_CONFIG = {
    classic: {
        health: 5,
        maxWrongGuesses: 6,
        label: 'Classic',
        timerEnabled: false,
    },
    hardcore: {
        health: 3,
        maxWrongGuesses: 3,
        label: 'Hardcore',
        timerEnabled: false,
    },
    timeAttack: {
        health: 5,
        maxWrongGuesses: 5,
        label: 'Time Attack',
        timerEnabled: true,
        timeLimit: 60,
    },
};

// ──── Application State ────
const state = {
    mode: 'classic',
    score: 0,
    level: 1,
    health: 5,
    maxHealth: 5,
    word: '',
    category: '',
    guessedLetters: [],
    wrongGuesses: 0,
    maxWrongGuesses: 6,
    combo: 0,
    bestCombo: 0,
    wordsCompleted: 0,
    totalObstaclesDodged: 0,
    levelObstaclesDodged: 0,
    timeLeft: 60,
    timerEnabled: false,
    highScores: {},    // { mode: score }
    gameActive: false,
    paused: false,
};

// ──── Module Instances ────
const engine = new GameEngine();
const ui     = new UIManager();
const audio  = new AudioManager();

// ──── Game Loop ────
let lastTimestamp = 0;
let animFrameId   = null;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05); // Cap at 50ms
    lastTimestamp = timestamp;

    if (state.gameActive && !state.paused) {
        engine.update(dt);
        engine.render();

        // Distance-based scoring: +1 per ~60 frames
        const distScore = Math.floor(engine.distance / 60);
        const scoreMultiplier = engine.isScoreBoosted ? 2 : 1;
        state.score = state._baseScore + distScore * scoreMultiplier;
        ui.updateScore(state.score);

        // Time Attack timer
        if (state.timerEnabled) {
            state.timeLeft -= dt;
            ui.updateTimer(state.timeLeft);
            if (state.timeLeft <= 0) {
                gameOver();
                animFrameId = requestAnimationFrame(gameLoop);
                return;
            }
        }

        // Update HUD indicators
        ui.showShield(engine.isShielded);
        ui.showFreeze(engine.isFrozen);

        // Track obstacles dodged (obstacles that have passed the player)
        // Simple heuristic: obstacles that move past x < player.x
        engine.obstacles.forEach(obs => {
            if (!obs._counted && obs.x + obs.width < engine.player.x) {
                obs._counted = true;
                state.totalObstaclesDodged++;
                state.levelObstaclesDodged++;
            }
        });
    }

    animFrameId = requestAnimationFrame(gameLoop);
}

// ──── Game Flow ────

function startGame(mode) {
    audio.init(); // First user gesture initializes audio context

    state.mode = mode;
    const config = MODE_CONFIG[mode];
    state.health          = config.health;
    state.maxHealth       = config.health;
    state.maxWrongGuesses = config.maxWrongGuesses;
    state.timerEnabled    = config.timerEnabled;
    state.timeLeft        = config.timeLimit || 60;
    state.score           = 0;
    state._baseScore      = 0;
    state.level           = 1;
    state.combo           = 0;
    state.bestCombo       = 0;
    state.wordsCompleted  = 0;
    state.totalObstaclesDodged = 0;
    state.gameActive      = true;
    state.paused          = false;

    resetWordHistory();
    setupNewWord();

    engine.reset(mode, state.level);

    // Wire engine callbacks
    engine.onCollision = handleCollision;
    engine.onPowerUp   = handlePowerUp;

    // UI setup
    ui.showScreen('game');
    ui.hideAllOverlays();
    ui.showTimer(state.timerEnabled);
    ui.updateHealth(state.health, state.maxHealth);
    ui.updateScore(state.score);
    ui.updateLevel(state.level);
    ui.createKeyboard(handleLetterGuess);

    if (state.timerEnabled) {
        ui.updateTimer(state.timeLeft);
    }

    audio.startMusic();

    lastTimestamp = performance.now();
    if (!animFrameId) {
        animFrameId = requestAnimationFrame(gameLoop);
    }
}

function setupNewWord() {
    const wordData = getRandomWord(state.level);
    state.word            = wordData.word;
    state.category        = wordData.category;
    state.guessedLetters  = [];
    state.wrongGuesses    = 0;
    state.combo           = 0;
    state.levelObstaclesDodged = 0;

    ui.updateWordDisplay(state.word, state.guessedLetters);
    ui.setWordCategory(state.category);
    ui.updateProgress(0, getUniqueLetters(state.word));
    ui.resetKeyboard();
    ui.createKeyboard(handleLetterGuess);
}

function levelUp() {
    state.wordsCompleted++;
    state.level++;

    audio.playLevelUp();

    // Show level up overlay with stats
    ui.showLevelUp(state.word, {
        score: state.score,
        wrongGuesses: state.wrongGuesses,
        bestCombo: state.bestCombo,
        obstaclesDodged: state.levelObstaclesDodged,
    });

    engine.pause();
    state.paused = true;
}

function nextLevel() {
    state.paused = false;
    ui.hideOverlay('levelUp');

    setupNewWord();
    engine.reset(state.mode, state.level);
    engine.onCollision = handleCollision;
    engine.onPowerUp   = handlePowerUp;

    ui.updateLevel(state.level);
    ui.updateHealth(state.health, state.maxHealth);

    // Refill some health on level up (Classic/TimeAttack)
    if (state.mode !== 'hardcore' && state.health < state.maxHealth) {
        state.health = Math.min(state.health + 1, state.maxHealth);
        ui.updateHealth(state.health, state.maxHealth);
    }

    // Reset timer for Time Attack
    if (state.timerEnabled) {
        state.timeLeft = MODE_CONFIG[state.mode].timeLimit || 60;
        ui.updateTimer(state.timeLeft);
    }
}

function gameOver() {
    state.gameActive = false;
    engine.pause();
    audio.playGameOver();
    audio.stopMusic();

    // Check high score
    const key = `wordrunner_highscore_${state.mode}`;
    const prevHigh = parseInt(localStorage.getItem(key) || '0', 10);
    const isNewHigh = state.score > prevHigh;

    if (isNewHigh) {
        localStorage.setItem(key, state.score.toString());
        state.highScores[state.mode] = state.score;
    }

    ui.showGameOver({
        score: state.score,
        level: state.level,
        wordsCompleted: state.wordsCompleted,
        totalObstaclesDodged: state.totalObstaclesDodged,
    }, isNewHigh);
}

function returnToMenu() {
    state.gameActive = false;
    state.paused = false;
    engine.pause();
    audio.stopMusic();
    ui.hideAllOverlays();
    ui.showScreen('menu');
    updateMenuHighScore();
}

// ──── Letter Guessing ────

function handleLetterGuess(letter) {
    if (!state.gameActive || state.paused) return;
    if (state.guessedLetters.includes(letter)) return;

    state.guessedLetters.push(letter);

    if (state.word.includes(letter)) {
        // ✅ Correct guess
        audio.playCorrect();
        engine.onCorrectGuess();
        ui.highlightKey(letter, true);

        state.combo++;
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;

        // Score bonus for correct letter
        const bonus = 100 * state.level * (engine.isScoreBoosted ? 2 : 1);
        const comboBonus = Math.min(state.combo - 1, 5) * 50;
        state._baseScore += bonus + comboBonus;
        state.score = state._baseScore + Math.floor(engine.distance / 60);
        ui.updateScore(state.score, true);

        // Update word display
        ui.updateWordDisplay(state.word, state.guessedLetters);

        // Update progress
        const unique = getUniqueLetters(state.word);
        const revealed = [...new Set(state.word.split(''))].filter(l => state.guessedLetters.includes(l)).length;
        ui.updateProgress(revealed, unique);

        // Combo display
        if (state.combo >= 2) {
            ui.showCombo(state.combo);
        }

        // Check word complete
        if (isWordComplete(state.word, state.guessedLetters)) {
            // Word complete bonus
            state._baseScore += 500 * state.level;
            state.score = state._baseScore + Math.floor(engine.distance / 60);
            ui.updateScore(state.score, true);
            levelUp();
        }
    } else {
        // ❌ Wrong guess
        audio.playWrong();
        engine.onWrongGuess();
        ui.highlightKey(letter, false);
        ui.flashWrongOverlay();

        state.combo = 0;
        ui.showCombo(0);
        state.wrongGuesses++;

        // Check if max wrong guesses reached → lose a heart
        if (state.wrongGuesses >= state.maxWrongGuesses) {
            state.health--;
            ui.updateHealth(state.health, state.maxHealth);
            ui.animateHeartLoss(state.health);
            audio.playCollision();

            if (state.health <= 0) {
                gameOver();
                return;
            }

            // Reset wrong guess counter for the current word,
            // but the penalties (speed increase) remain
            state.wrongGuesses = 0;
        }
    }
}

// ──── Engine Callbacks ────

function handleCollision() {
    audio.playCollision();
    state.health--;
    ui.updateHealth(state.health, state.maxHealth);
    ui.animateHeartLoss(state.health);

    if (state.health <= 0) {
        gameOver();
    }
}

function handlePowerUp(type) {
    audio.playPowerUp();
    engine.applyPowerUp(type);

    const labels = {
        freeze:     '❄️ FREEZE!',
        shield:     '🛡️ SHIELD!',
        reveal:     '⭐ LETTER REVEALED!',
        scoreBoost: '2× SCORE BOOST!',
    };

    ui.showPowerUpNotification(labels[type] || 'POWER UP!');

    // Special handling for 'reveal' — auto-reveal one unrevealed letter
    if (type === 'reveal') {
        const unrevealed = state.word.split('').filter(l => !state.guessedLetters.includes(l));
        if (unrevealed.length > 0) {
            const letter = unrevealed[Math.floor(Math.random() * unrevealed.length)];
            state.guessedLetters.push(letter);
            ui.highlightKey(letter, true);
            ui.updateWordDisplay(state.word, state.guessedLetters);

            const unique = getUniqueLetters(state.word);
            const revealed = [...new Set(state.word.split(''))].filter(l => state.guessedLetters.includes(l)).length;
            ui.updateProgress(revealed, unique);

            if (isWordComplete(state.word, state.guessedLetters)) {
                state._baseScore += 500 * state.level;
                levelUp();
            }
        }
    }
}

// ──── Input Handling ────

function setupInputHandlers() {
    const canvas = document.getElementById('game-canvas');

    // Keyboard input
    document.addEventListener('keydown', (e) => {
        if (!state.gameActive) return;

        switch (e.code) {
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                engine.jump();
                audio.playJump();
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                engine.slide(true);
                audio.playSlide();
                break;
            case 'Escape':
            case 'KeyP':
                e.preventDefault();
                togglePause();
                break;
            default:
                // Letter keys for guessing (exclude keys used for movement/pause)
                if (e.code.startsWith('Key') && !e.ctrlKey && !e.metaKey) {
                    const letter = e.code.replace('Key', '');
                    // W, S, P are reserved for movement/pause
                    if (letter !== 'W' && letter !== 'S' && letter !== 'P') {
                        handleLetterGuess(letter);
                    }
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            engine.slide(false);
        }
    });

    // Touch input on canvas
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        if (!state.gameActive || state.paused) return;
        e.preventDefault();
        touchStartY = e.touches[0].clientY;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!state.gameActive || state.paused) return;
        e.preventDefault();
        const dy = e.touches[0].clientY - touchStartY;
        if (dy > 30) {
            engine.slide(true);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!state.gameActive || state.paused) return;
        e.preventDefault();
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (dy < -15) {
            // Swipe up = jump
            engine.jump();
            audio.playJump();
        } else if (Math.abs(dy) <= 15) {
            // Tap = jump
            engine.jump();
            audio.playJump();
        }
        engine.slide(false);
    }, { passive: false });

    // Mouse click on canvas = jump
    canvas.addEventListener('mousedown', (e) => {
        if (!state.gameActive || state.paused) return;
        engine.jump();
        audio.playJump();
    });
}

function togglePause() {
    if (!state.gameActive) return;

    if (state.paused) {
        state.paused = false;
        engine.resume();
        ui.hideOverlay('pause');
    } else {
        state.paused = true;
        engine.pause();
        ui.showScreen('pause');
    }
}

// ──── Button Handlers ────

function setupButtonHandlers() {
    // Mode selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            startGame(mode);
        });
    });

    // Pause screen
    document.getElementById('resume-btn').addEventListener('click', () => togglePause());
    document.getElementById('quit-btn').addEventListener('click', () => returnToMenu());

    // Level up
    document.getElementById('next-level-btn').addEventListener('click', () => nextLevel());

    // Game over
    document.getElementById('retry-btn').addEventListener('click', () => startGame(state.mode));
    document.getElementById('menu-btn').addEventListener('click', () => returnToMenu());

    // Pause button
    document.getElementById('pause-btn').addEventListener('click', () => togglePause());

    // Audio toggles
    document.getElementById('sound-toggle').addEventListener('click', (e) => {
        audio.init();
        const enabled = audio.toggleSound();
        e.currentTarget.classList.toggle('active', enabled);
    });

    document.getElementById('music-toggle').addEventListener('click', (e) => {
        audio.init();
        const enabled = audio.toggleMusic();
        e.currentTarget.classList.toggle('active', enabled);
    });
}

// ──── Canvas Resize ────

function setupCanvasResize() {
    const canvas = document.getElementById('game-canvas');
    engine.init(canvas);

    const onResize = () => {
        // Set canvas to fill available space between HUD and keyboard
        const gameScreen = document.getElementById('game-screen');
        const hud = document.getElementById('game-hud');
        const progress = document.getElementById('word-progress');
        const keyboard = document.getElementById('keyboard-container');

        if (gameScreen.classList.contains('active')) {
            const availableHeight = window.innerHeight
                - hud.offsetHeight
                - progress.offsetHeight
                - keyboard.offsetHeight;
            canvas.style.height = `${Math.max(150, availableHeight)}px`;
        } else {
            canvas.style.height = '300px';
        }

        engine.resize();
    };

    window.addEventListener('resize', onResize);

    // Initial sizing (with slight delay to ensure fonts and layout are ready)
    setTimeout(onResize, 100);

    // Also resize when game screen becomes active
    const observer = new MutationObserver(() => {
        setTimeout(onResize, 50);
    });
    observer.observe(document.getElementById('game-screen'), {
        attributes: true,
        attributeFilter: ['class']
    });
}

// ──── High Scores ────

function loadHighScores() {
    ['classic', 'hardcore', 'timeAttack'].forEach(mode => {
        const score = parseInt(localStorage.getItem(`wordrunner_highscore_${mode}`) || '0', 10);
        state.highScores[mode] = score;
    });
    updateMenuHighScore();
}

function updateMenuHighScore() {
    const maxScore = Math.max(...Object.values(state.highScores), 0);
    ui.updateMenuHighScore(maxScore);
}

// ──── Initialization ────

function init() {
    loadHighScores();
    setupCanvasResize();
    setupInputHandlers();
    setupButtonHandlers();
    ui.initMenuParticles();
    ui.showScreen('menu');

    console.log('%c🎮 WordRunner initialized!', 'color: #00f0ff; font-size: 14px; font-weight: bold;');
    console.log('%cPress a mode button to start playing.', 'color: #8888aa;');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
