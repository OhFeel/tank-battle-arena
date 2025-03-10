// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 1000; // Increased from 800 for more space
canvas.height = 750; // Increased from 600 for more space

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
    EXTRA_LIFE: 'extraLife'
};

// Enhanced online mode variables
let onlineMode = false;
let networkReady = false;
let localPlayerNumber = 0;
let inputBuffer = [];
let lastSyncTime = 0;
const SYNC_INTERVAL = 50; // Sync more frequently (was 100)
let lastFullSyncTime = 0;
const FULL_SYNC_INTERVAL = 500; // Full state sync every 0.5 seconds
let remoteTankState = null; // Store last received state from opponent
let interpolationFactor = 0.2; // How quickly to move toward target position (0-1)

// Tank class
class Tank {
    constructor(x, y, color, controls, playerNumber) {
        this.x = x;
        this.y = y;
        this.width = 30; 
        this.height = 30;
        this.color = color;
        this.angle = 0;
        this.baseSpeed = 1.5; // Store base speed
        this.speed = this.baseSpeed;
        this.turnSpeed = 0.03;
        this.controls = controls;
        this.moving = { forward: false, backward: false, left: false, right: false };
        this.shooting = false;
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
        
        // Power-up timers
        this.shieldTimer = 0;
        this.ricochetTimer = 0;
        this.piercingTimer = 0;
        this.speedBoostTimer = 0;
        this.rapidFireTimer = 0;
        this.magneticShieldTimer = 0;
        this.invisibilityTimer = 0;
        this.empTimer = 0;
        
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

        // If we have target position/angle for network interpolation
        if (onlineMode && this.targetX !== undefined && this.targetY !== undefined) {
            const distX = Math.abs(this.targetX - this.x);
            const distY = Math.abs(this.targetY - this.y);
            
            // Use different interpolation factors based on distance
            let factor = interpolationFactor;
            if (distX > 20 || distY > 20) {
                // If far away, move faster to catch up
                factor = 0.5;
            } else if (distX > 10 || distY > 10) {
                factor = 0.3;
            }
            
            // Use deltaTime-based interpolation
            const adjFactor = 1.0 - Math.pow(1.0 - factor, deltaTime / 16);
            
            this.x += (this.targetX - this.x) * adjFactor;
            this.y += (this.targetY - this.y) * adjFactor;
            
            // Snap when very close
            if (distX < 0.5) this.x = this.targetX;
            if (distY < 0.5) this.y = this.targetY;
        }
        
        // Angle interpolation with deltaTime
        if (this.targetAngle !== undefined) {
            // Find shortest path to target angle (handle wrapping)
            let angleDiff = this.targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Delta-time based interpolation
            const adjFactor = 1.0 - Math.pow(1.0 - interpolationFactor, deltaTime / 16);
            this.angle += angleDiff * adjFactor;
            
            // Normalize angle to [0, 2π)
            while (this.angle < 0) this.angle += Math.PI * 2;
            while (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;
            
            // Snap when close
            if (Math.abs(angleDiff) < 0.05) this.angle = this.targetAngle;
        }

        // Movement
        let moveX = 0;
        let moveY = 0;

        // Apply speed boost effect if active
        let currentSpeed = this.speedBoost ? this.speed * 1.5 : this.speed;

        if (this.moving.forward) {
            moveX = Math.cos(this.angle) * currentSpeed;
            moveY = Math.sin(this.angle) * currentSpeed;
        }
        if (this.moving.backward) {
            moveX = -Math.cos(this.angle) * currentSpeed * 0.5;
            moveY = -Math.sin(this.angle) * currentSpeed * 0.5;
        }

        // Leave track marks
        if ((this.moving.forward || this.moving.backward) && Date.now() - this.lastTrackTime > 100) {
            this.lastTrackTime = Date.now();
            this.trackMarks.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                angle: this.angle,
                life: 5000 // 5 seconds
            });
        }

        // Check collision for X and Y separately to enable wall sliding
        let newX = this.x + moveX;
        let newY = this.y;
        
        // Try horizontal movement
        if (!this.checkCollision(newX, newY)) {
            this.x = newX;
        }
        
        // Try vertical movement
        newX = this.x;
        newY = this.y + moveY;
        
        if (!this.checkCollision(newX, newY)) {
            this.y = newY;
        }

        // Rotation - add deltaTime-based smoothing
        if (this.moving.left) this.angle -= this.turnSpeed * (deltaTime / 8);
        if (this.moving.right) this.angle += this.turnSpeed * (deltaTime / 8);

        // Boundary check
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

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
        
        // Check for mine laying
        if (this.shooting && this.mines > 0) {
            this.layMine();
        }
        
        // Check for magnetic shield effect on nearby bullets
        if (this.magneticShield) {
            this.checkMagneticShieldEffect();
        }
    }
    
    updatePowerUpTimers(deltaTime) {
        // Update power-up timers
        if (this.shield) {
            this.shieldTimer -= deltaTime;
            if (this.shieldTimer <= 0) this.shield = false;
        }
        if (this.ricochet) {
            this.ricochetTimer -= deltaTime;
            if (this.ricochetTimer <= 0) this.ricochet = false;
        }
        if (this.piercing) {
            this.piercingTimer -= deltaTime;
            if (this.piercingTimer <= 0) this.piercing = false;
        }
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
                
                // Visual effect could be added here
                
                // Play sound
                playSound(bounceSound);
            }
        }
    }
    
    layMine() {
        if (this.mines <= 0) return;
        
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
            armTime: 1000, // 1 second before it arms
            isArmed: false
        });
        
        this.mines--;
        
        // Play a sound
        playSound(bounceSound); // Reuse a sound for now
    }

    shoot() {
        if (this.ammo <= 0 || !this.canShoot || this.empActive) return;

        if (this.spreadShot > 0) {
            this.shootSpread();
            this.spreadShot--;
            return;
        }
        
        if (this.megaBullet) {
            this.shootMegaBullet();
            this.megaBullet = false;
            return;
        }

        // Create regular bullet
        let bullet = new Bullet(
            this.x + this.width / 2 + Math.cos(this.angle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle) * this.height,
            this.angle,
            this.playerNumber,
            this.ricochet,
            this.piercing
        );
        bullets.push(bullet);

        // Update ammo and stats
        this.ammo--;
        this.canShoot = false;
        if (this.playerNumber === 1) {
            stats.p1ShotsFired++;
        } else {
            stats.p2ShotsFired++;
        }

        // Play sound effect
        playSound(shootSound);

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
    
    shootSpread() {
        if (this.ammo <= 0 || !this.canShoot) return;
        
        // Create 3 bullets in a spread pattern
        const spreadAngle = Math.PI / 12; // 15 degrees
        
        // Left bullet
        bullets.push(new Bullet(
            this.x + this.width / 2 + Math.cos(this.angle - spreadAngle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle - spreadAngle) * this.height,
            this.angle - spreadAngle,
            this.playerNumber,
            this.ricochet,
            this.piercing
        ));
        
        // Center bullet
        bullets.push(new Bullet(
            this.x + this.width / 2 + Math.cos(this.angle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle) * this.height,
            this.angle,
            this.playerNumber,
            this.ricochet,
            this.piercing
        ));
        
        // Right bullet
        bullets.push(new Bullet(
            this.x + this.width / 2 + Math.cos(this.angle + spreadAngle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle + spreadAngle) * this.height,
            this.angle + spreadAngle,
            this.playerNumber,
            this.ricochet,
            this.piercing
        ));

        // Update ammo and stats
        this.ammo--;
        this.canShoot = false;
        if (this.playerNumber === 1) {
            stats.p1ShotsFired += 3;
        } else {
            stats.p2ShotsFired += 3;
        }

        // Play sound effect
        playSound(shootSound);

        // Start reload timer
        setTimeout(() => {
            if (this.ammo < this.maxAmmo) {
                this.ammo++;
            }
            this.canShoot = true;
        }, this.reloadTime);
    }
    
    shootMegaBullet() {
        if (this.ammo <= 0 || !this.canShoot) return;
        
        // Create a mega bullet
        let bullet = new Bullet(
            this.x + this.width / 2 + Math.cos(this.angle) * this.width,
            this.y + this.height / 2 + Math.sin(this.angle) * this.height,
            this.angle,
            this.playerNumber,
            this.ricochet,
            this.piercing,
            true // is mega bullet
        );
        bullets.push(bullet);

        // Update ammo and stats
        this.ammo--;
        this.canShoot = false;
        if (this.playerNumber === 1) {
            stats.p1ShotsFired++;
        } else {
            stats.p2ShotsFired++;
        }

        // Play sound effect with more intensity
        shootSound.volume = sfxVolume * 1.5;
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
        
        // Visual effect
        // Could add a flash or some visual indicator
        
        // Play sound
        playSound(bounceSound);
    }

    // The rest of the Tank methods remain largely the same
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
        
        if (this.lives <= 0) {
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
    constructor(x, y, angle, owner, ricochet = false, piercing = false, isMega = false) {
        this.x = x;
        this.y = y;
        this.radius = isMega ? 8 : 4; // Mega bullets are bigger
        this.angle = angle;
        this.speed = isMega ? 5 : 7; // Mega bullets are slower
        this.owner = owner;
        this.ricochet = ricochet;
        this.piercing = piercing;
        this.isMega = isMega;
        this.bounces = 0;
        this.maxBounces = 3;
        this.life = 3000; // 3 seconds max life
        this.damage = isMega ? 2 : 1; // Mega bullets do double damage
    }

    // The update and draw methods mostly stay the same, just adjusted for mega bullets
    update(deltaTime) {
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
        for (let obstacle of obstacles) {
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
                } else if (!this.piercing) {
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

// Obstacle class
class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = "#555";
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add some texture/detail to obstacles
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Inner detail
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
        for (let i = 0; i < tanks.length; i++) {
            const tank = tanks[i];
            const tankIndex = i;
            
            if (!tank.respawning && !this.collected && 
                this.x < tank.x + tank.width &&
                this.x + this.width > tank.x &&
                this.y < tank.y + tank.height &&
                this.y + this.height > tank.y) {
                
                // Only handle collection if this is our tank in online mode,
                // or any tank in local mode
                if (!onlineMode || (tankIndex === localPlayerNumber - 1)) {
                    this.collected = true;
                    
                    // In online mode, notify server
                    if (onlineMode && networkManager) {
                        // Find this powerup's index
                        const powerUpIndex = powerUps.indexOf(this);
                        if (powerUpIndex !== -1) {
                            networkManager.send({
                                type: 'collect_powerup',
                                gameId: networkManager.gameId,
                                playerIndex: tankIndex,
                                powerUpIndex: powerUpIndex
                            });
                        }
                    } else {
                        // In offline mode, apply immediately
                        this.applyPowerUp(tank);
                        
                        // Update stats
                        if (tank.playerNumber === 1) {
                            stats.p1PowerupsCollected++;
                        } else {
                            stats.p2PowerupsCollected++;
                        }
                    }
                    
                    return true; // Remove power-up
                }
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
                tank.ricochet = true;
                tank.ricochetTimer = 10000; // 10 seconds
                break;
            case POWER_UP_TYPES.PIERCING:
                tank.piercing = true;
                tank.piercingTimer = 8000; // 8 seconds
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
                tank.mines = 3; // Give 3 mines
                break;
            case POWER_UP_TYPES.SPREAD_SHOT:
                tank.spreadShot = 3; // Next 3 shots will be spread shots
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
                tank.megaBullet = true;
                break;
            case POWER_UP_TYPES.TELEPORT:
                tank.teleport();
                break;
            case POWER_UP_TYPES.EMP_BLAST:
                tank.empBlast();
                break;
            case POWER_UP_TYPES.EXTRA_LIFE:
                if (tank.lives < tank.maxLives) {
                    tank.lives++;
                }
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
        
        // Draw icon based on power-up type
        ctx.fillStyle = "white";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        
        switch(this.type) {
            case POWER_UP_TYPES.SHIELD:
                // Shield icon
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.RICOCHET:
                // Ricochet icon (X shape)
                ctx.beginPath();
                ctx.moveTo(-5, -5);
                ctx.lineTo(5, 5);
                ctx.moveTo(-5, 5);
                ctx.lineTo(5, -5);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.PIERCING:
                // Piercing icon (vertical line)
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(0, 8);
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.SPEED_BOOST:
                // Speed boost icon (horizontal arrows)
                ctx.beginPath();
                ctx.moveTo(-8, 0);
                ctx.lineTo(8, 0);
                ctx.moveTo(5, -3);
                ctx.lineTo(8, 0);
                ctx.lineTo(5, 3);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.RAPID_FIRE:
                // Rapid fire icon (three dots)
                ctx.beginPath();
                ctx.arc(-5, 0, 2, 0, Math.PI * 2);
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.arc(5, 0, 2, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case POWER_UP_TYPES.MINE_LAYER:
                // Mine layer icon (circle with cross)
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.moveTo(-4, 0);
                ctx.lineTo(4, 0);
                ctx.moveTo(0, -4);
                ctx.lineTo(0, 4);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.SPREAD_SHOT:
                // Spread shot icon (three lines diverging)
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.lineTo(0, -1);
                ctx.moveTo(0, -4);
                ctx.lineTo(-5, -10);
                ctx.moveTo(0, -4);
                ctx.lineTo(5, -10);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.MAGNETIC_SHIELD:
                // Magnetic shield icon (wavy circle)
                ctx.beginPath();
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const radius = i % 2 === 0 ? 7 : 5;
                    if (i === 0) {
                        ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                    } else {
                        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                    }
                }
                ctx.closePath();
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.INVISIBILITY:
                // Invisibility icon (eye with slash)
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.moveTo(-8, -8);
                ctx.lineTo(8, 8);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.MEGA_BULLET:
                // Mega bullet icon (large dot)
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case POWER_UP_TYPES.TELEPORT:
                // Teleport icon (lightning bolt)
                ctx.beginPath();
                ctx.moveTo(-2, -8);
                ctx.lineTo(2, -3);
                ctx.lineTo(-2, 2);
                ctx.lineTo(2, 8);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.EMP_BLAST:
                // EMP icon (electricity symbol)
                ctx.beginPath();
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const x1 = Math.cos(angle) * 6;
                    const y1 = Math.sin(angle) * 6;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(x1, y1);
                }
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.EXTRA_LIFE:
                // Extra life icon (plus sign)
                ctx.beginPath();
                ctx.moveTo(-6, 0);
                ctx.lineTo(6, 0);
                ctx.moveTo(0, -6);
                ctx.lineTo(0, 6);
                ctx.lineWidth = 2;
                ctx.stroke();
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
    
    sound.volume = sound === backgroundMusic ? musicVolume : sfxVolume;
    
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
            obstacles.push(new Obstacle(x, y, width, height));
        }
    }
}

// Add function to generate obstacles based on seed
function createObstaclesWithSeed(seed) {
    obstacles = [];
    
    // Create a pseudo-random number generator with the seed
    const seededRandom = function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    
    // Create border walls
    obstacles.push(new Obstacle(0, 0, TILE_SIZE, canvas.height)); // Left wall
    obstacles.push(new Obstacle(0, 0, canvas.width, TILE_SIZE)); // Top wall
    obstacles.push(new Obstacle(canvas.width - TILE_SIZE, 0, TILE_SIZE, canvas.height)); // Right wall
    obstacles.push(new Obstacle(0, canvas.height - TILE_SIZE, canvas.width, TILE_SIZE)); // Bottom wall
    
    // Create random obstacles using the seeded random function
    const numObstacles = 15 + Math.floor(seededRandom() * 10); // Between 15 and 25 obstacles
    
    for (let i = 0; i < numObstacles; i++) {
        // Decide on a size
        const width = TILE_SIZE * (1 + Math.floor(seededRandom() * 2));
        const height = TILE_SIZE * (1 + Math.floor(seededRandom() * 2));
        
        // Find a valid position
        let x, y, validPosition = false;
        
        for (let attempts = 0; attempts < 50 && !validPosition; attempts++) {
            x = TILE_SIZE + Math.floor(seededRandom() * (GRID_COLS - 3)) * TILE_SIZE;
            y = TILE_SIZE + Math.floor(seededRandom() * (GRID_ROWS - 3)) * TILE_SIZE;
            
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
            obstacles.push(new Obstacle(x, y, width, height));
        }
    }
    
    return obstacles;
}

// Game initialization
function initGame(isOnlineMode = false, playerNum = 0, mapSeed = null, initialTankPositions = null) {
    console.log(`Initializing game: online=${isOnlineMode}, player=${playerNum}, seed=${mapSeed}`);
    onlineMode = isOnlineMode;
    localPlayerNumber = playerNum;
    networkReady = networkManager && networkManager.networkReady;
    
    // Create obstacles - use seed if provided (online mode)
    if (mapSeed !== null) {
        obstacles = createObstaclesWithSeed(mapSeed);
        
        // In online mode, send obstacle data to server if we're player 1
        if (onlineMode && networkManager && playerNum === 1) {
            // Small delay to ensure connection is established
            setTimeout(() => {
                networkManager.sendMapData(
                    obstacles.map(o => ({
                        x: o.x, 
                        y: o.y, 
                        width: o.width, 
                        height: o.height
                    })),
                    mapSeed
                );
            }, 500);
        }
    } else {
        // Regular obstacle creation for local games
        createObstacles();
    }
    
    let p1Spawn, p2Spawn;
    
    if (initialTankPositions) {
        // Use server-provided positions
        console.log('Using server-provided tank positions');
        p1Spawn = initialTankPositions.find(t => t.playerNumber === 1);
        p2Spawn = initialTankPositions.find(t => t.playerNumber === 2);
    } else {
        // Generate random spawn points with minimum distance
        console.log('Generating random tank positions');
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
    }
    
    // Create tanks
    tanks = [
        new Tank(p1Spawn.x, p1Spawn.y, "#3498db", {
            forward: 'w',
            backward: 's',
            left: 'a',
            right: 'd',
            shoot: ' '
        }, 1),
        
        new Tank(p2Spawn.x, p2Spawn.y, "#e74c3c", {
            forward: 'ArrowUp',
            backward: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
            shoot: '/'
        }, 2)
    ];
    
    // Set initial angles from server data if available
    if (p1Spawn.angle !== undefined) tanks[0].angle = p1Spawn.angle;
    if (p2Spawn.angle !== undefined) tanks[1].angle = p2Spawn.angle;
    
    // If online mode, modify controls based on player number
    if (onlineMode) {
        console.log(`Setting up as player ${playerNum}`);
        if (playerNum === 1) {
            // Player 1 controls the blue tank (tanks[0])
            tanks[1].controls = {}; // Remove controls from opponent's tank
        } else {
            // Player 2 controls the red tank (tanks[1])
            tanks[0].controls = {}; // Remove controls from opponent's tank
        }
        
        // Add target properties for smooth interpolation
        tanks.forEach(tank => {
            tank.targetX = tank.x;
            tank.targetY = tank.y;
            tank.targetAngle = tank.angle;
        });
        
        // Setup network event listeners
        setupNetworkHandlers();
    }
    
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

// Function to handle initialization using server data
function initializeFromServerState(gameState) {
    if (!gameState) return;
    
    console.log('Initializing game from server state');
    
    // Update tank positions from server
    gameState.tanks.forEach((tankState, index) => {
        if (tanks[index]) {
            tanks[index].x = tankState.x;
            tanks[index].y = tankState.y;
            tanks[index].angle = tankState.angle;
            tanks[index].lives = tankState.lives;
            
            // Also update target positions for interpolation
            tanks[index].targetX = tankState.x;
            tanks[index].targetY = tankState.y;
            tanks[index].targetAngle = tankState.angle;
        }
    });
    
    // Verify sync with server
    verifyGameSync();
}

// Function to verify game synchronization with server
function verifyGameSync() {
    if (!networkManager) return;
    
    const syncData = {
        tankPositions: tanks.map(tank => ({
            x: tank.x,
            y: tank.y,
            angle: tank.angle
        }))
    };
    
    networkManager.verifyGameSync(syncData);
}

// Update setupNetworkHandlers function
function setupNetworkHandlers() {
    if (!networkManager) return;
    
    // Listen for initial game state from server
    networkManager.on('onInitialGameState', (gameState) => {
        initializeFromServerState(gameState);
    });
    
    // Listen for opponent inputs with improved handling
    networkManager.on('onOpponentInput', (data) => {
        if (!data || !data.input) {
            console.warn('Received invalid opponent input data');
            return;
        }
        
        const opponentTankIndex = data.playerNumber === 1 ? 0 : 1;
        const myTankIndex = localPlayerNumber - 1;
        const tank = tanks[opponentTankIndex];
        
        // Safety check
        if (!tank) {
            console.error('Tank not found for opponent input:', data);
            return;
        }
        
        // Don't apply inputs to my own tank
        if (opponentTankIndex === myTankIndex) {
            console.warn('Received input for my own tank - ignoring');
            return;
        }
        
        // Apply opponent input
        const input = data.input;
        
        // Update movement
        if ('moving' in input) {
            tank.moving = input.moving;
        }
        
        // Update shooting
        if ('shooting' in input) {
            tank.shooting = input.shooting;
        }
        
        // Handle position correction from server (more authoritative)
        if (input.serverPosition) {
            tank.targetX = input.serverPosition.x;
            tank.targetY = input.serverPosition.y;
            tank.targetAngle = input.serverPosition.angle;
        }
        // Client position as fallback
        else if (input.position) {
            tank.targetX = input.position.x;
            tank.targetY = input.position.y;
        }
        
        // Handle angle correction
        if ('angle' in input) {
            tank.targetAngle = input.angle;
        }
    });
    
    // Handle map synchronization data from server
    networkManager.on('onMapSync', (data) => {
        if (!data.obstacles || !Array.isArray(data.obstacles)) return;
        
        console.log('Received map data from server');
        
        // Replace obstacles with server data
        obstacles = data.obstacles.map(o => new Obstacle(o.x, o.y, o.width, o.height));
    });
    
    // Handle power-up spawn events from server
    networkManager.on('onPowerUpSpawn', (data) => {
        if (!data.powerUp) return;
        
        console.log('Received power-up data from server:', data.powerUp);
        
        // Add the power-up to the game
        const powerUp = new PowerUp(
            data.powerUp.x, 
            data.powerUp.y, 
            data.powerUp.type
        );
        powerUps.push(powerUp);
    });
    
    // Handle opponent disconnection
    networkManager.on('onOpponentDisconnected', () => {
        if (gameState.active) {
            // Auto-win when opponent disconnects
            gameState.over = true;
            showGameOverScreen(localPlayerNumber);
            winnerText.textContent = "Opponent Disconnected - You Win!";
        }
    });
}

// Add a function to set up network map listeners
function setupNetworkMapListeners() {
    if (!networkManager) return;
    
    // Handle map synchronization data from server
    networkManager.on('onMapSync', (data) => {
        if (!data.obstacles || !Array.isArray(data.obstacles)) return;
        
        console.log('Received map data from server');
        
        // Replace obstacles with server data
        obstacles = data.obstacles.map(o => new Obstacle(o.x, o.y, o.width, o.height));
    });
    
    // Handle power-up spawn events from server
    networkManager.on('onPowerUpSpawn', (data) => {
        if (!data.powerUp) return;
        
        console.log('Received power-up data from server:', data.powerUp);
        
        // Add the power-up to the game
        const powerUp = new PowerUp(
            data.powerUp.x, 
            data.powerUp.y, 
            data.powerUp.type
        );
        powerUps.push(powerUp);
    });
}

// Add a function to properly clean up the game state
function resetGameState() {
    // Stop all active timers and animations if any exist
    // (Add specific timer cleanup if you have any)
    
    // Clear all game entities
    bullets = [];
    powerUps = [];
    mines = [];
    
    // Reset game flags
    gameState.active = false;
    gameState.over = false;
    gameState.countdown = false;
    
    // Clear statistics
    stats = {
        p1ShotsFired: 0,
        p2ShotsFired: 0,
        p1PowerupsCollected: 0,
        p2PowerupsCollected: 0
    };
    
    // Create fresh game
    initGame();
    
    console.log("Game state reset successfully");
}

// Add this new function for online mode inputs
function setupNetworkInputHandlers() {
    // Listen for opponent inputs
    networkManager.on('onOpponentInput', (data) => {
        if (!data || !data.input) {
            console.warn('Received invalid opponent input data');
            return;
        }
        
        const opponentTankIndex = localPlayerNumber === 1 ? 1 : 0;
        const tank = tanks[opponentTankIndex];
        
        // Apply opponent input
        if (tank && data.input) {
            const input = data.input;
            
            // Update movement
            if ('moving' in input) {
                tank.moving = input.moving;
            }
            
            // Update shooting
            if ('shooting' in input) {
                tank.shooting = input.shooting;
            }
            
            // Handle position correction if provided
            if ('position' in input && input.position) {
                tank.targetX = input.position.x;
                tank.targetY = input.position.y;
            }
            
            // Handle angle correction
            if ('angle' in input) {
                tank.targetAngle = input.angle;
            }
        }
    });
    
    // Handle full state sync from opponent
    networkManager.on('onOpponentStateSync', (data) => {
        if (!data || !data.tankState) {
            console.warn('Received invalid opponent state data');
            return;
        }
        
        const opponentTankIndex = localPlayerNumber === 1 ? 1 : 0;
        const tank = tanks[opponentTankIndex];
        
        if (tank && data.tankState) {
            // Apply full tank state
            remoteTankState = data.tankState;
            
            // Set position and angle target for interpolation
            tank.targetX = remoteTankState.x;
            tank.targetY = remoteTankState.y;
            tank.targetAngle = remoteTankState.angle;
            
            // Direct state updates (no interpolation needed)
            tank.lives = remoteTankState.lives;
            tank.ammo = remoteTankState.ammo;
            tank.shield = remoteTankState.shield;
            tank.shieldTimer = remoteTankState.shieldTimer;
            tank.ricochet = remoteTankState.ricochet;
            tank.piercing = remoteTankState.piercing;
            tank.respawning = remoteTankState.respawning;
            
            // Update other power-up states
            Object.keys(remoteTankState).forEach(key => {
                if (key.endsWith('Timer') || key === 'moving' || key === 'shooting') {
                    tank[key] = remoteTankState[key];
                }
            });
        }
    });
    
    // Handle opponent disconnection
    networkManager.on('onOpponentDisconnected', () => {
        if (gameState.active) {
            // Auto-win when opponent disconnects
            gameState.over = true;
            showGameOverScreen(localPlayerNumber);
            winnerText.textContent = "Opponent Disconnected - You Win!";
        }
    });
}

// A utility function for dejittering opponent movement
function smoothPosition(current, target, factor) {
    return current + (target - current) * factor;
}

// Modify the Tank update method to handle network interpolation better
// Inside the Tank class, update method - adjust how we handle targetX/Y:
Tank.prototype.smoothUpdate = function(deltaTime) {
    // If we have target position/angle for network interpolation
    if (onlineMode && this.targetX !== undefined && this.targetY !== undefined) {
        const distX = Math.abs(this.targetX - this.x);
        const distY = Math.abs(this.targetY - this.y);
        
        // Use different interpolation factors based on distance
        let factor = interpolationFactor;
        if (distX > 10 || distY > 10) {
            // If far away, move faster to catch up
            factor = 0.3;
        }
        
        // Smoothly move to target position
        this.x = smoothPosition(this.x, this.targetX, factor);
        this.y = smoothPosition(this.y, this.targetY, factor);
        
        // If we're very close to target, snap to it to avoid jitter
        if (distX < 0.5) this.x = this.targetX;
        if (distY < 0.5) this.y = this.targetY;
    }
    
    // Similar improvements for angle interpolation
    if (onlineMode && this.targetAngle !== undefined) {
        // Find shortest path to target angle
        let angleDiff = this.targetAngle - this.angle;
        
        // Normalize the angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        this.angle += angleDiff * interpolationFactor;
        
        // Snap if very close
        if (Math.abs(angleDiff) < 0.05) this.angle = this.targetAngle;
    }
    
    /* ...rest of the update method... */
};

// Modify handleGameFound in the online UI module to pass the map seed
function handleGameFound(gameData) {
    /* ...existing code... */
    
    // Initialize game in online mode with the map seed
    if (typeof initGame === 'function') {
        initGame(true, gameData.playerNumber, gameData.mapSeed);
    } else {
        console.error('initGame function not found!');
        return;
    }
    
    /* ...rest of the function... */
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
        // Filter out problematic power-up types (MEGA_BULLET)
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

const originalGameLoop = gameLoop; // This line might cause issues if gameLoop hasn't been defined yet
gameLoop = function(timestamp) {
    // Call the original game loop
    originalGameLoop(timestamp);
    
    // Handle network syncing
    if (onlineMode && networkReady && gameState.active) {
        const now = Date.now();
        
        // Process and send any accumulated inputs
        if (inputBuffer.length > 0 && now - lastSyncTime > SYNC_INTERVAL) {
            // Take latest input for sending
            const latestInput = inputBuffer[inputBuffer.length - 1];
            
            // Send this input to the server
            networkManager.sendGameInput({
                moving: latestInput.tank.moving,
                shooting: latestInput.tank.shooting,
                position: {
                    x: latestInput.tank.x,
                    y: latestInput.tank.y
                },
                angle: latestInput.tank.angle
            });
            
            // Clear input buffer after sending
            inputBuffer = [];
            
            // Update last sync time
            lastSyncTime = now;
        }
        
        // Full state sync periodically
        if (now - lastFullSyncTime > FULL_SYNC_INTERVAL) {
            // Get the local tank
            const myTankIndex = localPlayerNumber - 1;
            const myTank = tanks[myTankIndex];
            
            if (myTank) {
                // Create a comprehensive state object
                const tankState = {
                    x: myTank.x,
                    y: myTank.y,
                    angle: myTank.angle,
                    lives: myTank.lives,
                    ammo: myTank.ammo,
                    moving: myTank.moving,
                    shooting: myTank.shooting,
                    shield: myTank.shield,
                    shieldTimer: myTank.shieldTimer,
                    ricochet: myTank.ricochet,
                    ricochetTimer: myTank.ricochetTimer,
                    piercing: myTank.piercing,
                    piercingTimer: myTank.piercingTimer,
                    respawning: myTank.respawning
                };
                
                // Add any active power-ups
                if (myTank.speedBoost) tankState.speedBoost = myTank.speedBoost;
                if (myTank.rapidFire) tankState.rapidFire = myTank.rapidFire;
                if (myTank.invisibility) tankState.invisibility = myTank.invisibility;
                
                // Send full state update
                networkManager.syncTankState(tankState);
                
                // Update timestamp
                lastFullSyncTime = now;
            }
        }
    }
};

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
    
    // Update and draw mines
    for (let i = mines.length - 1; i >= 0; i--) {
        let mine = mines[i];
        
        // Check if mine is armed
        if (!mine.isArmed) {
            mine.armTime -= deltaTime;
            if (mine.armTime <= 0) {
                mine.isArmed = true;
            }
        }
        
        // Draw mine
        ctx.beginPath();
        ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
        ctx.fillStyle = mine.isArmed ? "rgba(255, 0, 0, 0.7)" : "rgba(100, 100, 100, 0.7)";
        ctx.fill();
        
        // Add spikes if armed
        if (mine.isArmed) {
            for (let j = 0; j < 8; j++) {
                const angle = (j / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(mine.x + Math.cos(angle) * mine.radius,
                          mine.y + Math.sin(angle) * mine.radius);
                ctx.lineTo(mine.x + Math.cos(angle) * (mine.radius + 4),
                          mine.y + Math.sin(angle) * (mine.radius + 4));
                ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        
        // Check mine collision with tanks
        for (let tank of tanks) {
            if (tank.respawning) continue;
            if (!mine.isArmed) continue; // Only armed mines explode
            
            // Skip if mine belongs to this tank
            if (mine.owner === tank.playerNumber) continue;
            
            const dx = tank.x + tank.width/2 - mine.x;
            const dy = tank.y + tank.height/2 - mine.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mine.radius + tank.width/2) {
                // Mine exploded!
                if (tank.hit()) {
                    // Tank was destroyed
                    gameState.over = true;
                    showGameOverScreen(tank.playerNumber === 1 ? 2 : 1);
                }
                
                // Remove mine
                mines.splice(i, 1);
                
                // Play explosion sound
                playSound(explosionSound);
                
                break;
            }
        }
    }
    
    // Check for tank collisions with bullets
    checkBulletCollisions();
    
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

// UI functions
function showStartScreen() {
    startScreen.classList.remove('hidden');
    settingsMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    countdownScreen.classList.add('hidden');
    
    // Ensure the game is initialized
    initGame();
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
    
    gameState.countdown = true;
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
            console.log('Countdown finished, starting game');
            startGame();
        }
    }, 1000);
}

function startGame() {
    // Make sure old game loop is not running
    if (gameState.active) {
        console.log("Cancelling previous game loop");
        gameState.active = false;
        // Let the current frame finish before starting new game
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
}

document.addEventListener('DOMContentLoaded', () => {
    // Setup button listeners
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
    if (['w', 's', 'a', 'd', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '/'].includes(e.key)) {
        e.preventDefault();
    }
    
    // Debug key bindings
    if (e.key === 'F8') {
        console.log('Current game state:', { tanks, obstacles, networkReady, onlineMode });
        return;
    }
    
    if (e.key === 'F9' && onlineMode && networkManager) {
        networkManager.requestGameState();
        if (window.networkUI) {
            window.networkUI.showToast('Requesting game state sync from server');
        }
        return;
    }
    
    // Control tanks - make sure localPlayerNumber is valid
    if (!gameState.active || gameState.over) return;
    
    const myTankIndex = (onlineMode && localPlayerNumber > 0) ? localPlayerNumber - 1 : -1;
    let inputApplied = false;
    
    // In online mode, only control your own tank
    if (onlineMode) {
        if (myTankIndex >= 0 && myTankIndex < tanks.length) {
            const tank = tanks[myTankIndex];
            if (tank && tank.controls) {
                // Apply key press to tank
                if (e.key === tank.controls.forward) {
                    tank.moving.forward = true;
                    inputApplied = true;
                }
                if (e.key === tank.controls.backward) {
                    tank.moving.backward = true;
                    inputApplied = true;
                }
                if (e.key === tank.controls.left) {
                    tank.moving.left = true;
                    inputApplied = true;
                }
                if (e.key === tank.controls.right) {
                    tank.moving.right = true;
                    inputApplied = true;
                }
                if (e.key === tank.controls.shoot) {
                    tank.shooting = true;
                    inputApplied = true;
                }
            }
        }
    } 
    // In offline mode, control all tanks with controls
    else {
        for (let tank of tanks) {
            if (!tank.controls) continue;
            
            if (e.key === tank.controls.forward) {
                tank.moving.forward = true;
                inputApplied = true;
            }
            if (e.key === tank.controls.backward) {
                tank.moving.backward = true;
                inputApplied = true;
            }
            if (e.key === tank.controls.left) {
                tank.moving.left = true;
                inputApplied = true;
            }
            if (e.key === tank.controls.right) {
                tank.moving.right = true;
                inputApplied = true;
            }
            if (e.key === tank.controls.shoot) {
                tank.shooting = true;
                inputApplied = true;
            }
        }
    }
    
    // Only send input to server if we actually processed a game input
    if (onlineMode && networkReady && inputApplied && myTankIndex >= 0) {
        const tank = tanks[myTankIndex];
        
        if (tank) {
            // Queue this input to be sent
            inputBuffer.push({
                type: 'keydown',
                key: e.key,
                time: Date.now(),
                tank: {
                    moving: { ...tank.moving },
                    shooting: tank.shooting,
                    position: { x: tank.x, y: tank.y },
                    angle: tank.angle
                }
            });
        }
    }
}

// Similarly update handleKeyUp
function handleKeyUp(e) {
    if (!gameState.active || gameState.over) return;
    
    const myTankIndex = (onlineMode && localPlayerNumber > 0) ? localPlayerNumber - 1 : -1;
    let inputApplied = false;
    
    // In online mode, only control your own tank
    if (onlineMode) {
        if (myTankIndex >= 0 && myTankIndex < tanks.length) {
            const tank = tanks[myTankIndex];
            if (tank && tank.controls) {
                if (e.key === tank.controls.forward) {
                    tank.moving.forward = false;
                    inputApplied = true;
                }
                if (e.key === tank.controls.backward) {
                    tank.moving.backward = false;
                    inputApplied = true;
                }
                if (e.key === tank.controls.left) {
                    tank.moving.left = false;
                    inputApplied = true;
                }
                if (e.key === tank.controls.right) {
                    tank.moving.right = false;
                    inputApplied = true;
                }
                if (e.key === tank.controls.shoot) {
                    tank.shooting = false;
                    inputApplied = true;
                }
            }
        }
    } 
    // In offline mode, control all tanks with controls
    else {
        for (let tank of tanks) {
            if (!tank.controls) continue;
            
            if (e.key === tank.controls.forward) tank.moving.forward = false;
            if (e.key === tank.controls.backward) tank.moving.backward = false;
            if (e.key === tank.controls.left) tank.moving.left = false;
            if (e.key === tank.controls.right) tank.moving.right = false;
            if (e.key === tank.controls.shoot) tank.shooting = false;
        }
    }
    
    // Only send input to server if we actually processed a game input
    if (onlineMode && networkReady && inputApplied && myTankIndex >= 0) {
        const tank = tanks[myTankIndex];
        
        if (tank) {
            // Queue this input to be sent
            inputBuffer.push({
                type: 'keyup',
                key: e.key,
                time: Date.now(),
                tank: {
                    moving: { ...tank.moving },
                    shooting: tank.shooting,
                    position: { x: tank.x, y: tank.y },
                    angle: tank.angle
                }
            });
        }
    }
}

// Update the network handler function to properly handle server positions
function setupNetworkHandlers() {
    if (!networkManager) return;
    
    // Listen for position confirmation from server
    networkManager.on('onPositionConfirmation', (data) => {
        if (!data || !data.position) return;
        
        // Apply position correction from server to our own tank
        const myTankIndex = localPlayerNumber - 1;
        if (myTankIndex >= 0 && myTankIndex < tanks.length) {
            const myTank = tanks[myTankIndex];
            
            // Only apply if the correction is significant
            const dx = data.position.x - myTank.x;
            const dy = data.position.y - myTank.y;
            const distSq = dx*dx + dy*dy;
            
            // If position is very different, immediately correct
            if (distSq > 25) {
                console.log('Server position correction applied');
                myTank.x = data.position.x;
                myTank.y = data.position.y;
            } else {
                // Otherwise, smoothly interpolate
                myTank.targetX = data.position.x;
                myTank.targetY = data.position.y;
            }
            
            if (Math.abs(data.position.angle - myTank.angle) > 0.1) {
                myTank.targetAngle = data.position.angle;
            }
        }
    });
    
    // Handle opponent input with improved position handling
    networkManager.on('onOpponentInput', (data) => {
        if (!data || !data.input) return;
        
        const opponentTankIndex = data.playerNumber === 1 ? 0 : 1;
        const myTankIndex = localPlayerNumber - 1;
        const tank = tanks[opponentTankIndex];
        
        // Don't apply inputs to my own tank
        if (opponentTankIndex === myTankIndex) return;
        
        // Get opponent's tank
        if (!tank) return;
        
        // Apply movement controls
        if (data.input.moving !== undefined) {
            tank.moving = data.input.moving;
        }
        
        // Apply shooting state
        if (data.input.shooting !== undefined) {
            tank.shooting = data.input.shooting;
        }
        
        // Always use server position for opponent
        if (data.input.serverPosition) {
            // If position changed significantly or if position is very different, apply it
            const dx = data.input.serverPosition.x - tank.x;
            const dy = data.input.serverPosition.y - tank.y;
            const distSq = dx*dx + dy*dy;
            
            if (data.input.positionChanged || distSq > 100) {
                // Use immediate position update for large changes
                tank.x = data.input.serverPosition.x;
                tank.y = data.input.serverPosition.y;
                tank.angle = data.input.serverPosition.angle;
                
                // Update target positions too
                tank.targetX = data.input.serverPosition.x;
                tank.targetY = data.input.serverPosition.y;
                tank.targetAngle = data.input.serverPosition.angle;
            } else {
                // Use smooth interpolation for small changes
                tank.targetX = data.input.serverPosition.x;
                tank.targetY = data.input.serverPosition.y;
                tank.targetAngle = data.input.serverPosition.angle;
            }
        }
    });
    
    // Handle powerup spawning from server
    networkManager.on('onPowerUpSpawn', (data) => {
        if (!data || !data.powerUp) return;
        
        console.log('Server spawned powerup:', data.powerUp);
        
        // Create the powerup in game
        const powerUp = new PowerUp(
            data.powerUp.x, 
            data.powerUp.y, 
            data.powerUp.type
        );
        powerUps.push(powerUp);
    });
    
    // Handle powerup collection
    networkManager.on('onPowerUpCollected', (data) => {
        if (!data || data.powerUpIndex === undefined) return;
        
        // Remove the powerup if it exists
        if (data.powerUpIndex >= 0 && data.powerUpIndex < powerUps.length) {
            // Find the tank that collected it
            const tank = tanks.find(t => t.playerNumber === data.playerNumber);
            if (tank) {
                // Apply the powerup effect
                const powerUp = powerUps[data.powerUpIndex];
                if (powerUp) {
                    powerUp.applyPowerUp(tank);
                }
            }
            
            // Remove the powerup
            powerUps.splice(data.powerUpIndex, 1);
        }
    });
}

// Modify the network class to handle these new message types
// (Only if they don't already exist)
if (typeof networkManager !== 'undefined') {
    // Add handler for powerup collection message
    networkManager.handleMessage = function(data) {
        // Existing code...
        
        try {
            const message = JSON.parse(data);
            
            switch(message.type) {
                // Existing cases...
                
                case 'position_confirmation':
                    this._triggerCallbacks('onPositionConfirmation', {
                        position: message.position,
                        timestamp: message.timestamp
                    });
                    break;
                    
                case 'powerup_collected':
                    this._triggerCallbacks('onPowerUpCollected', {
                        playerNumber: message.playerNumber,
                        powerUpIndex: message.powerUpIndex,
                        powerUpType: message.powerUpType
                    });
                    break;
                
                // Other cases...
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };
}