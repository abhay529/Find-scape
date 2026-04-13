/**
 * ═══════════════════════════════════════════════
 *  AUDIO MANAGER
 *  Web Audio API-based sound synthesis
 *  No external audio files needed
 * ═══════════════════════════════════════════════
 */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.musicNodes = null;
        this.initialized = false;
    }

    /**
     * Initialize the audio context (must be called on user gesture).
     */
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    /** Ensure context is running (for browsers that suspend by default). */
    _resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Play a single tone.
     * @param {number} freq - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Oscillator type (sine, square, sawtooth, triangle)
     * @param {number} volume - Gain (0-1)
     */
    _playTone(freq, duration, type = 'sine', volume = 0.25) {
        if (!this.soundEnabled || !this.ctx) return;
        this._resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Play a frequency sweep (for jump/swoosh effects).
     */
    _playSweep(startFreq, endFreq, duration, type = 'sine', volume = 0.2) {
        if (!this.soundEnabled || !this.ctx) return;
        this._resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration * 0.7);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Play noise burst (for collision/hit effects).
     */
    _playNoise(duration, volume = 0.15) {
        if (!this.soundEnabled || !this.ctx) return;
        this._resume();

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(now);
    }

    // ──── Sound Effects ────

    /** Correct letter guess: ascending arpeggio */
    playCorrect() {
        this._playTone(523, 0.12, 'sine', 0.2);
        setTimeout(() => this._playTone(659, 0.12, 'sine', 0.2), 80);
        setTimeout(() => this._playTone(784, 0.18, 'sine', 0.25), 160);
    }

    /** Wrong letter guess: dissonant buzz */
    playWrong() {
        this._playTone(185, 0.25, 'sawtooth', 0.12);
        this._playTone(175, 0.3, 'square', 0.08);
    }

    /** Jump: upward frequency sweep */
    playJump() {
        this._playSweep(280, 560, 0.18, 'sine', 0.15);
    }

    /** Player collision with obstacle */
    playCollision() {
        this._playNoise(0.25, 0.2);
        this._playTone(80, 0.3, 'sawtooth', 0.15);
    }

    /** Level up / word complete: fanfare */
    playLevelUp() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this._playTone(freq, 0.25, 'sine', 0.2), i * 130);
        });
    }

    /** Game over: descending notes */
    playGameOver() {
        const notes = [400, 340, 280, 180];
        notes.forEach((freq, i) => {
            setTimeout(() => this._playTone(freq, 0.45, 'triangle', 0.2), i * 220);
        });
    }

    /** Power-up collected: sparkle */
    playPowerUp() {
        this._playSweep(600, 1200, 0.12, 'sine', 0.15);
        setTimeout(() => this._playSweep(800, 1400, 0.15, 'sine', 0.18), 100);
    }

    /** Slide / duck sound */
    playSlide() {
        this._playSweep(400, 200, 0.15, 'triangle', 0.1);
    }

    // ──── Background Music ────

    /**
     * Start ambient background music using oscillators.
     * Creates a simple pulsing bass + pad atmosphere.
     */
    startMusic() {
        if (!this.musicEnabled || !this.ctx || this.musicNodes) return;
        this._resume();

        const now = this.ctx.currentTime;
        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.08, now + 2);
        masterGain.connect(this.ctx.destination);

        // Bass oscillator: slow pulsing
        const bass = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const bassFilter = this.ctx.createBiquadFilter();
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(55, now);
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(200, now);
        bassGain.gain.setValueAtTime(0.5, now);

        bass.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(masterGain);
        bass.start(now);

        // Pad oscillator: gentle chord
        const pad1 = this.ctx.createOscillator();
        const pad1Gain = this.ctx.createGain();
        pad1.type = 'sine';
        pad1.frequency.setValueAtTime(220, now);
        pad1Gain.gain.setValueAtTime(0.15, now);
        pad1.connect(pad1Gain);
        pad1Gain.connect(masterGain);
        pad1.start(now);

        const pad2 = this.ctx.createOscillator();
        const pad2Gain = this.ctx.createGain();
        pad2.type = 'sine';
        pad2.frequency.setValueAtTime(330, now);
        pad2Gain.gain.setValueAtTime(0.1, now);
        pad2.connect(pad2Gain);
        pad2Gain.connect(masterGain);
        pad2.start(now);

        // LFO for subtle movement
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.3, now);
        lfoGain.gain.setValueAtTime(15, now);
        lfo.connect(lfoGain);
        lfoGain.connect(bassFilter.frequency);
        lfo.start(now);

        this.musicNodes = { bass, pad1, pad2, lfo, masterGain };
    }

    /** Stop background music with fade out. */
    stopMusic() {
        if (!this.musicNodes || !this.ctx) return;
        const now = this.ctx.currentTime;
        this.musicNodes.masterGain.gain.linearRampToValueAtTime(0, now + 1);

        const nodes = this.musicNodes;
        setTimeout(() => {
            try {
                nodes.bass.stop();
                nodes.pad1.stop();
                nodes.pad2.stop();
                nodes.lfo.stop();
            } catch (e) { /* already stopped */ }
        }, 1200);

        this.musicNodes = null;
    }

    // ──── Toggles ────

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicEnabled) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
        return this.musicEnabled;
    }
}
