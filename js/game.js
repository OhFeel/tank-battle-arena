// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1000;
canvas.height = 750;

// DOM Elements
const startScreen = document.getElementById('startScreen');
const settingsMenu = document.getElementById('settingsMenu');
const gameOverScreen = document.getElementById('gameOverScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownText = document.getElementById('countdownText');
const winnerText = document.getElementById('winnerText');
const shotsFired = document.getElementById('shotsFired');
const powerupsCollected = document.getElementById('powerupsCollected');

// Buttons
const startButton = document.getElementById('startButton');
const settingsButton = document.getElementById('settingsButton');
const backButton = document.getElementById('backButton');
const restartButton = document.getElementById('restartButton');
const menuButton = document.getElementById('menuButton');

// Audio Elements
const backgroundMusic = document.getElementById('backgroundMusic');
const shootSound = document.getElementById('shootSound');
const explosionSound = document.getElementById('explosionSound');
const powerupSound = document.getElementById('powerupSound');
const bounceSound = document.getElementById('bounceSound');

// Settings
let musicVolume = 0.5;
let sfxVolume = 0.7;

// Game State
let gameState = {
    active: false,
    over: false,
    countdown: false
};

// Game Statistics
let stats = {
    p1ShotsFired: 0,
    p2ShotsFired: 0,
    p1PowerupsCollected: 0,
    p2PowerupsCollected: 0
};

// Game Assets
const assets = {
    images: {},
    loaded: false,
    loadQueue: 0
};

// Game entities
let tanks = [];
let bullets = [];
let obstacles = [];
let powerUps = [];
let mines = []; // New array to track mines

// Game constants
const TILE_SIZE = 40;
const GRID_COLS = 25; // Increased to match new canvas width
const GRID_ROWS = 18; // Increased to match new canvas height
const POWER_UP_TYPES = {
    SHIELD: 'shield',
    RICOCHET: 'ricochet',
    PIERCING: 'piercing',
    SPEED_BOOST: 'speedBoost',
    RAPID_FIRE: 'rapidFire',
    MINE_LAYER: 'mineLayer', 
    SPREAD_SHOT: 'spreadShot',
    MAGNETIC_SHIELD: 'magneticShield',
    INVISIBILITY: 'invisibility',
    MEGA_BULLET: 'megaBullet',
    TELEPORT: 'teleport',
    EMP_BLAST: 'empBlast',
    EXTRA_LIFE: 'extraLife',
HOMING_MISSILE: 'homingMissile'
};
// Tank class
class Tank {
    constructor(x, y, color, controls, playerNumber) {
        this.x = x;
        this.y = y;
        this.width = 30; 
        this.height = 30;
        this.color = color;
        this.angle = 0;
        this.baseSpeed = 2.0; // Increased base speed for smoother movement
        this.speed = this.baseSpeed;
        this.turnSpeed = 0.04; // Slightly increased turn speed
        this.controls = controls;
        this.moving = { forward: false, backward: false, left: false, right: false };
        this.shooting = false;
        this.layingMine = false; // New property for mine laying
        this.lives = 3;
        this.maxLives = 3;
        this.ammo = 5;
        this.maxAmmo = 5;
        this.baseReloadTime = 1000; // Store base reload time
        this.reloadTime = this.baseReloadTime;
        this.canShoot = true;
        this.playerNumber = playerNumber;
        this.trackMarks = [];
        this.lastTrackTime = 0;
        this.velocityX = 0; // Add velocity tracking for smoother movement
        this.velocityY = 0; // Add velocity tracking for smoother movement
        this.acceleration = 0.15; // Acceleration factor
        this.friction = 0.92; // Friction factor for deceleration
        
        // Power-up properties
        this.shield = false;
        this.ricochet = false;
        this.piercing = false;
        this.speedBoost = false;
        this.rapidFire = false;
        this.spreadShot = 0;
        this.magneticShield = false;
        this.invisibility = false;
        this.megaBullet = false;
        this.empActive = false;
        this.homingMissile = false; // Keep this for compatibility
        this.homingMissileBullets = 0; // Add this new count-based property
        
        // Power-up timers
        this.shieldTimer = 0;
        this.speedBoostTimer = 0;
        this.rapidFireTimer = 0;
        this.magneticShieldTimer = 0;
        this.invisibilityTimer = 0;
        this.empTimer = 0;
        
        // Count-based power-ups (instead of timer-based)
        this.ricochetBullets = 0;
        this.piercingBullets = 0;
        
        // Mine layer specific properties
        this.mines = 0;
        
        // Respawn properties
        this.respawning = false;
        this.respawnTimer = 0;
    }

    update(deltaTime) {
        if (this.respawning) {
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.respawning = false;
                this.shield = true;
                this.shieldTimer = 3000; // 3 seconds of shield after respawn
            }
            return;
        }

        // Apply speed boost effect if active
        let currentSpeed = this.speedBoost ? this.speed * 1.5 : this.speed;
        
        // Calculate target velocity based on input
        let targetVelocityX = 0;
        let targetVelocityY = 0;

        if (this.moving.forward) {
            targetVelocityX = Math.cos(this.angle) * currentSpeed;
            targetVelocityY = Math.sin(this.angle) * currentSpeed;
        }
        if (this.moving.backward) {
            targetVelocityX = -Math.cos(this.angle) * currentSpeed;
            targetVelocityY = -Math.sin(this.angle) * currentSpeed;
        }
        
        // Smoothly approach target velocity
        this.velocityX += (targetVelocityX - this.velocityX) * this.acceleration * (deltaTime / 16);
        this.velocityY += (targetVelocityY - this.velocityY) * this.acceleration * (deltaTime / 16);
        
        // Apply friction when not actively moving or to smooth out changes
        if (!this.moving.forward && !this.moving.backward) {
            this.velocityX *= this.friction;
            this.velocityY *= this.friction;
        }
        
        // Prevent very small movements
        if (Math.abs(this.velocityX) < 0.01) this.velocityX = 0;
        if (Math.abs(this.velocityY) < 0.01) this.velocityY = 0;

        // Leave track marks
        if ((Math.abs(this.velocityX) > 0.5 || Math.abs(this.velocityY) > 0.5) && 
            Date.now() - this.lastTrackTime > 100) {
            this.lastTrackTime = Date.now();
            this.trackMarks.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                angle: this.angle,
                life: 5000 // 5 seconds
            });
        }

        // Check collision for X and Y separately to enable wall sliding
        let newX = this.x + this.velocityX;
        let newY = this.y;
        
        // Try horizontal movement
        if (!this.checkCollision(newX, newY)) {
            this.x = newX;
        } else {
            // If collision, stop horizontal movement
            this.velocityX = 0;
        }
        
        // Try vertical movement
        newX = this.x;
        newY = this.y + this.velocityY;
        
        if (!this.checkCollision(newX, newY)) {
            this.y = newY;
        } else {
            // If collision, stop vertical movement
            this.velocityY = 0;
        }

        // Rotation - smoother with deltaTime normalization
        const turnAmount = this.turnSpeed * (deltaTime / 16);
        if (this.moving.left) this.angle -= turnAmount;
        if (this.moving.right) this.angle += turnAmount;

        // Boundary check with bounce effect
        if (this.x < 0) {
            this.x = 0;
            this.velocityX = Math.abs(this.velocityX) * 0.5; // Bounce with reduced velocity
        } else if (this.x > canvas.width - this.width) {
            this.x = canvas.width - this.width;
            this.velocityX = -Math.abs(this.velocityX) * 0.5; // Bounce with reduced velocity
        }
        
        if (this.y < 0) {
            this.y = 0;
            this.velocityY = Math.abs(this.velocityY) * 0.5; // Bounce with reduced velocity
        } else if (this.y > canvas.height - this.height) {
            this.y = canvas.height - this.height;
            this.velocityY = -Math.abs(this.velocityY) * 0.5; // Bounce with reduced velocity
        }

        // Update power-up timers
        this.updatePowerUpTimers(deltaTime);

        // Update track marks
        for (let i = this.trackMarks.length - 1; i >= 0; i--) {
            this.trackMarks[i].life -= deltaTime;
            if (this.trackMarks[i].life <= 0) {
                this.trackMarks.splice(i, 1);
            }
        }

        // Shooting (only if not EMPed)
        if (this.shooting && this.canShoot && this.ammo > 0 && !this.empActive) {
            this.shoot();
        }
        
        // Check for mine laying (now separate from shooting)
        if (this.layingMine && this.mines > 0) {
            this.layMine();
        }
        
        // Check for magnetic shield effect on nearby bullets
        if (this.magneticShield) {
            this.checkMagneticShieldEffect();
        }
    }
    
    // ... Rest of Tank class methods remain the same
    updatePowerUpTimers(deltaTime) {
        // Update power-up timers
        if (this.shield) {
            this.shieldTimer -= deltaTime;
            if (this.shieldTimer <= 0) this.shield = false;
        }
        
        // Ricochet and piercing are now count-based, not timer-based
        this.ricochet = this.ricochetBullets > 0;
        this.piercing = this.piercingBullets > 0;
        
        if (this.speedBoost) {
            this.speedBoostTimer -= deltaTime;
            if (this.speedBoostTimer <= 0) this.speedBoost = false;
        }
        if (this.rapidFire) {
            this.rapidFireTimer -= deltaTime;
            if (this.rapidFireTimer <= 0) {
                this.rapidFire = false;
                this.reloadTime = this.baseReloadTime; // Reset reload time
            }
        }
        if (this.magneticShield) {
            this.magneticShieldTimer -= deltaTime;
            if (this.magneticShieldTimer <= 0) this.magneticShield = false;
        }
        if (this.invisibility) {
            this.invisibilityTimer -= deltaTime;
            if (this.invisibilityTimer <= 0) this.invisibility = false;
        }
        if (this.empActive) {
            this.empTimer -= deltaTime;
            if (this.empTimer <= 0) this.empActive = false;
        }
    }

    checkMagneticShieldEffect() {
        const shieldRadius = 80;
        
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            
            // Skip bullets from this tank
            if (bullet.owner === this.playerNumber) continue;
            
            // Calculate distance
            const dx = bullet.x - (this.x + this.width/2);
            const dy = bullet.y - (this.y + this.height/2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < shieldRadius) {
                // Bullet got caught in magnetic shield
                bullets.splice(i, 1);
                
                // Play sound
                playSound(bounceSound);
            }
        }
    }
    
    layMine() {
        if (this.mines <= 0) return;
        
        // Don't allow placing mines too frequently
        if (this.lastMinePlaced && Date.now() - this.lastMinePlaced < 1000) return;
        this.lastMinePlaced = Date.now();
        
        // Check if there's already a mine nearby
        const mineDistance = 50;
        for (let mine of mines) {
            const dx = mine.x - (this.x + this.width/2);
            const dy = mine.y - (this.y + this.height/2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mineDistance) return; // Too close to another mine
        }
        
        // Create a new mine behind the tank
        const mineX = this.x + this.width/2 - Math.cos(this.angle) * this.width;
        const mineY = this.y + this.height/2 - Math.sin(this.angle) * this.height;
        
        mines.push({
            x: mineX,
            y: mineY,
            radius: 8,
            owner: this.playerNumber,
            armTime: 5000, // 5 seconds before explosion
            isArmed: true,  // Mines are now always armed
            blastRadius: 80, // Blast radius for the explosion
            blinkInterval: null,
            blinkRate: 500, // Start slow
            blinkState: false
        });
        
        this.mines--;
        
        // Play a sound
        playSound(bounceSound); // Reuse a sound for now
    }

    shoot() {
        if (this.ammo <= 0 || !this.canShoot || this.empActive) return;

        // Store the bullet properties we'll use
        let bulletProperties = {
            isHoming: this.homingMissileBullets > 0, // Check count instead of flag
            isSpread: this.spreadShot > 0,
            isMega: this.megaBullet,
            ricochet: this.ricochet,
            piercing: this.piercing
        };
        
        // Handle the special bullet types with proper stacking
        if (bulletProperties.isSpread) {
            this.shootSpread(bulletProperties);
            this.spreadShot--;
            return;
        }
        
        // Create regular bullet with any remaining properties
        let bullet = new Bullet(
            this.x + this.width / 2 + Math.cos(this.angle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle) * this.height,
            this.angle,
            this.playerNumber,
            bulletProperties.ricochet,
            bulletProperties.piercing,
            bulletProperties.isMega,
            bulletProperties.isHoming ? tanks.find(tank => tank.playerNumber !== this.playerNumber) : null
        );
        bullets.push(bullet);

        // Update ammo and stats
        this.ammo--;
        this.canShoot = false;
        
        // Decrement ricochet and piercing bullet counts if they were used
        if (bulletProperties.ricochet) {
            this.ricochetBullets--;
        }
        
        if (bulletProperties.piercing) {
            this.piercingBullets--;
        }
        
        // Also decrement homing missile bullets if used
        if (bulletProperties.isHoming) {
            this.homingMissileBullets--;
        }
        
        // Handle homingMissile - don't reset it if it's not count-based
        // Reset megaBullet as it's single-use
        if (bulletProperties.isMega) {
            this.megaBullet = false;
        }
        
        if (this.playerNumber === 1) {
            stats.p1ShotsFired++;
        } else {
            stats.p2ShotsFired++;
        }

        // Play sound effect
        playSound(shootSound);

        // Create muzzle flash animation
        const muzzleX = this.x + this.width / 2 + Math.cos(this.angle) * (this.width/2 + 5);
        const muzzleY = this.y + this.height / 2 + Math.sin(this.angle) * (this.height/2 + 5);
        
        createMuzzleFlash(muzzleX, muzzleY, this.angle);

        // Start reload timer (immediate if rapid fire is active)
        if (this.rapidFire) {
            this.canShoot = true; // No delay between shots
            
            // Still reload ammo but faster
            setTimeout(() => {
                if (this.ammo < this.maxAmmo) {
                    this.ammo++;
                }
            }, this.reloadTime / 2);
        } else {
            setTimeout(() => {
                if (this.ammo < this.maxAmmo) {
                    this.ammo++;
                }
                this.canShoot = true;
            }, this.reloadTime);
        }
    }
    
    shootSpread(props) {
        if (this.ammo <= 0 || !this.canShoot) return;
        
        // Create 3 bullets in a spread pattern
        const spreadAngle = Math.PI / 12; // 15 degrees
        const angles = [this.angle - spreadAngle, this.angle, this.angle + spreadAngle];
        
        // Create all three bullets with the same properties
        for (let angle of angles) {
            let bulletProps = {
                x: this.x + this.width / 2 + Math.cos(angle) * this.width,
                y: this.y + this.height / 2 + Math.sin(angle) * this.height,
                angle: angle,
                owner: this.playerNumber,
                ricochet: props.ricochet,
                piercing: props.piercing,
                isMega: props.isMega,
                isHoming: props.isHoming
            };
            
            // Create the appropriate bullet type with all stacked properties
            if (props.isHoming) {
                const targetTank = tanks.find(tank => tank.playerNumber !== this.playerNumber);
                if (targetTank) {
                    bullets.push(new HomingMissile(
                        bulletProps.x,
                        bulletProps.y,
                        bulletProps.angle,
                        this.playerNumber,
                        targetTank,
                        bulletProps.ricochet,
                        bulletProps.piercing,
                        bulletProps.isMega
                    ));
                }
            } else {
                bullets.push(new Bullet(
                    bulletProps.x,
                    bulletProps.y,
                    bulletProps.angle,
                    this.playerNumber,
                    bulletProps.ricochet,
                    bulletProps.piercing,
                    bulletProps.isMega
                ));
            }
        }
        
        // Update ammo and stats
        this.ammo--;
        this.canShoot = false;
        
        // Decrement ricochet and piercing bullet counts if they were used
        // Only decrement once even though three bullets were fired
        if (props.ricochet) {
            this.ricochetBullets--;
        }
        
        if (props.piercing) {
            this.piercingBullets--;
        }
        
        // Also decrement homing missile bullets if used
        if (props.isHoming) {
            this.homingMissileBullets--;
        }
        
        // Handle homingMissile - don't reset it if it's not count-based
        // Reset megaBullet as it's single-use
        if (props.isMega) {
            this.megaBullet = false;
        }
        
        if (this.playerNumber === 1) {
            stats.p1ShotsFired += 3;
        } else {
            stats.p2ShotsFired += 3;
        }

        // Play sound effect
        playSound(shootSound);

        // Start reload timer
        if (this.rapidFire) {
            this.canShoot = true; // No delay between shots for rapid fire
            
            setTimeout(() => {
                if (this.ammo < this.maxAmmo) {
                    this.ammo++;
                }
            }, this.reloadTime / 2);
        } else {
            setTimeout(() => {
                if (this.ammo < this.maxAmmo) {
                    this.ammo++;
                }
                this.canShoot = true;
            }, this.reloadTime);
        }
    }w
    
    // New method for combined homing + mega bullets
    shootHomingMegaBullet(props) {
        if (this.ammo <= 0 || !this.canShoot) return;
        
        // Find the target tank (opponent)
        const targetTank = tanks.find(tank => tank.playerNumber !== this.playerNumber);
        
        if (!targetTank) return;
        
        // Create a homing mega missile
        let homingMissile = new HomingMissile(
            this.x + this.width / 2 + Math.cos(this.angle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle) * this.height,
            this.angle,
            this.playerNumber,
            targetTank,
            props.ricochet,
            props.piercing,
            true // isMega = true
        );
        bullets.push(homingMissile);

        // Update ammo and stats
        this.ammo--;
        this.canShoot = false;
        if (this.playerNumber === 1) {
            stats.p1ShotsFired++;
        } else {
            stats.p2ShotsFired++;
        }

        // Play sound effect with more intensity but capped at 1.0 max volume
        const boostedVolume = Math.min(1.0, sfxVolume * 1.8);
        shootSound.volume = boostedVolume;
        playSound(shootSound);
        shootSound.volume = sfxVolume;

        // Start reload timer
        setTimeout(() => {
            if (this.ammo < this.maxAmmo) {
                this.ammo++;
            }
            this.canShoot = true;
        }, this.reloadTime);
    }

    teleport() {
        const spawnPoint = getRandomSpawnPoint();
        this.x = spawnPoint.x;
        this.y = spawnPoint.y;
        
        // Visual effect for teleport
        this.shield = true;
        this.shieldTimer = 1000; // Brief shield effect
        
        // Play a sound
        playSound(powerupSound);
    }

    empBlast() {
        // Target the other tank
        const otherTank = tanks.find(tank => tank.playerNumber !== this.playerNumber);
        if (otherTank) {
            otherTank.empActive = true;
            otherTank.empTimer = 3000; // 3 seconds
        }
        
        // Play sound
        playSound(bounceSound);
    }

    checkCollision(x, y) {
        // Check collision with obstacles
        for (let obstacle of obstacles) {
            if (x < obstacle.x + obstacle.width &&
                x + this.width > obstacle.x &&
                y < obstacle.y + obstacle.height &&
                y + this.height > obstacle.y) {
                return true;
            }
        }

        // Check collision with other tanks
        for (let tank of tanks) {
            if (tank !== this && !tank.respawning) {
                if (x < tank.x + tank.width &&
                    x + this.width > tank.x &&
                    y < tank.y + tank.height &&
                    y + this.height > tank.y) {
                    return true;
                }
            }
        }

        return false;
    }

    hit() {
        if (this.shield) return false; // Shield blocks hit
        
        this.lives--;
        
        // Create hit animation
        createExplosionEffect(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.width,
            "#ff5500",
            20,
            false
        );
        
        if (this.lives <= 0) {
            // Create larger death animation
            createExplosionEffect(
                this.x + this.width / 2,
                this.y + this.height / 2, 
                this.width * 2,
                "#ff0000",
                40,
                true
            );
            return true; // Tank is destroyed
        }
        
        // Respawn the tank
        this.respawn();
        return false;
    }

    respawn() {
        let spawnPoint = getRandomSpawnPoint();
        this.x = spawnPoint.x;
        this.y = spawnPoint.y;
        this.respawning = true;
        this.respawnTimer = 1500; // 1.5 seconds before respawn
    }

    drawTracks() {
        for (let track of this.trackMarks) {
            ctx.save();
            ctx.translate(track.x, track.y);
            ctx.rotate(track.angle);
            
            // Draw tracks with fading opacity
            let opacity = Math.min(1, track.life / 5000);
            ctx.fillStyle = `rgba(60, 60, 60, ${opacity})`;
            ctx.fillRect(-5, -12, 3, 8);
            ctx.fillRect(-5, 4, 3, 8);
            
            ctx.restore();
        }
    }

    draw() {
        if (this.respawning) return; // Don't draw the tank while respawning

        // Draw track marks first
        this.drawTracks();

        // Apply invisibility effect (reduced opacity)
        const opacity = this.invisibility ? 0.3 : 1;

        // Draw tank
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        // Draw tank body with opacity
        ctx.globalAlpha = opacity;
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Draw tank cannon
        ctx.fillStyle = "#333";
        ctx.fillRect(0, -4, this.width / 2, 8);
        ctx.globalAlpha = 1; // Reset opacity

        // Draw power-up effects
        this.drawPowerUpEffects();

        ctx.restore();
    }
    
    drawPowerUpEffects() {
        // Draw shield effect if active
        if (this.shield) {
            ctx.strokeStyle = "rgba(255, 255, 0, 0.7)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw magnetic shield effect if active
        if (this.magneticShield) {
            ctx.strokeStyle = "rgba(0, 191, 255, 0.7)"; // Deep sky blue
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 70, 0, Math.PI * 2);
            ctx.stroke();
            
            // Add a pulsing inner circle
            const pulseSize = 5 * Math.sin(Date.now() / 100) + 55;
            ctx.beginPath();
            ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw invisibility effect with anti-homing indicator
        if (this.invisibility) {
            ctx.strokeStyle = "rgba(192, 192, 192, 0.5)";
            ctx.lineWidth = 2;
            
            // Draw dotted circle to indicate invisibility
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw anti-homing indicator (crossed crosshair)
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 3, 0, Math.PI * 2);
            ctx.moveTo(-this.width/3, -this.width/3);
            ctx.lineTo(this.width/3, this.width/3);
            ctx.stroke();
        }
        
        // Draw EMP effect if active
        if (this.empActive) {
            ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            // Draw a "disruption" pattern
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const length = 10 + Math.random() * 10;
                ctx.moveTo(0, 0);
                ctx.lineTo(
                    Math.cos(angle) * length, 
                    Math.sin(angle) * length
                );
            }
            ctx.stroke();
        }
    }
}

// Bullet class
class Bullet {
    constructor(x, y, angle, owner, ricochet = false, piercing = false, isMega = false, targetTank = null) {
        this.x = x;
        this.y = y;
        this.radius = isMega ? 8 : 4; // Mega bullets are bigger
        this.angle = angle;
        this.speed = isMega ? 5 : 7; // Mega bullets are slower
        this.owner = owner;
        this.ricochet = ricochet;
        this.piercing = piercing;
        this.isMega = isMega;
        this.targetTank = targetTank; // For homing functionality (optional)
        this.bounces = 0;
        this.maxBounces = 3;
        this.life = 3000; // 3 seconds max life
        this.damage = isMega ? 2 : 1; // Mega bullets do double damage
        
        // Homing properties (if target provided)
        if (targetTank) {
            this.turnSpeed = 0.03;
            this.homingDelay = 500;
            this.startTime = Date.now();
            this.smokeTrail = [];
            this.lastSmokeTime = 0;
        }
    }

    // ... Rest of Bullet class methods remain the same
    update(deltaTime) {
        // Add homing behavior if we have a target tank
        if (this.targetTank && Date.now() - this.startTime > this.homingDelay && !this.targetTank.respawning) {
            // Skip homing if target is invisible
            if (this.targetTank.invisibility) {
                // Just generate smoke trail but don't home
                if (Date.now() - this.lastSmokeTime > 50) {
                    if (!this.smokeTrail) this.smokeTrail = [];
                    
                    this.smokeTrail.push({
                        x: this.x,
                        y: this.y,
                        radius: 3 + Math.random() * 2,
                        life: 1000,
                        opacity: 0.7
                    });
                    this.lastSmokeTime = Date.now();
                }
                
                // Update smoke particles
                if (this.smokeTrail) {
                    for (let i = this.smokeTrail.length - 1; i >= 0; i--) {
                        this.smokeTrail[i].life -= deltaTime;
                        this.smokeTrail[i].opacity = Math.min(0.7, this.smokeTrail[i].life / 1000);
                        if (this.smokeTrail[i].life <= 0) {
                            this.smokeTrail.splice(i, 1);
                        }
                    }
                }
            } else {
                // Original homing logic for visible tanks
                // Generate smoke trail for homing bullets
                if (Date.now() - this.lastSmokeTime > 50) { // Every 50ms
                    if (!this.smokeTrail) this.smokeTrail = [];
                    
                    this.smokeTrail.push({
                        x: this.x,
                        y: this.y,
                        radius: 3 + Math.random() * 2,
                        life: 1000, // 1 second life for smoke particles
                        opacity: 0.7
                    });
                    this.lastSmokeTime = Date.now();
                }
                
                // Update smoke particles
                if (this.smokeTrail) {
                    for (let i = this.smokeTrail.length - 1; i >= 0; i--) {
                        this.smokeTrail[i].life -= deltaTime;
                        this.smokeTrail[i].opacity = Math.min(0.7, this.smokeTrail[i].life / 1000);
                        if (this.smokeTrail[i].life <= 0) {
                            this.smokeTrail.splice(i, 1);
                        }
                    }
                }
                
                // Calculate angle to target
                const dx = (this.targetTank.x + this.targetTank.width/2) - this.x;
                const dy = (this.targetTank.y + this.targetTank.height/2) - this.y;
                let targetAngle = Math.atan2(dy, dx);
                
                // Normalize angles for comparison
                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                // Turn towards target with limited turn rate
                if (Math.abs(angleDiff) > 0.01) {
                    if (angleDiff > 0) {
                        this.angle += Math.min(this.turnSpeed, angleDiff);
                    } else {
                        this.angle -= Math.min(this.turnSpeed, -angleDiff);
                    }
                }
            }
        }
        
        // Calculate next position
        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;
        let bounced = false;
        
        // Check collision with walls
        if (newX - this.radius < 0 || newX + this.radius > canvas.width) {
            if (this.ricochet && this.bounces < this.maxBounces) {
                this.angle = Math.PI - this.angle;
                this.bounces++;
                playSound(bounceSound);
                bounced = true;
                
                // Adjust position slightly to prevent getting stuck
                if (newX - this.radius < 0) {
                    newX = this.radius + 1;
                } else {
                    newX = canvas.width - this.radius - 1;
                }
            } else if (!this.piercing) {
                return true; // Remove bullet
            }
        }

        if (newY - this.radius < 0 || newY + this.radius > canvas.height) {
            if (this.ricochet && this.bounces < this.maxBounces) {
                this.angle = -this.angle;
                this.bounces++;
                playSound(bounceSound);
                bounced = true;
                
                // Adjust position slightly to prevent getting stuck
                if (newY - this.radius < 0) {
                    newY = this.radius + 1;
                } else {
                    newY = canvas.height - this.radius - 1;
                }
            } else if (!this.piercing) {
                return true; // Remove bullet
            }
        }

        // Check collision with obstacles
        for (let i = 0; i < obstacles.length; i++) {
            let obstacle = obstacles[i];
            if (this.checkCollisionWithRect(newX, newY, obstacle)) {
                if (this.ricochet && this.bounces < this.maxBounces) {
                    // Determine which side was hit with improved detection
                    let distLeft = Math.abs(this.x - obstacle.x);
                    let distRight = Math.abs(this.x - (obstacle.x + obstacle.width));
                    let distTop = Math.abs(this.y - obstacle.y);
                    let distBottom = Math.abs(this.y - (obstacle.y + obstacle.height));
                    
                    // Find the minimum distance to determine which side was hit
                    let minDist = Math.min(distLeft, distRight, distTop, distBottom);
                    
                    if (minDist === distLeft || minDist === distRight) {
                        // Hit horizontal side (left or right)
                        this.angle = Math.PI - this.angle;
                        
                        // Move away from obstacle
                        if (minDist === distLeft) {
                            newX = obstacle.x - this.radius - 1;
                        } else {
                            newX = obstacle.x + obstacle.width + this.radius + 1;
                        }
                    } else {
                        // Hit vertical side (top or bottom)
                        this.angle = -this.angle;
                        
                        // Move away from obstacle
                        if (minDist === distTop) {
                            newY = obstacle.y - this.radius - 1;
                        } else {
                            newY = obstacle.y + obstacle.height + this.radius + 1;
                        }
                    }
                    
                    this.bounces++;
                    playSound(bounceSound);
                    bounced = true;
                    break; // Exit the loop once we've handled a collision
                } else if (this.piercing) {
                    // Piercing bullets can destroy destructible obstacles
                    if (obstacle.destructible) {
                        if (obstacle.hit()) {
                            // Create debris effect at the obstacle position
                            createDebrisEffect(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, obstacle.width);
                            obstacles.splice(i, 1);
                            // Continue through the obstacle without stopping
                        }
                    }
                    // Piercing bullets continue through all obstacles
                } else {
                    // Standard bullet hits obstacle and gets removed
                    if (obstacle.destructible) {
                        if (obstacle.hit()) {
                            createDebrisEffect(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, obstacle.width);
                            obstacles.splice(i, 1);
                        }
                    }
                    return true; // Remove bullet
                }
            }
        }

        // If we bounced, recalculate the position based on the new angle
        if (bounced) {
            // Apply a small nudge in the new direction to prevent getting stuck
            this.x = newX;
            this.y = newY;
        } else {
            // Normal movement
            this.x = newX;
            this.y = newY;
        }

        // Check life time
        this.life -= deltaTime;
        if (this.life <= 0) {
            return true; // Remove bullet
        }

        return false; // Keep bullet
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Different colors based on bullet properties
        if (this.isMega) {
            ctx.fillStyle = "#ff0000"; // Red for mega bullets
        } else if (this.piercing) {
            ctx.fillStyle = "#9b59b6"; // Purple for piercing
        } else if (this.ricochet) {
            ctx.fillStyle = "#e67e22"; // Orange for ricochet
        } else {
            ctx.fillStyle = "#f1c40f"; // Yellow for normal
        }
        
        ctx.fill();
        
        // Bullet trail effect
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        
        // Longer trail for mega bullets
        const trailLength = this.isMega ? 20 : 10;
        
        ctx.lineTo(
            this.x - Math.cos(this.angle) * trailLength,
            this.y - Math.sin(this.angle) * trailLength
        );
        
        // Brighter trail for mega bullets
        ctx.strokeStyle = this.isMega ? 
            "rgba(255, 100, 100, 0.7)" : 
            "rgba(255, 255, 200, 0.5)";
        
        ctx.lineWidth = this.isMega ? 3 : 2;
        ctx.stroke();
    }

    checkCollisionWithRect(x, y, rect) {
        return x - this.radius < rect.x + rect.width &&
               x + this.radius > rect.x &&
               y - this.radius < rect.y + rect.height &&
               y + this.radius > rect.y;
    }
}

// HomingMissile class
class HomingMissile extends Bullet {
    constructor(x, y, angle, owner, targetTank, ricochet = false, piercing = false, isMega = false) {
        super(x, y, angle, owner, ricochet, piercing, isMega);
        this.targetTank = targetTank;
        this.speed = isMega ? 4 : 5; // Mega is even slower
        this.turnSpeed = 0.03; // How quickly it can change direction
        this.radius = isMega ? 10 : 6; // Size based on mega status
        this.life = 6000; // Longer life time (6 seconds)
        this.homingDelay = 500; // Start homing after 0.5 seconds
        this.startTime = Date.now();
        this.smokeTrail = [];
        this.lastSmokeTime = 0;
        this.damage = isMega ? 2 : 1; // Mega does double damage
    }
    
    update(deltaTime) {
        // Generate smoke trail
        if (Date.now() - this.lastSmokeTime > 50) { // Every 50ms
            this.smokeTrail.push({
                x: this.x,
                y: this.y,
                radius: 3 + Math.random() * 2,
                life: 1000, // 1 second life for smoke particles
                opacity: 0.7
            });
            this.lastSmokeTime = Date.now();
        }
        
        // Update smoke particles
        for (let i = this.smokeTrail.length - 1; i >= 0; i--) {
            this.smokeTrail[i].life -= deltaTime;
            this.smokeTrail[i].opacity = Math.min(0.7, this.smokeTrail[i].life / 1000);
            if (this.smokeTrail[i].life <= 0) {
                this.smokeTrail.splice(i, 1);
            }
        }
        
        // Only start homing after delay and if target is visible and not respawning
        if (Date.now() - this.startTime > this.homingDelay && 
            this.targetTank && 
            !this.targetTank.respawning && 
            !this.targetTank.invisibility) {  // Check for invisibility
            
            // Calculate angle to target
            const dx = (this.targetTank.x + this.targetTank.width/2) - this.x;
            const dy = (this.targetTank.y + this.targetTank.height/2) - this.y;
            let targetAngle = Math.atan2(dy, dx);
            
            // Normalize angles for comparison
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Turn towards target with limited turn rate
            if (Math.abs(angleDiff) > 0.01) {
                if (angleDiff > 0) {
                    this.angle += Math.min(this.turnSpeed, angleDiff);
                } else {
                    this.angle -= Math.min(this.turnSpeed, -angleDiff);
                }
            }
        }
        
        // Rest of movement and collision logic using parent method
        return super.update(deltaTime);
    }
    
    // Rest of HomingMissile class methods remain the same
}

// Obstacle class
class Obstacle {
    constructor(x, y, width, height, destructible = false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = destructible ? "#8B4513" : "#555"; // Brown for destructible
        this.destructible = destructible;
        this.health = destructible ? 1 : 999; // Destructible walls can be destroyed
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add some texture/detail to obstacles
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        if (this.destructible) {
            // Add wood-like texture for destructible obstacles
            ctx.fillStyle = "#6D4C41";
            
            // Draw horizontal planks
            const plankHeight = 8;
            const numPlanks = Math.floor(this.height / plankHeight);
            
            for (let i = 0; i < numPlanks; i++) {
                if (i % 2 === 0) {
                    ctx.fillRect(
                        this.x, 
                        this.y + i * plankHeight, 
                        this.width, 
                        plankHeight - 2
                    );
                }
            }
        } else {
            // Inner detail for regular obstacles
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.moveTo(this.x + this.width, this.y);
            ctx.lineTo(this.x, this.y + this.height);
            ctx.strokeStyle = "#444";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    
    hit() {
        if (this.destructible) {
            this.health--;
            return this.health <= 0;
        }
        return false;
    }
}

// PowerUp class
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.type = type;
        this.pulsate = 0;
        this.collected = false;
    }

    update(deltaTime) {
        this.pulsate += deltaTime / 200;
        if (this.pulsate > Math.PI * 2) {
            this.pulsate -= Math.PI * 2;
        }

        // Check collision with tanks
        for (let tank of tanks) {
            if (!tank.respawning && !this.collected && 
                this.x < tank.x + tank.width &&
                this.x + this.width > tank.x &&
                this.y < tank.y + tank.height &&
                this.y + this.height > tank.y) {
                
                this.collected = true;
                this.applyPowerUp(tank);
                
                // Update stats
                if (tank.playerNumber === 1) {
                    stats.p1PowerupsCollected++;
                } else {
                    stats.p2PowerupsCollected++;
                }
                
                return true; // Remove power-up
            }
        }
        
        return false;
    }

    applyPowerUp(tank) {
        playSound(powerupSound);

        switch (this.type) {
            case POWER_UP_TYPES.SHIELD:
                tank.shield = true;
                tank.shieldTimer = 5000; // 5 seconds
                break;
            case POWER_UP_TYPES.RICOCHET:
                // Add 3 ricochet bullets instead of setting a timer
                tank.ricochetBullets += 3;
                break;
            case POWER_UP_TYPES.PIERCING:
                // Add 3 piercing bullets instead of setting a timer
                tank.piercingBullets += 3;
                break;
            case POWER_UP_TYPES.SPEED_BOOST:
                tank.speedBoost = true;
                tank.speedBoostTimer = 8000; // 8 seconds
                break;
            case POWER_UP_TYPES.RAPID_FIRE:
                tank.rapidFire = true;
                tank.rapidFireTimer = 5000; // 5 seconds
                break;
            case POWER_UP_TYPES.MINE_LAYER:
                tank.mines += 3; // Give 3 mines
                break;
            case POWER_UP_TYPES.SPREAD_SHOT:
                tank.spreadShot += 3; // Add 3 spread shots
                break;
            case POWER_UP_TYPES.MAGNETIC_SHIELD:
                tank.magneticShield = true;
                tank.magneticShieldTimer = 7000; // 7 seconds
                break;
            case POWER_UP_TYPES.INVISIBILITY:
                tank.invisibility = true;
                tank.invisibilityTimer = 5000; // 5 seconds
                break;
            case POWER_UP_TYPES.MEGA_BULLET:
                tank.megaBullet = true; // Single-use power-up
                break;
            case POWER_UP_TYPES.TELEPORT:
                tank.teleport();
                break;
            case POWER_UP_TYPES.EMP_BLAST:
                tank.empBlast();
                break;
            case POWER_UP_TYPES.EXTRA_LIFE:
                
                    tank.lives++;
                
                break;
            case POWER_UP_TYPES.HOMING_MISSILE:
                // Change from setting flag to adding bullets
                tank.homingMissileBullets += 2; // Give player 2 homing missiles
                break;
        }
    }

    draw() {
        ctx.save();
        
        let scale = 1 + Math.sin(this.pulsate) * 0.1;
        
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.scale(scale, scale);
        
        // Draw background
        ctx.fillStyle = this.getColor();
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw icon based on power-up type - update to match the tank status UI icons
        ctx.fillStyle = "white";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        
        switch(this.type) {
            case POWER_UP_TYPES.SHIELD:
                // Shield icon - circle
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.RICOCHET:
                // Ricochet icon - X with square
                ctx.beginPath();
                ctx.rect(-this.width/5, -this.width/5, this.width/2.5, this.width/2.5);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(-this.width/8, -this.width/8);
                ctx.lineTo(this.width/8, this.width/8);
                ctx.moveTo(-this.width/8, this.width/8);
                ctx.lineTo(this.width/8, -this.width/8);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.PIERCING:
                // Piercing icon - vertical line
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -this.width/3);
                ctx.lineTo(0, this.width/3);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.SPEED_BOOST:
                // Speed boost icon - horizontal arrow
                ctx.beginPath();
                ctx.moveTo(-this.width/3, 0);
                ctx.lineTo(this.width/3, 0);
                ctx.moveTo(this.width/4, -this.width/8);
                ctx.lineTo(this.width/3, 0);
                ctx.lineTo(this.width/4, this.width/8);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.RAPID_FIRE:
                // Rapid fire icon - three dots
                ctx.beginPath();
                ctx.arc(-this.width/8, 0, this.width/12, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(0, 0, this.width/12, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.width/8, 0, this.width/12, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case POWER_UP_TYPES.MINE_LAYER:
                // Mine layer icon - circle with cross
                ctx.beginPath();
                ctx.arc(0, 0, this.width/5, 0, Math.PI * 2);
                ctx.moveTo(-this.width/8, 0);
                ctx.lineTo(this.width/8, 0);
                ctx.moveTo(0, -this.width/8);
                ctx.lineTo(0, this.width/8);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.SPREAD_SHOT:
                // Spread shot icon - three diverging lines
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -this.width/4);
                ctx.moveTo(0, -this.width/8);
                ctx.lineTo(-this.width/6, -this.width/3);
                ctx.moveTo(0, -this.width/8);
                ctx.lineTo(this.width/6, -this.width/3);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.MAGNETIC_SHIELD:
                // Magnetic shield icon - wavy circle with magnet
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2);
                ctx.stroke();
                
                // Add magnet symbol
                ctx.beginPath();
                ctx.rect(-this.width/12, -this.width/6, this.width/6, this.width/12);
                ctx.moveTo(-this.width/12, -this.width/6);
                ctx.lineTo(-this.width/12, -this.width/12);
                ctx.moveTo(this.width/12, -this.width/6);
                ctx.lineTo(this.width/12, -this.width/12);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.INVISIBILITY:
                // Invisibility icon - dotted square
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.rect(-this.width/4, -this.width/4, this.width/2, this.width/2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Add crossed-out eye
                ctx.beginPath();
                ctx.arc(0, 0, this.width/10, 0, Math.PI * 2);
                ctx.moveTo(-this.width/6, -this.width/6);
                ctx.lineTo(this.width/6, this.width/6);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.MEGA_BULLET:
                // Mega bullet icon - large filled dot
                ctx.beginPath();
                ctx.arc(0, 0, this.width/5, 0, Math.PI * 2);
                ctx.fill();
                
                // Add outer circle
                ctx.beginPath();
                ctx.arc(0, 0, this.width/3.5, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.TELEPORT:
                // Teleport icon - two dots with curved arrow
                ctx.beginPath();
                ctx.arc(-this.width/5, -this.width/5, this.width/12, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(this.width/5, this.width/5, this.width/12, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw curved arrow
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0.8, 3.8, false);
                ctx.stroke();
                
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(this.width/5 - this.width/15, this.width/5 - this.width/15);
                ctx.lineTo(this.width/5, this.width/5);
                ctx.lineTo(this.width/5 + this.width/15, this.width/5 - this.width/15);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.EMP_BLAST:
                // EMP icon - electricity symbol
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2, false);
                ctx.stroke();
                
                // Lightning
                ctx.beginPath();
                ctx.moveTo(-this.width/8, -this.width/4);
                ctx.lineTo(0, 0);
                ctx.lineTo(-this.width/8, this.width/4);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(this.width/8, -this.width/4);
                ctx.lineTo(0, 0);
                ctx.lineTo(this.width/8, this.width/4);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.EXTRA_LIFE:
                // Extra life icon - plus sign in circle
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(-this.width/8, 0);
                ctx.lineTo(this.width/8, 0);
                ctx.moveTo(0, -this.width/8);
                ctx.lineTo(0, this.width/8);
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.HOMING_MISSILE:
                // Homing missile icon - target with missile
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(0, 0, this.width/8, 0, Math.PI * 2);
                ctx.stroke();
                
                // Missile
                ctx.beginPath();
                ctx.moveTo(-this.width/4, -this.width/4);
                ctx.lineTo(-this.width/12, -this.width/12);
                ctx.stroke();
                
                // Draw small triangle for missile head
                ctx.beginPath();
                ctx.moveTo(-this.width/4 - 2, -this.width/4 - 2);
                ctx.lineTo(-this.width/4 + 4, -this.width/4);
                ctx.lineTo(-this.width/4, -this.width/4 + 4);
                ctx.closePath();
                ctx.fill();
                break;
        }
        
        ctx.restore();
    }
    
    getColor() {
        switch(this.type) {
            case POWER_UP_TYPES.SHIELD: 
                return "rgba(255, 215, 0, 0.8)"; // Gold
            case POWER_UP_TYPES.RICOCHET: 
                return "rgba(255, 140, 0, 0.8)"; // Orange
            case POWER_UP_TYPES.PIERCING: 
                return "rgba(128, 0, 128, 0.8)"; // Purple
            case POWER_UP_TYPES.SPEED_BOOST: 
                return "rgba(0, 191, 255, 0.8)"; // Deep sky blue
            case POWER_UP_TYPES.RAPID_FIRE: 
                return "rgba(255, 0, 0, 0.8)"; // Red
            case POWER_UP_TYPES.MINE_LAYER: 
                return "rgba(139, 69, 19, 0.8)"; // Brown
            case POWER_UP_TYPES.SPREAD_SHOT: 
                return "rgba(50, 205, 50, 0.8)"; // Lime green
            case POWER_UP_TYPES.MAGNETIC_SHIELD: 
                return "rgba(138, 43, 226, 0.8)"; // Blue violet
            case POWER_UP_TYPES.INVISIBILITY: 
                return "rgba(192, 192, 192, 0.8)"; // Silver
            case POWER_UP_TYPES.MEGA_BULLET: 
                return "rgba(220, 20, 60, 0.8)"; // Crimson
            case POWER_UP_TYPES.TELEPORT: 
                return "rgba(75, 0, 130, 0.8)"; // Indigo
            case POWER_UP_TYPES.EMP_BLAST: 
                return "rgba(255, 255, 0, 0.8)"; // Yellow
            case POWER_UP_TYPES.EXTRA_LIFE: 
                return "rgba(50, 205, 50, 0.8)"; // Lime green
            case POWER_UP_TYPES.HOMING_MISSILE:
                return "rgba(255, 69, 0, 0.8)"; // Orange-red
            default: 
                return "rgba(200, 200, 200, 0.8)"; // Default gray
        }
    }
}

// Utility functions
function getRandomSpawnPoint() {
    const margin = 60;
    let x, y, validSpot = false;
    let tankWidth = 30, tankHeight = 30; // Use actual tank dimensions
    
    // Try to find a spawn point not too close to obstacles or other tanks
    for (let attempts = 0; attempts < 50 && !validSpot; attempts++) {
        x = margin + Math.random() * (canvas.width - margin * 2);
        y = margin + Math.random() * (canvas.height - margin * 2);
        
        // Check if position is valid (using helper function)
        validSpot = isValidPosition(x, y, tankWidth, tankHeight, 50); // 50px buffer around obstacles
    }
    
    // If we couldn't find a valid spot after max attempts, try with reduced requirements
    if (!validSpot) {
        for (let attempts = 0; attempts < 30; attempts++) {
            x = margin + Math.random() * (canvas.width - margin * 2);
            y = margin + Math.random() * (canvas.height - margin * 2);
            validSpot = isValidPosition(x, y, tankWidth, tankHeight, 20); // Smaller buffer
            
            if (validSpot) break;
        }
    }
    
    // Last resort - find any position that doesn't directly overlap
    if (!validSpot) {
        for (let attempts = 0; attempts < 20; attempts++) {
            x = margin + Math.random() * (canvas.width - margin * 2);
            y = margin + Math.random() * (canvas.height - margin * 2);
            validSpot = isValidPosition(x, y, tankWidth, tankHeight, 0); // No buffer
            
            if (validSpot) break;
        }
    }
    
    return { x, y };
}

// Helper function to check if a position is valid
function isValidPosition(x, y, width, height, buffer) {
    // Check against obstacles
    for (let obstacle of obstacles) {
        if (x - buffer < obstacle.x + obstacle.width &&
            x + width + buffer > obstacle.x &&
            y - buffer < obstacle.y + obstacle.height &&
            y + height + buffer > obstacle.y) {
            return false;
        }
    }
    
    // Check against other tanks
    for (let tank of tanks) {
        if (tank.respawning) continue; // Skip respawning tanks
        
        if (x - buffer < tank.x + tank.width &&
            x + width + buffer > tank.x &&
            y - buffer < tank.y + tank.height &&
            y + height + buffer > tank.y) {
            return false;
        }
    }
    
    return true;
}

function playSound(sound) {
    if (!sound) return;
    
    // Ensure volume is within [0,1] range
    const safeVolume = sound === backgroundMusic ? 
        Math.min(1.0, Math.max(0, musicVolume)) : 
        Math.min(1.0, Math.max(0, sfxVolume));
    
    sound.volume = safeVolume;
    
    // Reset and play
    sound.currentTime = 0;
    sound.play().catch(err => {
        // Handle autoplay policy
        console.warn('Audio playback blocked:', err);
    });
}

function createObstacles() {
    obstacles = [];
    
    // Create border walls
    obstacles.push(new Obstacle(0, 0, TILE_SIZE, canvas.height)); // Left wall
    obstacles.push(new Obstacle(0, 0, canvas.width, TILE_SIZE)); // Top wall
    obstacles.push(new Obstacle(canvas.width - TILE_SIZE, 0, TILE_SIZE, canvas.height)); // Right wall
    obstacles.push(new Obstacle(0, canvas.height - TILE_SIZE, canvas.width, TILE_SIZE)); // Bottom wall
    
    // Create random obstacles
    const numObstacles = 15 + Math.floor(Math.random() * 10); // Between 15 and 25 obstacles
    
    for (let i = 0; i < numObstacles; i++) {
        // Decide on a size
        const width = TILE_SIZE * (1 + Math.floor(Math.random() * 2));
        const height = TILE_SIZE * (1 + Math.floor(Math.random() * 2));
        
        // Determine if this obstacle will be destructible (25% chance)
        const isDestructible = Math.random() < 0.25;
        
        // Find a valid position
        let x, y, validPosition = false;
        
        for (let attempts = 0; attempts < 50 && !validPosition; attempts++) {
            x = TILE_SIZE + Math.floor(Math.random() * (GRID_COLS - 3)) * TILE_SIZE;
            y = TILE_SIZE + Math.floor(Math.random() * (GRID_ROWS - 3)) * TILE_SIZE;
            
            validPosition = true;
            
            // Avoid placing obstacles too close to each other
            for (let obstacle of obstacles) {
                if (x < obstacle.x + obstacle.width + TILE_SIZE &&
                    x + width + TILE_SIZE > obstacle.x &&
                    y < obstacle.y + obstacle.height + TILE_SIZE &&
                    y + height + TILE_SIZE > obstacle.y) {
                    validPosition = false;
                    break;
                }
            }
        }
        
        if (validPosition) {
            obstacles.push(new Obstacle(x, y, width, height, isDestructible));
        }
    }
}

// Game initialization
function initGame() {
    createObstacles();
    
    let p1Spawn, p2Spawn;
    
    // Generate random spawn points with minimum distance
    const minDistance = 300;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
        p1Spawn = getRandomSpawnPoint();
        p2Spawn = getRandomSpawnPoint();
        
        const dx = p1Spawn.x - p2Spawn.x;
        const dy = p1Spawn.y - p2Spawn.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        attempts++;
        
        if (distance >= minDistance || attempts >= maxAttempts) break;
    } while (true);
    
    // Default angles
    p1Spawn.angle = 0;
    p2Spawn.angle = Math.PI;
    
    // Create tanks
    tanks = [
        new Tank(p1Spawn.x, p1Spawn.y, "#3498db", {
            forward: 'w',
            backward: 's',
            left: 'a',
            right: 'd',
            shoot: ' ',
            mine: 'e'  // E key for player 1 mine laying
        }, 1),
        
        new Tank(p2Spawn.x, p2Spawn.y, "#e74c3c", {
            forward: 'ArrowUp',
            backward: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
            shoot: '/',
            mine: '.'  // Period key for player 2 mine laying
        }, 2)
    ];
    
    // Reset game state and stats
    bullets = [];
    powerUps = [];
    mines = []; // Reset mines array
    gameState.active = false;
    gameState.over = false;
    gameState.countdown = false;
    
    stats = {
        p1ShotsFired: 0,
        p2ShotsFired: 0,
        p1PowerupsCollected: 0,
        p2PowerupsCollected: 0
    };
    
    // Spawn initial power-up
    spawnPowerUp();
}

function spawnPowerUp() {
    if (powerUps.length >= 3) return; // Maximum 3 power-ups at once
    
    // Find a valid position for the power-up
    let x, y, validSpot = false;
    const powerUpSize = 30;
    const margin = 60;
    
    // Try to find a valid position
    for (let attempts = 0; attempts < 50 && !validSpot; attempts++) {
        x = margin + Math.random() * (canvas.width - margin * 2);
        y = margin + Math.random() * (canvas.height - margin * 2);
        
        validSpot = isValidPosition(x, y, powerUpSize, powerUpSize, 10);
        
        if (validSpot) break;
    }
    
    // If we found a valid spot, create the power-up
    if (validSpot) {
        // Include HOMING_MISSILE in the valid types
        const validTypes = Object.values(POWER_UP_TYPES).filter(type => 
            type !== POWER_UP_TYPES.MEGA_BULLET
        );
        
        const type = validTypes[Math.floor(Math.random() * validTypes.length)];
        powerUps.push(new PowerUp(x, y, type));
        
        // Log which power-up was created for debugging
        console.log(`Created power-up: ${type}`);
    }
    
    // Schedule next power-up spawn
    setTimeout(spawnPowerUp, 5000 + Math.random() * 10000); // 5-15 seconds
}

// Game loop
let lastTime = 0;

function gameLoop(timestamp) {
    // Calculate delta time
    const deltaTime = lastTime ? timestamp - lastTime : 0;
    lastTime = timestamp;
    
    if (gameState.countdown) {
        // Countdown phase - handled by countdown function
        requestAnimationFrame(gameLoop);
        return;
    }
    
    if (!gameState.active || gameState.over) {
        // Game not running
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = "#6c7a89";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw obstacles
    for (let obstacle of obstacles) {
        obstacle.draw();
    }
    
    // Update and draw tanks
    for (let tank of tanks) {
        tank.update(deltaTime);
        tank.draw();
    }
    
    // Update and draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].update(deltaTime)) {
            bullets.splice(i, 1);
        } else {
            bullets[i].draw();
        }
    }
    
    // Update and draw power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        if (powerUps[i].update(deltaTime)) {
            powerUps.splice(i, 1);
        } else {
            powerUps[i].draw();
        }
    }
    
    // Draw explosion particles
    if (window.explosionParticles) {
        for (let i = window.explosionParticles.length - 1; i >= 0; i--) {
            const particle = window.explosionParticles[i];
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Update life
            particle.life -= deltaTime;
            
            // Draw particle
            ctx.globalAlpha = Math.min(1, particle.life / 500);
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = particle.color;
            ctx.fill();
            
            // Remove if expired
            if (particle.life <= 0) {
                window.explosionParticles.splice(i, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
    
    // Update and draw mines
    for (let i = mines.length - 1; i >= 0; i--) {
        let mine = mines[i];
        
        // Update mine countdown
        if (mine.armTime > 0) {
            mine.armTime -= deltaTime;
            
            // Speed up blinking as time decreases
            if (mine.armTime < 1000) {
                mine.blinkRate = 100; // Fast blinking in last second
            } else if (mine.armTime < 3000) {
                mine.blinkRate = 250; // Medium blinking in last 3 seconds
            }
            
            // Handle blinking
            if (!mine.blinkInterval || mine.armTime <= 0) {
                mine.blinkState = !mine.blinkState;
                mine.nextBlink = timestamp + mine.blinkRate;
            } else if (timestamp >= mine.nextBlink) {
                mine.blinkState = !mine.blinkState;
                mine.nextBlink = timestamp + mine.blinkRate;
            }
            
            // Check if time's up - explode the mine
            if (mine.armTime <= 0) {
                // Create explosion effect
                createExplosionEffect(
                    mine.x,
                    mine.y,
                    mine.blastRadius * 2, // Double size for visual effect
                    "#ff3300",
                    40,
                    true
                );
                
                // Check if any tanks are in blast radius
                for (let tank of tanks) {
                    if (tank.respawning) continue;
                    
                    const dx = tank.x + tank.width/2 - mine.x;
                    const dy = tank.y + tank.height/2 - mine.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < mine.blastRadius) {
                        if (tank.hit()) {
                            // Tank was destroyed
                            gameState.over = true;
                            showGameOverScreen(tank.playerNumber === 1 ? 2 : 1);
                        }
                    }
                }
                
                // Check if any destructible obstacles are in blast radius
                for (let j = obstacles.length - 1; j >= 0; j--) {
                    const obstacle = obstacles[j];
                    if (!obstacle.destructible) continue;
                    
                    // Check if obstacle center is within blast radius
                    const obstacleX = obstacle.x + obstacle.width/2;
                    const obstacleY = obstacle.y + obstacle.height/2;
                    const dx = obstacleX - mine.x;
                    const dy = obstacleY - mine.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < mine.blastRadius) {
                        if (obstacle.hit()) {
                            // Create debris effect at the obstacle position
                            createDebrisEffect(obstacleX, obstacleY, obstacle.width);
                            obstacles.splice(j, 1);
                        }
                    }
                }
                
                // Play explosion sound
                playSound(explosionSound);
                
                // Remove the mine
                mines.splice(i, 1);
                continue;
            }
        }
        
        // Draw mine
        ctx.beginPath();
        ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
        
        // Alternate colors for blinking effect
        if (mine.blinkState) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        } else {
            ctx.fillStyle = "rgba(100, 0, 0, 0.8)";
        }
        ctx.fill();
        
        // Add spikes
        for (let j = 0; j < 8; j++) {
            const angle = (j / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(mine.x + Math.cos(angle) * mine.radius,
                      mine.y + Math.sin(angle) * mine.radius);
            ctx.lineTo(mine.x + Math.cos(angle) * (mine.radius + 4),
                      mine.y + Math.sin(angle) * (mine.radius + 4));
            ctx.strokeStyle = mine.blinkState ? "rgba(255, 0, 0, 0.8)" : "rgba(100, 0, 0, 0.8)";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Display countdown timer above mine
        if (mine.armTime > 0) {
            const secondsLeft = Math.ceil(mine.armTime / 1000);
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(secondsLeft, mine.x, mine.y - 15);
        }
    }
    
    // Check for tank collisions with bullets
    checkBulletCollisions();
    
    // Update tank status UI
    if (window.tankStatusUI) {
        if (tanks[0]) window.tankStatusUI.updateTankStatus(tanks[0], 1);
        if (tanks[1]) window.tankStatusUI.updateTankStatus(tanks[1], 2);
    }
    
    // Draw muzzle flashes
    if (window.muzzleFlashes) {
        ctx.save();
        for (let i = window.muzzleFlashes.length - 1; i >= 0; i--) {
            const flash = window.muzzleFlashes[i];
            
            flash.life -= deltaTime;
            const opacity = flash.life / flash.maxLife;
            const scale = 1 - opacity;
            
            ctx.globalAlpha = opacity;
            ctx.translate(flash.x, flash.y);
            ctx.rotate(flash.angle);
            ctx.scale(0.5 + scale, 0.5 + scale/2);
            
            // Draw flash
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
            gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
            gradient.addColorStop(0.5, 'rgba(255, 120, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 20, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
            ctx.save();
            
            if (flash.life <= 0) {
                window.muzzleFlashes.splice(i, 1);
            }
        }
        ctx.restore();
    }
    
    // Draw explosion particles with improved rendering
    if (window.explosionParticles) {
        for (let i = window.explosionParticles.length - 1; i >= 0; i--) {
            const particle = window.explosionParticles[i];
            
            // Update position with gravity and drag
            particle.vy += particle.gravity;
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Update life
            particle.life -= deltaTime;
            
            // Draw particle with gradient
            const opacity = Math.min(1, particle.life / (particle.maxLife / 2));
            ctx.globalAlpha = opacity;
            
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            
            // Create gradient for more realistic particles
            const gradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.radius
            );
            gradient.addColorStop(0, particle.color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Remove if expired
            if (particle.life <= 0) {
                window.explosionParticles.splice(i, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
    
    // Draw shockwaves
    if (window.shockwaves) {
        for (let i = window.shockwaves.length - 1; i >= 0; i--) {
            const shockwave = window.shockwaves[i];
            
            // Update life and size
            shockwave.life -= deltaTime;
            shockwave.radius = shockwave.maxRadius * (1 - shockwave.life / shockwave.maxLife);
            
            // Draw shockwave
            const opacity = Math.min(1, shockwave.life / shockwave.maxLife);
            ctx.globalAlpha = opacity * 0.7;
            ctx.strokeStyle = shockwave.color;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Remove if expired
            if (shockwave.life <= 0) {
                window.shockwaves.splice(i, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
    
    // Draw debris
    if (window.debris) {
        for (let i = window.debris.length - 1; i >= 0; i--) {
            const debris = window.debris[i];
            
            // Update position and rotation
            debris.x += debris.vx;
            debris.y += debris.vy;
            debris.angle += debris.rotationSpeed;
            debris.life -= deltaTime;
            
            // Draw debris
            const opacity = Math.min(1, debris.life / debris.maxLife);
            ctx.globalAlpha = opacity;
            
            ctx.save();
            ctx.translate(debris.x, debris.y);
            ctx.rotate(debris.angle);
            ctx.fillStyle = debris.color;
            ctx.fillRect(-debris.width/2, -debris.height/2, debris.width, debris.height);
            ctx.restore();
            
            // Remove if expired
            if (debris.life <= 0) {
                window.debris.splice(i, 1);
            }
        }
        ctx.globalAlpha = 1;
    }
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

function checkBulletCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];
        
        for (let j = 0; j < tanks.length; j++) {
            let tank = tanks[j];
            let tankPlayerId = j + 1;
            
            // Skip if bullet belongs to this tank
            if (bullet.owner === tankPlayerId) continue;
            
            // Check collision
            if (tank.respawning) continue; // Skip if tank is respawning
            if (bullet.x - bullet.radius < tank.x + tank.width &&
                bullet.x + bullet.radius > tank.x &&
                bullet.y - bullet.radius < tank.y + tank.height &&
                bullet.y + bullet.radius > tank.y) {
                // Hit!
                if (tank.hit()) {
                    // Tank was destroyed
                    gameState.over = true;
                    showGameOverScreen(tankPlayerId === 1 ? 2 : 1);
                }
                
                // Remove bullet unless piercing
                if (!bullet.piercing) {
                    bullets.splice(i, 1);
                }
                
                // Play explosion sound
                playSound(explosionSound);
                
                break;
            }
        }
    }
}

// Fix function for creating explosion effects
function createExplosionEffect(x, y, size, color = "#ff5500", particleCount = 20, addShockwave = false) {
    // Create particles in all directions
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        const distance = Math.random() * size / 2;
        
        const particle = {
            x: x + Math.cos(angle) * (Math.random() * 5),
            y: y + Math.sin(angle) * (Math.random() * 5),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: size / 6 * Math.random() + size / 8,
            life: 500 + Math.random() * 300, // 0.5-0.8 seconds
            maxLife: 800,
            color: color || `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${0.8 + Math.random() * 0.2})`,
            gravity: 0.05 * Math.random()
        };
        
        // Initialize explosionParticles if needed
        if (!window.explosionParticles) window.explosionParticles = [];
        window.explosionParticles.push(particle);
    }
    
    // Add shockwave for bigger explosions
    if (addShockwave) {
        const shockwave = {
            x: x,
            y: y,
            radius: size / 4,
            maxRadius: size * 1.5,
            life: 300,
            maxLife: 300,
            color: 'rgba(255, 255, 255, 0.8)'
        };
        
        if (!window.shockwaves) window.shockwaves = [];
        window.shockwaves.push(shockwave);
    }
    
    // Add debris for more realistic explosions
    if (size > 20) {
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 2;
            
            const debris = {
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                width: 2 + Math.random() * 4,
                height: 2 + Math.random() * 4,
                angle: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                life: 1000 + Math.random() * 1000,
                maxLife: 2000,
                color: '#888888'
            };
            
            if (!window.debris) window.debris = [];
            window.debris.push(debris);
        }
    }
}

// Add muzzle flash effect function
function createMuzzleFlash(x, y, angle) {
    const flash = {
        x: x,
        y: y,
        angle: angle,
        scale: 1,
        life: 150,
        maxLife: 150
    };
    
    if (!window.muzzleFlashes) window.muzzleFlashes = [];
    window.muzzleFlashes.push(flash);
}

// UI functions
function showStartScreen() {
    startScreen.classList.remove('hidden');
    settingsMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    countdownScreen.classList.add('hidden');
    
    // Ensure the game is initialized
    initGame();
    
    // Hide tank status UI
    if (window.tankStatusUI) window.tankStatusUI.hide();
}

function showSettingsMenu() {
    startScreen.classList.add('hidden');
    settingsMenu.classList.remove('hidden');
    
    // Set slider values to current volumes
    document.getElementById('musicVolume').value = musicVolume;
    document.getElementById('sfxVolume').value = sfxVolume;
    
    // Show current volume values
    document.getElementById('musicVolumeValue').textContent = Math.round(musicVolume * 100) + '%';
    document.getElementById('sfxVolumeValue').textContent = Math.round(sfxVolume * 100) + '%';
}

// Update the showCountdown function to include debug logging
function showCountdown() {
    console.log('Starting countdown sequence');
    if (!startScreen || !countdownScreen) {
        console.error('Required screen elements not found for countdown');
        return;
    }
    
    startScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');
    
    let count = 3;
    countdownText.textContent = count;
    console.log('Countdown started:', count);
    
    const countInterval = setInterval(() => {
        count--;
        console.log('Countdown:', count);
        
        if (count > 0) {
            countdownText.textContent = count;
        } else {
            clearInterval(countInterval);
            countdownScreen.classList.add('hidden');
            gameState.countdown = false;
            
            // Make sure we clear any previous bullets or missiles
            bullets = [];
            
            console.log('Countdown finished, starting game');
            startGame();
        }
    }, 1000);
    
    // Show tank status UI
    if (window.tankStatusUI) window.tankStatusUI.show();
}

function startGame() {
    // Make sure old game loop is not running
    if (gameState.active) {
        gameState.active = false;
        console.log("Cancelling previous game loop");
        setTimeout(() => {
            gameState.active = true;
            gameState.over = false;
            lastTime = 0; // Reset time tracker
            playSound(backgroundMusic);
            requestAnimationFrame(gameLoop);
        }, 50);
    } else {
        gameState.active = true;
        gameState.over = false;
        lastTime = 0; // Reset time tracker
        playSound(backgroundMusic);
        requestAnimationFrame(gameLoop);
    }
}

function showGameOverScreen(winningPlayer) {
    // Stop background music
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    
    // Prepare game data for the victory screen
    const gameData = {
        tanks: tanks,
        stats: stats,
        winner: winningPlayer
    };
    
    // Initialize and show the enhanced victory screen
    if (typeof victoryScreen !== 'undefined') {
        victoryScreen.initialize(gameData);
        victoryScreen.show(winningPlayer);
    } else {
        // Fallback to original game over screen if the victory screen is not available
        gameOverScreen.classList.remove('hidden');
        winnerText.textContent = `Player ${winningPlayer} Wins!`;
        shotsFired.textContent = winningPlayer === 1 ? stats.p1ShotsFired : stats.p2ShotsFired;
        powerupsCollected.textContent = winningPlayer === 1 ? stats.p1PowerupsCollected : stats.p2PowerupsCollected;
        restartButton.disabled = false;
    }
    console.log("Game over screen shown, winner is Player " + winningPlayer);
    
    // Hide tank status UI
    if (window.tankStatusUI) window.tankStatusUI.hide();
}

// Keyboard controls
document.addEventListener('DOMContentLoaded', () => {
    startButton.addEventListener('click', showCountdown);
    settingsButton.addEventListener('click', showSettingsMenu);
    backButton.addEventListener('click', showStartScreen);
    restartButton.addEventListener('click', () => {
        // Hide game over screen
        gameOverScreen.classList.add('hidden');
        
        // Reset game state
        gameState.over = false;
        
        // Reset game components
        bullets = [];
        mines = [];
        
        // Create new game with fresh tanks and obstacles
        initGame();
        
        // Start countdown and game
        showCountdown();
    });
    menuButton.addEventListener('click', showStartScreen);
    
    // Volume control with visual feedback
    document.getElementById('musicVolume').addEventListener('input', (e) => {
        musicVolume = parseFloat(e.target.value);
        document.getElementById('musicVolumeValue').textContent = Math.round(musicVolume * 100) + '%';
        if (backgroundMusic) backgroundMusic.volume = musicVolume;
    });
    document.getElementById('sfxVolume').addEventListener('input', (e) => {
        sfxVolume = parseFloat(e.target.value);
        document.getElementById('sfxVolumeValue').textContent = Math.round(sfxVolume * 100) + '%';
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!gameState.active || gameState.over) return;
        handleKeyDown(e);
    });
    document.addEventListener('keyup', (e) => {
        if (!gameState.active || gameState.over) return;
        handleKeyUp(e);
    });
    
    // Initialize the game
    initGame();
    showStartScreen();
});

window.addEventListener('load', () => {
    console.log('Tank Battle Arena loaded!');
});

// Create folders for assets
try {
    // This code would typically run server-side, but we'll include it for reference
    // It would create the audio directory if it doesn't exist
    // const fs = require('fs');
    // if (!fs.existsSync('./audio')) {
    //     fs.mkdirSync('./audio', { recursive: true });
    // }
} catch (err) {
    console.warn('Could not check or create asset directories:', err);
}

/* Update the handleKeyDown function for better input handling */
function handleKeyDown(e) {
    // Prevent default actions for game keys
    if (['w', 's', 'a', 'd', ' ', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '/', '.'].includes(e.key)) {
        e.preventDefault();
    }
    
    // Debug key bindings
    if (e.key === 'F8') {
        console.log('Current game state:', { tanks, obstacles });
        return;
    }
    
    // Control tanks
    if (!gameState.active || gameState.over) return;
    
    for (let tank of tanks) {
        if (!tank.controls) continue;
        
        if (e.key === tank.controls.forward) {
            tank.moving.forward = true;
        }
        if (e.key === tank.controls.backward) {
            tank.moving.backward = true;
        }
        if (e.key === tank.controls.left) {
            tank.moving.left = true;
        }
        if (e.key === tank.controls.right) {
            tank.moving.right = true;
        }
        if (e.key === tank.controls.shoot) {
            tank.shooting = true;
        }
        if (e.key === tank.controls.mine) {  // New control for mine laying
            tank.layingMine = true;
        }
    }
}

// Similarly update handleKeyUp
function handleKeyUp(e) {
    if (!gameState.active || gameState.over) return;
    
    for (let tank of tanks) {
        if (!tank.controls) continue;
        
        if (e.key === tank.controls.forward) tank.moving.forward = false;
        if (e.key === tank.controls.backward) tank.moving.backward = false;
        if (e.key === tank.controls.left) tank.moving.left = false;
        if (e.key === tank.controls.right) tank.moving.right = false;
        if (e.key === tank.controls.shoot) tank.shooting = false;
        if (e.key === tank.controls.mine) tank.layingMine = false;  // New control for mine laying
    }
}

// Add the missing createDebrisEffect function
function createDebrisEffect(x, y, size) {
    // Create debris pieces that fly outward
    const debrisCount = Math.floor(size / 10) + 5; // Number based on size
    
    for (let i = 0; i < debrisCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        const rotationSpeed = (Math.random() - 0.5) * 0.2;
        
        // Randomize debris size
        const debrisWidth = 2 + Math.random() * 6;
        const debrisHeight = 2 + Math.random() * 6;
        
        // Create debris object
        const debris = {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            width: debrisWidth,
            height: debrisHeight,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: rotationSpeed,
            life: 1000 + Math.random() * 1000, // 1-2 seconds
            maxLife: 2000,
            color: '#8B4513' // Brown color for wooden debris
        };
        
        // Initialize debris array if it doesn't exist
        if (!window.debris) window.debris = [];
        window.debris.push(debris);
    }
    
    // Create a small dust cloud effect
    createExplosionEffect(x, y, size / 2, "#A0522D", 10, false);
}

// Update HomingMissile class to not track invisible tanks
HomingMissile.prototype.update = function(deltaTime) {
    // Generate smoke trail
    if (Date.now() - this.lastSmokeTime > 50) { // Every 50ms
        this.smokeTrail.push({
            x: this.x,
            y: this.y,
            radius: 3 + Math.random() * 2,
            life: 1000, // 1 second life for smoke particles
            opacity: 0.7
        });
        this.lastSmokeTime = Date.now();
    }
    
    // Update smoke particles
    for (let i = this.smokeTrail.length - 1; i >= 0; i--) {
        this.smokeTrail[i].life -= deltaTime;
        this.smokeTrail[i].opacity = Math.min(0.7, this.smokeTrail[i].life / 1000);
        if (this.smokeTrail[i].life <= 0) {
            this.smokeTrail.splice(i, 1);
        }
    }
    
    // Only start homing after delay and if target is visible and not respawning
    if (Date.now() - this.startTime > this.homingDelay && 
        this.targetTank && 
        !this.targetTank.respawning && 
        !this.targetTank.invisibility) {  // Check for invisibility
        
        // Calculate angle to target
        const dx = (this.targetTank.x + this.targetTank.width/2) - this.x;
        const dy = (this.targetTank.y + this.targetTank.height/2) - this.y;
        let targetAngle = Math.atan2(dy, dx);
        
        // Normalize angles for comparison
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Turn towards target with limited turn rate
        if (Math.abs(angleDiff) > 0.01) {
            if (angleDiff > 0) {
                this.angle += Math.min(this.turnSpeed, angleDiff);
            } else {
                this.angle -= Math.min(this.turnSpeed, -angleDiff);
            }
        }
    }
    
    // Rest of movement and collision logic using parent method
    return Bullet.prototype.update.call(this, deltaTime);
};

// Update Bullet's update function to properly handle piercing and destructible obstacles
Bullet.prototype.update = function(deltaTime) {
    // Add homing behavior if we have a target tank
    if (this.targetTank && Date.now() - this.startTime > this.homingDelay && !this.targetTank.respawning) {
        // Skip homing if target is invisible
        if (this.targetTank.invisibility) {
            // Just generate smoke trail but don't home
            if (Date.now() - this.lastSmokeTime > 50) {
                if (!this.smokeTrail) this.smokeTrail = [];
                
                this.smokeTrail.push({
                    x: this.x,
                    y: this.y,
                    radius: 3 + Math.random() * 2,
                    life: 1000,
                    opacity: 0.7
                });
                this.lastSmokeTime = Date.now();
            }
            
            // Update smoke particles
            if (this.smokeTrail) {
                for (let i = this.smokeTrail.length - 1; i >= 0; i--) {
                    this.smokeTrail[i].life -= deltaTime;
                    this.smokeTrail[i].opacity = Math.min(0.7, this.smokeTrail[i].life / 1000);
                    if (this.smokeTrail[i].life <= 0) {
                        this.smokeTrail.splice(i, 1);
                    }
                }
            }
        } else {
            // Original homing logic for visible tanks
            // Generate smoke trail for homing bullets
            if (Date.now() - this.lastSmokeTime > 50) { // Every 50ms
                if (!this.smokeTrail) this.smokeTrail = [];
                
                this.smokeTrail.push({
                    x: this.x,
                    y: this.y,
                    radius: 3 + Math.random() * 2,
                    life: 1000, // 1 second life for smoke particles
                    opacity: 0.7
                });
                this.lastSmokeTime = Date.now();
            }
            
            // Update smoke particles
            if (this.smokeTrail) {
                for (let i = this.smokeTrail.length - 1; i >= 0; i--) {
                    this.smokeTrail[i].life -= deltaTime;
                    this.smokeTrail[i].opacity = Math.min(0.7, this.smokeTrail[i].life / 1000);
                    if (this.smokeTrail[i].life <= 0) {
                        this.smokeTrail.splice(i, 1);
                    }
                }
            }
            
            // Calculate angle to target
            const dx = (this.targetTank.x + this.targetTank.width/2) - this.x;
            const dy = (this.targetTank.y + this.targetTank.height/2) - this.y;
            let targetAngle = Math.atan2(dy, dx);
            
            // Normalize angles for comparison
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Turn towards target with limited turn rate
            if (Math.abs(angleDiff) > 0.01) {
                if (angleDiff > 0) {
                    this.angle += Math.min(this.turnSpeed, angleDiff);
                } else {
                    this.angle -= Math.min(this.turnSpeed, -angleDiff);
                }
            }
        }
    }
    
    // Calculate next position
    let newX = this.x + Math.cos(this.angle) * this.speed;
    let newY = this.y + Math.sin(this.angle) * this.speed;
    let bounced = false;
    
    // Check collision with walls
    if (newX - this.radius < 0 || newX + this.radius > canvas.width) {
        if (this.ricochet && this.bounces < this.maxBounces) {
            this.angle = Math.PI - this.angle;
            this.bounces++;
            playSound(bounceSound);
            bounced = true;
            
            // Adjust position slightly to prevent getting stuck
            if (newX - this.radius < 0) {
                newX = this.radius + 1;
            } else {
                newX = canvas.width - this.radius - 1;
            }
        } else if (!this.piercing) {
            return true; // Remove bullet
        }
    }

    if (newY - this.radius < 0 || newY + this.radius > canvas.height) {
        if (this.ricochet && this.bounces < this.maxBounces) {
            this.angle = -this.angle;
            this.bounces++;
            playSound(bounceSound);
            bounced = true;
            
            // Adjust position slightly to prevent getting stuck
            if (newY - this.radius < 0) {
                newY = this.radius + 1;
            } else {
                newY = canvas.height - this.radius - 1;
            }
        } else if (!this.piercing) {
            return true; // Remove bullet
        }
    }

    // Check collision with obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        if (this.checkCollisionWithRect(newX, newY, obstacle)) {
            if (this.ricochet && this.bounces < this.maxBounces) {
                // Determine which side was hit with improved detection
                let distLeft = Math.abs(this.x - obstacle.x);
                let distRight = Math.abs(this.x - (obstacle.x + obstacle.width));
                let distTop = Math.abs(this.y - obstacle.y);
                let distBottom = Math.abs(this.y - (obstacle.y + obstacle.height));
                
                // Find the minimum distance to determine which side was hit
                let minDist = Math.min(distLeft, distRight, distTop, distBottom);
                
                if (minDist === distLeft || minDist === distRight) {
                    // Hit horizontal side (left or right)
                    this.angle = Math.PI - this.angle;
                    
                    // Move away from obstacle
                    if (minDist === distLeft) {
                        newX = obstacle.x - this.radius - 1;
                    } else {
                        newX = obstacle.x + obstacle.width + this.radius + 1;
                    }
                } else {
                    // Hit vertical side (top or bottom)
                    this.angle = -this.angle;
                    
                    // Move away from obstacle
                    if (minDist === distTop) {
                        newY = obstacle.y - this.radius - 1;
                    } else {
                        newY = obstacle.y + obstacle.height + this.radius + 1;
                    }
                }
                
                this.bounces++;
                playSound(bounceSound);
                bounced = true;
                break; // Exit the loop once we've handled a collision
            } else if (this.piercing) {
                // Piercing bullets can destroy destructible obstacles
                if (obstacle.destructible) {
                    if (obstacle.hit()) {
                        // Create debris effect at the obstacle position
                        createDebrisEffect(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, obstacle.width);
                        obstacles.splice(i, 1);
                        // Continue through the obstacle without stopping
                    }
                }
                // Piercing bullets continue through all obstacles
            } else {
                // Standard bullet hits obstacle and gets removed
                if (obstacle.destructible) {
                    if (obstacle.hit()) {
                        createDebrisEffect(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, obstacle.width);
                        obstacles.splice(i, 1);
                    }
                }
                return true; // Remove bullet
            }
        }
    }

    // If we bounced, recalculate the position based on the new angle
    if (bounced) {
        // Apply a small nudge in the new direction to prevent getting stuck
        this.x = newX;
        this.y = newY;
    } else {
        // Normal movement
        this.x = newX;
        this.y = newY;
    }

    // Check life time
    this.life -= deltaTime;
    if (this.life <= 0) {
        return true; // Remove bullet
    }

    return false; // Keep bullet
};

// Fix to make sure homing missiles are cleared properly when mines are active
function showCountdown() {
    console.log('Starting countdown sequence');
    if (!startScreen || !countdownScreen) {
        console.error('Required screen elements not found for countdown');
        return;
    }
    
    startScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');
    
    let count = 3;
    countdownText.textContent = count;
    console.log('Countdown started:', count);
    
    const countInterval = setInterval(() => {
        count--;
        console.log('Countdown:', count);
        
        if (count > 0) {
            countdownText.textContent = count;
        } else {
            clearInterval(countInterval);
            countdownScreen.classList.add('hidden');
            gameState.countdown = false;
            
            // Make sure we clear any previous bullets or missiles
            bullets = [];
            
            console.log('Countdown finished, starting game');
            startGame();
        }
    }, 1000);
    
    // Show tank status UI
    if (window.tankStatusUI) window.tankStatusUI.show();
}

// Update Tank class's drawPowerUpEffects method to indicate invisibility prevents homing
Tank.prototype.drawPowerUpEffects = function() {
    // Draw shield effect if active
    if (this.shield) {
        ctx.strokeStyle = "rgba(255, 255, 0, 0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 1.5, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Draw magnetic shield effect if active
    if (this.magneticShield) {
        ctx.strokeStyle = "rgba(0, 191, 255, 0.7)"; // Deep sky blue
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 70, 0, Math.PI * 2);
        ctx.stroke();
        
        // Add a pulsing inner circle
        const pulseSize = 5 * Math.sin(Date.now() / 100) + 55;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Draw invisibility effect with anti-homing indicator
    if (this.invisibility) {
        ctx.strokeStyle = "rgba(192, 192, 192, 0.5)";
        ctx.lineWidth = 2;
        
        // Draw dotted circle to indicate invisibility
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw anti-homing indicator (crossed crosshair)
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 3, 0, Math.PI * 2);
        ctx.moveTo(-this.width/3, -this.width/3);
        ctx.lineTo(this.width/3, this.width/3);
        ctx.stroke();
    }
    
    // Draw EMP effect if active
    if (this.empActive) {
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Draw a "disruption" pattern
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const length = 10 + Math.random() * 10;
            ctx.moveTo(0, 0);
            ctx.lineTo(
                Math.cos(angle) * length, 
                Math.sin(angle) * length
            );
        }
        ctx.stroke();
    }
};

// Update tank status UI to display the homing missile count correctly
TankStatusUI.prototype.updateTankStatus = function(tank, playerNum) {
    // ...existing code...
    
    // Update special cases for power-ups without timers
    this.updateSpreadShotStatus(powerUpsPanel, 'spreadShot', tank.spreadShot > 0, tank.spreadShot, 3);
    
    // Change this line to use homingMissileBullets instead of homingMissile
    this.updateCountBasedPowerUp(powerUpsPanel, 'homingMissile', tank.homingMissileBullets > 0, tank.homingMissileBullets, 2);
    
    this.updatePowerUpUI(powerUpsPanel, 'megaBullet', tank.megaBullet, null, null);
    
    // ...existing code...
};