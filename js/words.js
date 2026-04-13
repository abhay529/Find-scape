/**
 * ═══════════════════════════════════════════════
 *  WORD DATABASE & MANAGEMENT
 *  Categorized word lists with difficulty scaling
 * ═══════════════════════════════════════════════
 */

// Word entries: { word, category }
const WORDS = {
    easy: [
        { word: 'JUMP', category: 'Action' },
        { word: 'GLOW', category: 'Light' },
        { word: 'NEON', category: 'Color' },
        { word: 'STAR', category: 'Space' },
        { word: 'FIRE', category: 'Element' },
        { word: 'MOON', category: 'Space' },
        { word: 'WAVE', category: 'Nature' },
        { word: 'CODE', category: 'Tech' },
        { word: 'GAME', category: 'Fun' },
        { word: 'HERO', category: 'Character' },
        { word: 'DASH', category: 'Action' },
        { word: 'BOLT', category: 'Energy' },
        { word: 'ECHO', category: 'Sound' },
        { word: 'MAZE', category: 'Puzzle' },
        { word: 'RUBY', category: 'Gem' },
        { word: 'FLUX', category: 'Science' },
        { word: 'ZERO', category: 'Number' },
        { word: 'APEX', category: 'Peak' },
        { word: 'DUSK', category: 'Time' },
        { word: 'VIBE', category: 'Feeling' },
        { word: 'WIND', category: 'Nature' },
        { word: 'DISK', category: 'Tech' },
        { word: 'FUSE', category: 'Energy' },
        { word: 'HAWK', category: 'Animal' },
        { word: 'JADE', category: 'Gem' },
        { word: 'LAVA', category: 'Element' },
        { word: 'MIST', category: 'Nature' },
        { word: 'PIKE', category: 'Weapon' },
        { word: 'RUNE', category: 'Magic' },
        { word: 'WARP', category: 'Sci-Fi' },
    ],
    medium: [
        { word: 'GALAXY', category: 'Space' },
        { word: 'SHADOW', category: 'Light' },
        { word: 'ROCKET', category: 'Space' },
        { word: 'DRAGON', category: 'Fantasy' },
        { word: 'CIPHER', category: 'Code' },
        { word: 'COSMIC', category: 'Space' },
        { word: 'PRISM', category: 'Light' },
        { word: 'TURBO', category: 'Speed' },
        { word: 'QUEST', category: 'Adventure' },
        { word: 'BLAZE', category: 'Fire' },
        { word: 'STORM', category: 'Weather' },
        { word: 'NEXUS', category: 'Tech' },
        { word: 'ORBIT', category: 'Space' },
        { word: 'ROGUE', category: 'Character' },
        { word: 'PULSE', category: 'Energy' },
        { word: 'PHANTOM', category: 'Mystery' },
        { word: 'MATRIX', category: 'Tech' },
        { word: 'VORTEX', category: 'Physics' },
        { word: 'FUSION', category: 'Science' },
        { word: 'ZENITH', category: 'Peak' },
        { word: 'PLASMA', category: 'Science' },
        { word: 'KNIGHT', category: 'Fantasy' },
        { word: 'PIRATE', category: 'Adventure' },
        { word: 'STEALTH', category: 'Action' },
        { word: 'THUNDER', category: 'Weather' },
        { word: 'BEACON', category: 'Light' },
        { word: 'GLACIER', category: 'Nature' },
        { word: 'SPIRIT', category: 'Soul' },
        { word: 'COMET', category: 'Space' },
        { word: 'MIRAGE', category: 'Illusion' },
    ],
    hard: [
        { word: 'CYBERPUNK', category: 'Genre' },
        { word: 'SATELLITE', category: 'Space' },
        { word: 'ALGORITHM', category: 'Tech' },
        { word: 'SUPERNOVA', category: 'Space' },
        { word: 'LABYRINTH', category: 'Puzzle' },
        { word: 'CLOCKWORK', category: 'Machine' },
        { word: 'ENIGMATIC', category: 'Mystery' },
        { word: 'STARLIGHT', category: 'Space' },
        { word: 'MOONSTONE', category: 'Gem' },
        { word: 'BLUEPRINT', category: 'Design' },
        { word: 'FIREWALL', category: 'Tech' },
        { word: 'AVALANCHE', category: 'Nature' },
        { word: 'CHROMATIC', category: 'Color' },
        { word: 'AMPLITUDE', category: 'Physics' },
        { word: 'FREQUENCY', category: 'Physics' },
        { word: 'MAGNETISM', category: 'Science' },
        { word: 'HYPERLOOP', category: 'Transport' },
        { word: 'BIOMETRIC', category: 'Tech' },
        { word: 'DREAMLAND', category: 'Fantasy' },
        { word: 'ASTRONOMY', category: 'Science' },
    ]
};

// Track recently used words to avoid repeats
let recentWords = [];

/**
 * Get a random word based on the current level.
 * Levels 1-3 → easy, 4-6 → medium, 7+ → hard
 */
export function getRandomWord(level) {
    let difficulty;
    if (level <= 3) difficulty = 'easy';
    else if (level <= 6) difficulty = 'medium';
    else difficulty = 'hard';

    const pool = WORDS[difficulty].filter(w => !recentWords.includes(w.word));
    // If pool exhausted, reset recent list for this difficulty
    const available = pool.length > 0 ? pool : WORDS[difficulty];

    const entry = available[Math.floor(Math.random() * available.length)];

    // Keep track of last 10 words
    recentWords.push(entry.word);
    if (recentWords.length > 10) recentWords.shift();

    return { word: entry.word, category: entry.category, difficulty };
}

/**
 * Check how many unique letters are in a word (for progress calculation).
 */
export function getUniqueLetters(word) {
    return [...new Set(word.split(''))].length;
}

/**
 * Check if the word is fully guessed.
 */
export function isWordComplete(word, guessedLetters) {
    return word.split('').every(letter => guessedLetters.includes(letter));
}

/**
 * Reset the recent words tracking (e.g., on new game).
 */
export function resetWordHistory() {
    recentWords = [];
}
