// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

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

// Game constants
const TILE_SIZE = 40;
const GRID_COLS = 20;
const GRID_ROWS = 15;
const POWER_UP_TYPES = {
    SHIELD: 'shield',
    RICOCHET: 'ricochet',
    PIERCING: 'piercing'
};

// Add near the beginning of the file, after existing state variables
let onlineMode = false;
let networkReady = false;
let localPlayerNumber = 0;
let inputBuffer = [];
let lastSyncTime = 0;
const SYNC_INTERVAL = 100; // Sync every 100ms

// Tank class
class Tank {
    constructor(x, y, color, controls, playerNumber) {
        this.x = x;
        this.y = y;
        this.width = 30; // Smaller tanks (previously 40)
        this.height = 30; // Smaller tanks (previously 40)
        this.color = color;
        this.angle = 0;
        this.speed = 1.5; // Reduced from 2 for slower movement
        this.turnSpeed = 0.03; // Reduced from 0.04 for smoother turning
        this.controls = controls;
        this.moving = { forward: false, backward: false, left: false, right: false };
        this.shooting = false;
        this.lives = 3;
        this.ammo = 5;
        this.maxAmmo = 5;
        this.reloadTime = 1000; // 1 second reload time
        this.canShoot = true;
        this.shield = false;
        this.ricochet = false;
        this.piercing = false;
        this.shieldTimer = 0;
        this.ricochetTimer = 0;
        this.piercingTimer = 0;
        this.respawning = false;
        this.respawnTimer = 0;
        this.playerNumber = playerNumber;
        this.trackMarks = [];
        this.lastTrackTime = 0;
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

        // Movement
        let moveX = 0;
        let moveY = 0;

        if (this.moving.forward) {
            moveX = Math.cos(this.angle) * this.speed;
            moveY = Math.sin(this.angle) * this.speed;
        }
        if (this.moving.backward) {
            moveX = -Math.cos(this.angle) * this.speed * 0.5;
            moveY = -Math.sin(this.angle) * this.speed * 0.5;
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

        // Check collision before moving
        let newX = this.x + moveX;
        let newY = this.y + moveY;

        if (!this.checkCollision(newX, newY)) {
            this.x = newX;
            this.y = newY;
        }

        // Rotation - add deltaTime-based smoothing
        if (this.moving.left) this.angle -= this.turnSpeed * (deltaTime / 8); // normalize by expected frame time
        if (this.moving.right) this.angle += this.turnSpeed * (deltaTime / 8);

        // Boundary check
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

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

        // Update track marks
        for (let i = this.trackMarks.length - 1; i >= 0; i--) {
            this.trackMarks[i].life -= deltaTime;
            if (this.trackMarks[i].life <= 0) {
                this.trackMarks.splice(i, 1);
            }
        }

        // Shooting
        if (this.shooting && this.canShoot && this.ammo > 0) {
            this.shoot();
        }
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

    shoot() {
        if (this.ammo <= 0 || !this.canShoot) return;

        // Create bullet
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

        // Start reload timer
        setTimeout(() => {
            if (this.ammo < this.maxAmmo) {
                this.ammo++;
            }
            this.canShoot = true;
        }, this.reloadTime);
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

        // Draw tank
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        // Draw tank body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Draw tank cannon
        ctx.fillStyle = "#333";
        ctx.fillRect(0, -4, this.width / 2, 8);

        // Draw shield effect if active
        if (this.shield) {
            ctx.strokeStyle = "rgba(255, 255, 0, 0.7)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// Bullet class
class Bullet {
    constructor(x, y, angle, owner, ricochet = false, piercing = false) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.angle = angle;
        this.speed = 7;
        this.owner = owner;
        this.ricochet = ricochet;
        this.piercing = piercing;
        this.bounces = 0;
        this.maxBounces = 3;
        this.life = 3000; // 3 seconds max life
    }

    update(deltaTime) {
        // Update position
        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;

        // Check collision with walls
        if (newX - this.radius < 0 || newX + this.radius > canvas.width) {
            if (this.ricochet && this.bounces < this.maxBounces) {
                this.angle = Math.PI - this.angle;
                this.bounces++;
                playSound(bounceSound);
            } else if (!this.piercing) {
                return true; // Remove bullet
            }
        }

        if (newY - this.radius < 0 || newY + this.radius > canvas.height) {
            if (this.ricochet && this.bounces < this.maxBounces) {
                this.angle = -this.angle;
                this.bounces++;
                playSound(bounceSound);
            } else if (!this.piercing) {
                return true; // Remove bullet
            }
        }

        // Check collision with obstacles
        for (let obstacle of obstacles) {
            if (this.checkCollisionWithRect(newX, newY, obstacle)) {
                if (this.ricochet && this.bounces < this.maxBounces) {
                    // Determine which side was hit
                    if (Math.abs(this.x - obstacle.x) < Math.abs(this.x - (obstacle.x + obstacle.width)) ||
                        Math.abs(this.x - (obstacle.x + obstacle.width)) < Math.abs(this.y - obstacle.y) ||
                        Math.abs(this.x - (obstacle.x + obstacle.width)) < Math.abs(this.y - (obstacle.y + obstacle.height))) {
                        this.angle = Math.PI - this.angle; // Horizontal bounce
                    } else {
                        this.angle = -this.angle; // Vertical bounce
                    }
                    this.bounces++;
                    playSound(bounceSound);
                } else if (!this.piercing) {
                    return true; // Remove bullet
                }
            }
        }

        // Update position after collision checks
        this.x = newX;
        this.y = newY;

        // Check life time
        this.life -= deltaTime;
        if (this.life <= 0) {
            return true; // Remove bullet
        }

        return false; // Keep bullet
    }

    checkCollisionWithRect(x, y, rect) {
        return x - this.radius < rect.x + rect.width &&
               x + this.radius > rect.x &&
               y - this.radius < rect.y + rect.height &&
               y + this.radius > rect.y;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Different colors based on bullet properties
        if (this.piercing) {
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
        ctx.lineTo(
            this.x - Math.cos(this.angle) * 10,
            this.y - Math.sin(this.angle) * 10
        );
        ctx.strokeStyle = "rgba(255, 255, 200, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
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
        for (let tank of tanks) {
            if (!tank.respawning && !this.collected && 
                this.x < tank.x + tank.width &&
                this.x + this.width > tank.x &&
                this.y < tank.y + tank.height &&
                this.y + this.height > tank.y) {
                
                this.applyPowerUp(tank);
                this.collected = true;
                
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
                tank.ricochet = true;
                tank.ricochetTimer = 10000; // 10 seconds
                break;
            case POWER_UP_TYPES.PIERCING:
                tank.piercing = true;
                tank.piercingTimer = 8000; // 8 seconds
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
        
        switch(this.type) {
            case POWER_UP_TYPES.SHIELD:
                // Shield icon
                ctx.beginPath();
                ctx.arc(0, 0, this.width/4, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.RICOCHET:
                // Ricochet icon
                ctx.beginPath();
                ctx.moveTo(-5, -5);
                ctx.lineTo(5, 5);
                ctx.moveTo(-5, 5);
                ctx.lineTo(5, -5);
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case POWER_UP_TYPES.PIERCING:
                // Piercing icon
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(0, 8);
                ctx.strokeStyle = "white";
                ctx.lineWidth = 3;
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
            default: 
                return "rgba(200, 200, 200, 0.8)"; // Default
        }
    }
}

// Utility functions
function getRandomSpawnPoint() {
    const margin = 60;
    let x, y, validSpot = false;
    
    // Try to find a spawn point not too close to obstacles or other tanks
    for (let attempts = 0; attempts < 50 && !validSpot; attempts++) {
        x = margin + Math.random() * (canvas.width - margin * 2);
        y = margin + Math.random() * (canvas.height - margin * 2);
        
        // Check if position is valid
        validSpot = true;
        
        // Check against obstacles
        for (let obstacle of obstacles) {
            if (x < obstacle.x + obstacle.width + 50 &&
                x + 50 > obstacle.x &&
                y < obstacle.y + obstacle.height + 50 &&
                y + 50 > obstacle.y) {
                validSpot = false;
                break;
            }
        }
        
        // Check against other tanks
        for (let tank of tanks) {
            if (x < tank.x + tank.width + 100 &&
                x + 50 > tank.x - 100 &&
                y < tank.y + tank.height + 100 &&
                y + 50 > tank.y - 100) {
                validSpot = false;
                break;
            }
        }
    }
    
    return { x, y };
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

// Add to initGame function to support online mode
function initGame(isOnlineMode = false, playerNum = 0) {
    onlineMode = isOnlineMode;
    localPlayerNumber = playerNum;
    
    // Rest of initGame remains the same
    createObstacles();
    
    // Create tanks
    const p1Spawn = getRandomSpawnPoint();
    const p2Spawn = getRandomSpawnPoint();
    
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
    
    // Reset game state and stats
    bullets = [];
    powerUps = [];
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
    
    // If online mode, modify controls based on player number
    if (onlineMode) {
        if (playerNum === 1) {
            // Player 1 controls the blue tank (tanks[0])
            tanks[1].controls = {}; // Remove controls from opponent's tank
        } else {
            // Player 2 controls the red tank (tanks[1])
            tanks[0].controls = {}; // Remove controls from opponent's tank
        }
    }
}

// Game initialization
function initGame() {
    // Create obstacles
    createObstacles();
    
    // Create tanks
    const p1Spawn = getRandomSpawnPoint();
    const p2Spawn = getRandomSpawnPoint();
    
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
    
    // Reset game state and stats
    bullets = [];
    powerUps = [];
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

// Add to startGame function
function startGame() {
    gameState.active = true;
    gameState.over = false;
    
    // Start background music
    playSound(backgroundMusic);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    
    // If online mode, setup network syncing
    if (onlineMode && networkManager && networkManager.connected) {
        networkReady = true;
        
        // Setup input handler overrides
        setupNetworkInputHandlers();
    }
}

// Add this new function for online mode inputs
function setupNetworkInputHandlers() {
    // Listen for opponent inputs
    networkManager.on('onOpponentInput', (data) => {
        const opponentTankIndex = localPlayerNumber === 1 ? 1 : 0;
        const tank = tanks[opponentTankIndex];
        
        // Apply opponent input
        if (tank && data && data.input) {
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
            if ('position' in input) {
                // Smoothly move toward corrected position
                tank.targetX = input.position.x;
                tank.targetY = input.position.y;
            }
            
            // Handle angle correction
            if ('angle' in input) {
                tank.targetAngle = input.angle;
            }
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

// Game loop
let lastTime = 0;

const originalGameLoop = gameLoop;
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
                position: latestInput.tank.position,
                angle: latestInput.tank.angle
            });
            
            // Clear input buffer after sending
            inputBuffer = [];
            
            // Update last sync time
            lastSyncTime = now;
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

function showCountdown() {
    startScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');
    
    let count = 3;
    countdownText.textContent = count;
    
    gameState.countdown = true;
    
    const countInterval = setInterval(() => {
        count--;
        
        if (count > 0) {
            countdownText.textContent = count;
        } else {
            clearInterval(countInterval);
            countdownScreen.classList.add('hidden');
            gameState.countdown = false;
            startGame();
        }
    }, 1000);
}

function startGame() {
    gameState.active = true;
    gameState.over = false;
    
    // Start background music
    playSound(backgroundMusic);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    
    // If online mode, setup network syncing
    if (onlineMode && networkManager && networkManager.connected) {
        networkReady = true;
        
        // Setup input handler overrides
        setupNetworkInputHandlers();
    }
}

function showGameOverScreen(winningPlayer) {
    gameState.active = false;
    gameOverScreen.classList.remove('hidden');
    
    winnerText.textContent = `Player ${winningPlayer} Wins!`;
    shotsFired.textContent = winningPlayer === 1 ? stats.p1ShotsFired : stats.p2ShotsFired;
    powerupsCollected.textContent = winningPlayer === 1 ? stats.p1PowerupsCollected : stats.p2PowerupsCollected;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Setup button listeners
    startButton.addEventListener('click', showCountdown);
    settingsButton.addEventListener('click', showSettingsMenu);
    backButton.addEventListener('click', showStartScreen);
    restartButton.addEventListener('click', () => {
        initGame();
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

// Modify handleKeyDown for online mode
const originalHandleKeyDown = handleKeyDown;
handleKeyDown = function(e) {
    // Call the original function first
    originalHandleKeyDown(e);
    
    // If online mode, send input to server
    if (onlineMode && networkReady) {
        const tankIndex = localPlayerNumber - 1;
        const tank = tanks[tankIndex];
        
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
};

// Modify handleKeyUp for online mode
const originalHandleKeyUp = handleKeyUp;
handleKeyUp = function(e) {
    // Call the original function first
    originalHandleKeyUp(e);
    
    // If online mode, send input to server
    if (onlineMode && networkReady) {
        const tankIndex = localPlayerNumber - 1;
        const tank = tanks[tankIndex];
        
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
};

function handleKeyDown(e) {
    // Prevent default actions for game keys
    if (['w', 's', 'a', 'd', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '/'].includes(e.key)) {
        e.preventDefault();
    }
    
    // Control tanks
    for (let tank of tanks) {
        if (e.key === tank.controls.forward) tank.moving.forward = true;
        if (e.key === tank.controls.backward) tank.moving.backward = true;
        if (e.key === tank.controls.left) tank.moving.left = true;
        if (e.key === tank.controls.right) tank.moving.right = true;
        if (e.key === tank.controls.shoot) tank.shooting = true;
    }
}

function handleKeyUp(e) {
    for (let tank of tanks) {
        if (e.key === tank.controls.forward) tank.moving.forward = false;
        if (e.key === tank.controls.backward) tank.moving.backward = false;
        if (e.key === tank.controls.left) tank.moving.left = false;
        if (e.key === tank.controls.right) tank.moving.right = false;
        if (e.key === tank.controls.shoot) tank.shooting = false;
    }
}

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

// Initialize game on load
window.addEventListener('load', () => {
    console.log('Tank Battle Arena loaded!');
});