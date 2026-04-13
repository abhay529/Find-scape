/**
 * ═══════════════════════════════════════════════════════════════
 *  GAME ENGINE
 *  Core game logic: player, obstacles, particles, power-ups,
 *  collision detection, canvas rendering, and visual effects.
 * ═══════════════════════════════════════════════════════════════
 */

// ──── Constants ────
const GRAVITY         = 0.65;
const JUMP_VELOCITY   = -13.5;
const MAX_FALL_SPEED  = 18;
const PLAYER_WIDTH    = 34;
const PLAYER_HEIGHT   = 42;
const SLIDE_HEIGHT    = 22;
const GROUND_OFFSET   = 0.78;   // ground at 78% of canvas height
const BASE_SPEED      = 3.5;
const OBSTACLE_TYPES  = ['spike', 'barrier', 'meteor'];
const POWERUP_TYPES   = ['freeze', 'shield', 'reveal', 'scoreBoost'];
const PARTICLE_POOL   = 200;

// ──── Color palette for canvas rendering ────
const COLORS = {
    playerBody:     '#00e5ff',
    playerBodyDark: '#0077aa',
    playerHurt:     '#ff3355',
    playerShield:   '#44ccff',
    spike:          '#ff4444',
    spikeGlow:      'rgba(255,68,68,0.4)',
    barrier:        '#aa44ff',
    barrierGlow:    'rgba(170,68,255,0.4)',
    meteor:         '#ff8800',
    meteorGlow:     'rgba(255,136,0,0.4)',
    ground:         '#1a1a3a',
    groundLine:     '#2a2a55',
    gridLine:       'rgba(0,240,255,0.06)',
    sky1:           '#06060f',
    sky2:           '#0d0d28',
    star:           '#ffffff',
    building:       '#0a0a22',
    windowLit:      '#ffcc44',
    windowDim:      '#1a1a3a',
    freezePU:       '#66ccff',
    shieldPU:       '#00e5ff',
    revealPU:       '#ffcc00',
    scorePU:        '#00ff88',
};

export class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx    = null;
        this.width  = 0;
        this.height = 0;
        this.dpr    = 1;
        this.groundY = 0;

        // Player state
        this.player = this._createPlayer();

        // Game objects
        this.obstacles = [];
        this.particles = [];
        this.powerUps  = [];

        // Background
        this.stars     = [];
        this.buildings = [];

        // Timers & counters
        this.obstacleTimer   = 0;
        this.powerUpTimer    = 0;
        this.slowMotionTimer = 0;
        this.freezeTimer     = 0;
        this.shieldTimer     = 0;
        this.scoreBoostTimer = 0;
        this.invincibleTimer = 0;

        // Speed & difficulty
        this.gameSpeed  = BASE_SPEED;
        this.speedMult  = 1;         // Dynamic multiplier (from wrong guesses)
        this.levelMult  = 1;         // Scales with level

        // Visual effects
        this.screenShake   = 0;
        this.flashColor    = null;
        this.flashTimer    = 0;
        this.slowMotion    = false;

        // State
        this.running  = false;
        this.distance = 0;
        this.frameCount = 0;
        this.animTime   = 0;

        // Callbacks set by main.js
        this.onCollision     = null;
        this.onPowerUp       = null;
    }

    // ──── Initialization ────

    _createPlayer() {
        return {
            x: 80, y: 0,
            vy: 0,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            grounded: true,
            sliding: false,
            jumping: false,
            hurt: false,
            hurtTimer: 0,
            shielded: false,
            animFrame: 0,
            animTimer: 0,
            trail: [],        // position history for trail effect
        };
    }

    /**
     * Initialize the engine with a canvas element.
     */
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        this._initBackground();
    }

    /**
     * Handle canvas resize (called on window resize).
     */
    resize() {
        this.dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.width  = rect.width;
        this.height = rect.height;
        this.canvas.width  = this.width  * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.groundY = this.height * GROUND_OFFSET;
        this.player.y = this.groundY - this.player.height;
        this._initBackground();
    }

    /**
     * Generate background elements (stars, buildings).
     */
    _initBackground() {
        // Stars
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.width * 3,
                y: Math.random() * this.height * 0.65,
                size: Math.random() * 1.8 + 0.3,
                brightness: Math.random(),
                twinkleSpeed: 0.5 + Math.random() * 2,
            });
        }

        // City silhouette buildings
        this.buildings = [];
        let bx = 0;
        while (bx < this.width * 3) {
            const bw = 18 + Math.random() * 50;
            const bh = 25 + Math.random() * (this.height * 0.35);
            const windows = [];
            const cols = Math.floor(bw / 10);
            const rows = Math.floor(bh / 12);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (Math.random() > 0.5) {
                        windows.push({
                            rx: (c + 0.5) / cols,
                            ry: (r + 0.5) / rows,
                            lit: Math.random() > 0.6,
                        });
                    }
                }
            }
            this.buildings.push({ x: bx, width: bw, height: bh, windows });
            bx += bw + Math.random() * 8;
        }
    }

    // ──── Game Control ────

    /**
     * Reset engine state for a new game.
     * @param {string} mode - 'classic' | 'hardcore' | 'timeAttack'
     * @param {number} level - Starting level
     */
    reset(mode, level = 1) {
        this.player = this._createPlayer();
        this.player.y = this.groundY - this.player.height;
        this.obstacles = [];
        this.particles = [];
        this.powerUps = [];

        this.obstacleTimer   = 0;
        this.powerUpTimer    = 0;
        this.slowMotionTimer = 0;
        this.freezeTimer     = 0;
        this.shieldTimer     = 0;
        this.scoreBoostTimer = 0;
        this.invincibleTimer = 0;

        this.speedMult  = 1;
        this.levelMult  = 1 + (level - 1) * 0.12;
        this.gameSpeed  = BASE_SPEED * this.levelMult;
        this.screenShake = 0;
        this.flashTimer  = 0;
        this.slowMotion  = false;
        this.distance    = 0;
        this.frameCount  = 0;
        this.animTime    = 0;
        this.running     = true;
    }

    pause()  { this.running = false; }
    resume() { this.running = true; }

    // ──── Player Actions ────

    /** Make the player jump (if grounded). */
    jump() {
        if (!this.running) return;
        if (this.player.grounded) {
            this.player.vy = JUMP_VELOCITY;
            this.player.grounded = false;
            this.player.jumping  = true;
            this.player.sliding  = false;

            // Jump particles
            this._spawnBurst(this.player.x + this.player.width / 2,
                             this.groundY, 6, '#00e5ff', 'up');
        }
    }

    /** Start or stop sliding (duck under barriers). */
    slide(active) {
        if (!this.running) return;
        this.player.sliding = active && this.player.grounded;
    }

    // ──── Event Hooks (called by main.js) ────

    /** Visual reward for a correct letter guess. */
    onCorrectGuess() {
        // Brief slow motion
        this.slowMotion = true;
        this.slowMotionTimer = 0.4;

        // Green flash
        this.flashColor = 'rgba(0,255,136,0.15)';
        this.flashTimer = 0.2;

        // Particle burst from top center
        this._spawnBurst(this.width / 2, 40, 15, '#00ff88', 'down');
    }

    /** Visual penalty for a wrong letter guess. */
    onWrongGuess() {
        // Screen shake
        this.screenShake = 8;

        // Red flash
        this.flashColor = 'rgba(255,30,60,0.2)';
        this.flashTimer = 0.3;

        // Speed increase (temporary emphasis)
        this.speedMult = Math.min(this.speedMult + 0.15, 2.0);

        // Immediately spawn an obstacle as punishment
        this._spawnObstacle(true);
    }

    /** Apply a collected power-up effect. */
    applyPowerUp(type) {
        switch (type) {
            case 'freeze':
                this.freezeTimer = 5;
                break;
            case 'shield':
                this.player.shielded = true;
                this.shieldTimer = 8;
                break;
            case 'scoreBoost':
                this.scoreBoostTimer = 10;
                break;
            // 'reveal' is handled in main.js directly
        }
    }

    // ──── Update Loop ────

    /**
     * Main update tick.
     * @param {number} dt - Delta time in seconds (capped externally)
     */
    update(dt) {
        if (!this.running) return;

        // Slow motion effect
        const timeScale = this.slowMotion ? 0.35 : (this.freezeTimer > 0 ? 0.5 : 1);
        const adt = dt * timeScale;

        this.animTime += dt;
        this.frameCount++;
        this.distance += this.gameSpeed * this.speedMult * adt;

        // Update effective speed
        this.gameSpeed = BASE_SPEED * this.levelMult * this.speedMult;

        // ── Timers ──
        if (this.slowMotionTimer > 0) {
            this.slowMotionTimer -= dt;
            if (this.slowMotionTimer <= 0) this.slowMotion = false;
        }
        if (this.freezeTimer > 0)     this.freezeTimer -= dt;
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) this.player.shielded = false;
        }
        if (this.scoreBoostTimer > 0) this.scoreBoostTimer -= dt;
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
        if (this.screenShake > 0)     this.screenShake *= 0.88;
        if (this.screenShake < 0.3)   this.screenShake = 0;
        if (this.flashTimer > 0)      this.flashTimer -= dt;
        if (this.player.hurtTimer > 0) {
            this.player.hurtTimer -= dt;
            if (this.player.hurtTimer <= 0) this.player.hurt = false;
        }

        // ── Player Physics ──
        this._updatePlayer(adt);

        // ── Obstacles ──
        this._updateObstacles(adt);

        // ── Power-ups ──
        this._updatePowerUps(adt);

        // ── Particles ──
        this._updateParticles(dt);

        // ── Collisions ──
        this._checkCollisions();

        // ── Player trail ──
        if (this.frameCount % 3 === 0) {
            this.player.trail.push({
                x: this.player.x + this.player.width / 2,
                y: this.player.y + this.player.height / 2,
                life: 1,
            });
            if (this.player.trail.length > 12) this.player.trail.shift();
        }
        this.player.trail.forEach(t => t.life -= dt * 3);
        this.player.trail = this.player.trail.filter(t => t.life > 0);
    }

    _updatePlayer(dt) {
        const p = this.player;

        // Gravity
        if (!p.grounded) {
            p.vy += GRAVITY;
            if (p.vy > MAX_FALL_SPEED) p.vy = MAX_FALL_SPEED;
            p.y += p.vy;
        }

        // Ground check
        const effectiveHeight = p.sliding ? SLIDE_HEIGHT : PLAYER_HEIGHT;
        const groundLevel = this.groundY - effectiveHeight;

        if (p.y >= groundLevel) {
            p.y = groundLevel;
            if (!p.grounded && p.jumping) {
                // Landing particles
                this._spawnBurst(p.x + p.width / 2, this.groundY, 4, '#00e5ff55', 'up');
            }
            p.vy = 0;
            p.grounded = true;
            p.jumping = false;
        }

        // Update collision height when sliding
        p.height = p.sliding ? SLIDE_HEIGHT : PLAYER_HEIGHT;

        // Running animation
        p.animTimer += dt;
        if (p.animTimer > 0.08) {
            p.animTimer = 0;
            p.animFrame = (p.animFrame + 1) % 8;
        }
    }

    _updateObstacles(dt) {
        const speed = this.gameSpeed * this.speedMult;

        // Spawn timer
        const spawnInterval = Math.max(0.8, 2.2 - (this.levelMult - 1) * 0.3) / this.speedMult;
        this.obstacleTimer += dt;

        if (this.obstacleTimer >= spawnInterval) {
            this.obstacleTimer = 0;
            this._spawnObstacle(false);
        }

        // Move and remove
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];

            if (obs.type === 'meteor') {
                obs.x -= speed * 0.8 * 60 * dt;
                obs.y += speed * 0.6 * 60 * dt;
                // Meteor trail particles
                if (this.frameCount % 2 === 0) {
                    this.particles.push({
                        x: obs.x + obs.width / 2,
                        y: obs.y + obs.height / 2,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -Math.random() * 2,
                        size: 2 + Math.random() * 3,
                        color: Math.random() > 0.5 ? '#ff8800' : '#ffcc00',
                        life: 1,
                        decay: 3 + Math.random() * 2,
                    });
                }
            } else {
                obs.x -= speed * 60 * dt;
            }

            // Remove if off-screen
            if (obs.x + obs.width < -50 || obs.y > this.height + 50) {
                this.obstacles.splice(i, 1);
            }
        }
    }

    _spawnObstacle(forced) {
        // Don't stack obstacles too close
        const nearestX = this.obstacles.reduce((min, o) => Math.min(min, o.x), Infinity);
        if (!forced && nearestX < this.width - 120) return;

        const type = forced ? 'spike' : OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        let obs;

        switch (type) {
            case 'spike':
                obs = {
                    type: 'spike',
                    x: this.width + 20 + (forced ? Math.random() * 100 : 0),
                    y: this.groundY - 38,
                    width: 28,
                    height: 38,
                };
                break;
            case 'barrier':
                obs = {
                    type: 'barrier',
                    x: this.width + 20,
                    y: this.groundY - PLAYER_HEIGHT - 10,
                    width: 55,
                    height: 20,
                };
                break;
            case 'meteor':
                obs = {
                    type: 'meteor',
                    x: this.width + 50,
                    y: -20 - Math.random() * 30,
                    width: 22,
                    height: 22,
                };
                break;
        }

        this.obstacles.push(obs);
    }

    _updatePowerUps(dt) {
        const speed = this.gameSpeed * this.speedMult;

        this.powerUpTimer += dt;
        if (this.powerUpTimer >= 8 + Math.random() * 5) {
            this.powerUpTimer = 0;
            if (Math.random() < 0.4) { // 40% chance to spawn
                const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                this.powerUps.push({
                    type,
                    x: this.width + 20,
                    y: this.groundY - 60 - Math.random() * 60,
                    size: 18,
                    bobPhase: Math.random() * Math.PI * 2,
                });
            }
        }

        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            pu.x -= speed * 60 * dt;
            pu.bobPhase += dt * 3;
            if (pu.x + pu.size < -20) {
                this.powerUps.splice(i, 1);
            }
        }
    }

    _updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += (p.gravity || 0.15);
            p.life -= p.decay * dt;
            p.size *= 0.98;
            if (p.life <= 0 || p.size < 0.2) {
                this.particles.splice(i, 1);
            }
        }
    }

    // ──── Collision Detection ────

    _checkCollisions() {
        const p = this.player;
        // Shrink player hitbox for fairness (80% size)
        const px = p.x + p.width * 0.1;
        const py = p.y + p.height * 0.1;
        const pw = p.width * 0.8;
        const ph = p.height * 0.8;

        // Check obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            if (this._aabb(px, py, pw, ph, obs.x, obs.y, obs.width, obs.height)) {
                // Invincible? Skip
                if (this.invincibleTimer > 0) continue;

                // Shield absorbs hit
                if (p.shielded) {
                    p.shielded = false;
                    this.shieldTimer = 0;
                    this._spawnBurst(obs.x, obs.y, 12, '#44ccff', 'all');
                    this.obstacles.splice(i, 1);
                    this.screenShake = 5;
                    continue;
                }

                // Collision!
                this.obstacles.splice(i, 1);
                p.hurt = true;
                p.hurtTimer = 0.5;
                this.invincibleTimer = 1.5;
                this.screenShake = 12;
                this.flashColor = 'rgba(255,30,60,0.25)';
                this.flashTimer = 0.3;

                this._spawnBurst(p.x + p.width / 2, p.y + p.height / 2, 15, '#ff3355', 'all');

                if (this.onCollision) this.onCollision();
                break; // one hit per frame
            }
        }

        // Check power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            const puY = pu.y + Math.sin(pu.bobPhase) * 6;
            if (this._aabb(px, py, pw, ph, pu.x - pu.size, puY - pu.size, pu.size * 2, pu.size * 2)) {
                const puColor = {
                    freeze: '#66ccff', shield: '#00e5ff',
                    reveal: '#ffcc00', scoreBoost: '#00ff88'
                }[pu.type] || '#ffffff';

                this._spawnBurst(pu.x, puY, 12, puColor, 'all');
                if (this.onPowerUp) this.onPowerUp(pu.type);
                this.powerUps.splice(i, 1);
            }
        }
    }

    /** Axis-aligned bounding box check. */
    _aabb(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 &&
               y1 < y2 + h2 && y1 + h1 > y2;
    }

    // ──── Particle Helpers ────

    _spawnBurst(x, y, count, color, direction) {
        for (let i = 0; i < count; i++) {
            let vx, vy;
            switch (direction) {
                case 'up':
                    vx = (Math.random() - 0.5) * 4;
                    vy = -Math.random() * 5 - 1;
                    break;
                case 'down':
                    vx = (Math.random() - 0.5) * 6;
                    vy = Math.random() * 4 + 1;
                    break;
                default: // 'all'
                    vx = (Math.random() - 0.5) * 8;
                    vy = (Math.random() - 0.5) * 8;
            }
            this.particles.push({
                x, y, vx, vy,
                size: 2 + Math.random() * 4,
                color,
                life: 1,
                decay: 2 + Math.random() * 2,
                gravity: direction === 'up' ? 0.2 : 0.1,
            });
        }
    }

    // ═══════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════

    render() {
        const ctx = this.ctx;
        ctx.save();

        // Screen shake
        if (this.screenShake > 0.5) {
            ctx.translate(
                (Math.random() - 0.5) * this.screenShake,
                (Math.random() - 0.5) * this.screenShake
            );
        }

        // Clear
        ctx.clearRect(-20, -20, this.width + 40, this.height + 40);

        this._drawBackground(ctx);
        this._drawGround(ctx);
        this._drawPowerUps(ctx);
        this._drawObstacles(ctx);
        this._drawPlayer(ctx);
        this._drawParticles(ctx);

        // Screen flash
        if (this.flashTimer > 0 && this.flashColor) {
            ctx.globalAlpha = Math.min(this.flashTimer * 2, 0.5);
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.globalAlpha = 1;
        }

        // Slow motion vignette
        if (this.slowMotion || this.freezeTimer > 0) {
            const grad = ctx.createRadialGradient(
                this.width / 2, this.height / 2, this.height * 0.3,
                this.width / 2, this.height / 2, this.height * 0.8
            );
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, this.freezeTimer > 0 ? 'rgba(50,100,200,0.15)' : 'rgba(0,255,136,0.08)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        ctx.restore();
    }

    // ──── Background Rendering ────

    _drawBackground(ctx) {
        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
        skyGrad.addColorStop(0, COLORS.sky1);
        skyGrad.addColorStop(1, COLORS.sky2);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, this.groundY);

        // Stars (parallax - slow)
        const starScroll = (this.distance * 0.05) % (this.width * 3);
        ctx.save();
        this.stars.forEach(star => {
            const sx = ((star.x - starScroll) % (this.width * 3) + this.width * 3) % (this.width * 3) - this.width;
            if (sx < -5 || sx > this.width + 5) return;

            const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(this.animTime * star.twinkleSpeed + star.brightness * 10));
            ctx.globalAlpha = star.brightness * twinkle;
            ctx.fillStyle = COLORS.star;
            ctx.beginPath();
            ctx.arc(sx, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // City silhouette (parallax - medium)
        const buildScroll = (this.distance * 0.2) % (this.width * 3);
        ctx.save();
        this.buildings.forEach(b => {
            const bx = ((b.x - buildScroll) % (this.width * 3) + this.width * 3) % (this.width * 3) - this.width * 0.5;
            if (bx + b.width < -10 || bx > this.width + 10) return;
            const by = this.groundY - b.height;

            ctx.fillStyle = COLORS.building;
            ctx.fillRect(bx, by, b.width, b.height);

            // Windows
            b.windows.forEach(w => {
                const wx = bx + w.rx * b.width;
                const wy = by + w.ry * b.height;
                ctx.fillStyle = w.lit ? COLORS.windowLit : COLORS.windowDim;
                ctx.globalAlpha = w.lit ? 0.6 + 0.2 * Math.sin(this.animTime * 0.5 + wx) : 0.15;
                ctx.fillRect(wx - 1.5, wy - 1.5, 3, 3);
            });
            ctx.globalAlpha = 1;
        });
        ctx.restore();
    }

    _drawGround(ctx) {
        // Ground fill
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

        // Ground surface line
        ctx.strokeStyle = 'rgba(0,240,255,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.groundY);
        ctx.lineTo(this.width, this.groundY);
        ctx.stroke();

        // Grid lines scrolling
        const gridSpacing = 40;
        const gridScroll = (this.distance * 0.8) % gridSpacing;
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;

        for (let x = -gridScroll; x < this.width + gridSpacing; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, this.groundY);
            ctx.lineTo(x - 20, this.height);
            ctx.stroke();
        }

        // Horizontal grid lines
        const groundH = this.height - this.groundY;
        for (let dy = 15; dy < groundH; dy += 15) {
            ctx.globalAlpha = 1 - dy / groundH;
            ctx.beginPath();
            ctx.moveTo(0, this.groundY + dy);
            ctx.lineTo(this.width, this.groundY + dy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ──── Entity Rendering ────

    _drawPlayer(ctx) {
        const p = this.player;
        ctx.save();

        // Trail
        p.trail.forEach(t => {
            ctx.globalAlpha = t.life * 0.2;
            ctx.fillStyle = p.hurt ? COLORS.playerHurt : COLORS.playerBody;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 4 * t.life, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Hurt flash: skip rendering every other frame
        if (p.hurt && Math.floor(this.animTime * 15) % 2 === 0) {
            ctx.restore();
            return;
        }

        const bx = p.x;
        const by = p.y;
        const bw = p.width;
        const bh = p.height;

        // Glow
        ctx.shadowColor = p.hurt ? COLORS.playerHurt : (p.shielded ? COLORS.playerShield : COLORS.playerBody);
        ctx.shadowBlur = 15;

        // ── Body ──
        const bodyColor = p.hurt ? COLORS.playerHurt : COLORS.playerBody;
        const bodyDark  = p.hurt ? '#aa2244' : COLORS.playerBodyDark;

        if (p.sliding) {
            // Sliding: flattened capsule
            const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
            grad.addColorStop(0, bodyColor);
            grad.addColorStop(1, bodyDark);
            ctx.fillStyle = grad;
            this._roundRect(ctx, bx, by + 2, bw + 8, bh - 4, 8);
            ctx.fill();

            // Eyes
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bx + bw - 8, by + bh / 2 - 3, 2.5, 0, Math.PI * 2);
            ctx.arc(bx + bw - 2, by + bh / 2 - 3, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // ── Head ──
            const headR = bw * 0.3;
            const headX = bx + bw / 2;
            const headY = by + headR + 2;

            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(headX, headY, headR, 0, Math.PI * 2);
            ctx.fill();

            // Visor
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(headX, headY, headR - 2, -0.6, 0.6);
            ctx.stroke();

            // Eyes
            ctx.shadowBlur = 0;
            const eyeY = headY;
            const eyeSpacing = headR * 0.4;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(headX - eyeSpacing, eyeY, 2, 0, Math.PI * 2);
            ctx.arc(headX + eyeSpacing, eyeY, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#001122';
            ctx.beginPath();
            ctx.arc(headX - eyeSpacing + 0.7, eyeY, 1, 0, Math.PI * 2);
            ctx.arc(headX + eyeSpacing + 0.7, eyeY, 1, 0, Math.PI * 2);
            ctx.fill();

            // ── Torso ──
            const torsoTop = headY + headR + 1;
            const torsoH = bh * 0.38;
            const torsoW = bw * 0.65;
            const torsoX = bx + (bw - torsoW) / 2;

            ctx.shadowBlur = 10;
            ctx.shadowColor = bodyColor;
            const tGrad = ctx.createLinearGradient(torsoX, torsoTop, torsoX, torsoTop + torsoH);
            tGrad.addColorStop(0, bodyColor);
            tGrad.addColorStop(1, bodyDark);
            ctx.fillStyle = tGrad;
            this._roundRect(ctx, torsoX, torsoTop, torsoW, torsoH, 4);
            ctx.fill();

            // Belt detail
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(torsoX + 2, torsoTop + torsoH - 4, torsoW - 4, 2);

            // ── Legs ──
            if (p.jumping) {
                // Tucked legs when jumping
                const legW = 5;
                const legH = bh * 0.15;
                ctx.fillStyle = bodyDark;
                ctx.fillRect(headX - 7, torsoTop + torsoH, legW, legH);
                ctx.fillRect(headX + 2, torsoTop + torsoH, legW, legH);
            } else {
                // Animated running legs
                const legW = 4;
                const legH = bh * 0.26;
                const legTop = torsoTop + torsoH;
                const phase = (p.animFrame / 8) * Math.PI * 2;
                const leftOff  = Math.sin(phase) * 7;
                const rightOff = Math.sin(phase + Math.PI) * 7;

                ctx.fillStyle = bodyDark;
                ctx.fillRect(headX - 6 + leftOff, legTop, legW, legH);
                ctx.fillRect(headX + 2 + rightOff, legTop, legW, legH);

                // Feet
                ctx.fillStyle = bodyColor;
                ctx.fillRect(headX - 7 + leftOff, legTop + legH - 3, legW + 2, 3);
                ctx.fillRect(headX + 1 + rightOff, legTop + legH - 3, legW + 2, 3);
            }
        }

        // ── Shield Aura ──
        if (p.shielded) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(0,200,255,0.4)';
            ctx.lineWidth = 2;
            const shieldPulse = 1 + Math.sin(this.animTime * 4) * 0.1;
            ctx.beginPath();
            ctx.ellipse(
                bx + bw / 2, by + bh / 2,
                (bw / 2 + 8) * shieldPulse,
                (bh / 2 + 6) * shieldPulse,
                0, 0, Math.PI * 2
            );
            ctx.stroke();

            ctx.fillStyle = 'rgba(0,200,255,0.05)';
            ctx.fill();
        }

        ctx.restore();
    }

    _drawObstacles(ctx) {
        this.obstacles.forEach(obs => {
            ctx.save();
            switch (obs.type) {
                case 'spike':
                    this._drawSpike(ctx, obs);
                    break;
                case 'barrier':
                    this._drawBarrier(ctx, obs);
                    break;
                case 'meteor':
                    this._drawMeteor(ctx, obs);
                    break;
            }
            ctx.restore();
        });
    }

    _drawSpike(ctx, obs) {
        ctx.shadowColor = COLORS.spikeGlow;
        ctx.shadowBlur = 12;

        const grad = ctx.createLinearGradient(obs.x, obs.y + obs.height, obs.x, obs.y);
        grad.addColorStop(0, '#cc2222');
        grad.addColorStop(1, '#ff5555');
        ctx.fillStyle = grad;

        // Main triangle
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();

        // Highlight edge
        ctx.strokeStyle = 'rgba(255,100,100,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x + 3, obs.y + obs.height - 2);
        ctx.lineTo(obs.x + obs.width / 2, obs.y + 3);
        ctx.stroke();
    }

    _drawBarrier(ctx, obs) {
        ctx.shadowColor = COLORS.barrierGlow;
        ctx.shadowBlur = 10;

        const grad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width, obs.y);
        grad.addColorStop(0, '#7722cc');
        grad.addColorStop(0.5, '#aa44ff');
        grad.addColorStop(1, '#7722cc');
        ctx.fillStyle = grad;
        this._roundRect(ctx, obs.x, obs.y, obs.width, obs.height, 4);
        ctx.fill();

        // Glow line on top
        ctx.strokeStyle = 'rgba(200,130,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(obs.x + 3, obs.y + 2);
        ctx.lineTo(obs.x + obs.width - 3, obs.y + 2);
        ctx.stroke();
    }

    _drawMeteor(ctx, obs) {
        ctx.shadowColor = COLORS.meteorGlow;
        ctx.shadowBlur = 15;

        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        const r = obs.width / 2;

        const grad = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, r);
        grad.addColorStop(0, '#ffcc44');
        grad.addColorStop(0.6, '#ff8800');
        grad.addColorStop(1, '#cc4400');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Hot core
        ctx.fillStyle = 'rgba(255,255,200,0.5)';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawPowerUps(ctx) {
        this.powerUps.forEach(pu => {
            ctx.save();
            const bobY = pu.y + Math.sin(pu.bobPhase) * 6;
            const colorMap = {
                freeze: COLORS.freezePU,
                shield: COLORS.shieldPU,
                reveal: COLORS.revealPU,
                scoreBoost: COLORS.scorePU,
            };
            const iconMap = {
                freeze: '❄',
                shield: '🛡',
                reveal: '⭐',
                scoreBoost: '2×',
            };

            const color = colorMap[pu.type];

            // Glow circle
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;

            ctx.fillStyle = color + '33';
            ctx.beginPath();
            ctx.arc(pu.x, bobY, pu.size + 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pu.x, bobY, pu.size, 0, Math.PI * 2);
            ctx.stroke();

            // Icon
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = `${pu.size * 0.9}px ${pu.type === 'scoreBoost' ? "'Orbitron'" : 'Arial'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(iconMap[pu.type], pu.x, bobY);

            ctx.restore();
        });
    }

    _drawParticles(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ──── Utility ────

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ──── State Getters (for HUD) ────

    get isScoreBoosted() { return this.scoreBoostTimer > 0; }
    get isFrozen()       { return this.freezeTimer > 0; }
    get isShielded()     { return this.player.shielded; }
}
