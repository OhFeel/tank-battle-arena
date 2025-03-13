const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Server configuration
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_GAME = 2;
const TICK_RATE = 60; // Server updates per second
const TICK_INTERVAL = 1000 / TICK_RATE;

// Game constants (should match client constants)
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 40;
const GRID_COLS = Math.floor(CANVAS_WIDTH / TILE_SIZE);
const GRID_ROWS = Math.floor(CANVAS_HEIGHT / TILE_SIZE);

// Store active games and waiting players
const games = new Map();
const waitingPlayers = [];
const connectedClients = new Map();

// Game state class to manage each game instance
class GameState {
    constructor(gameId, players) {
        this.gameId = gameId;
        this.players = players;
        this.tanks = [];
        this.bullets = [];
        this.obstacles = [];
        this.powerUps = [];
        this.mines = [];
        this.active = true;
        this.lastUpdateTime = Date.now();
        this.powerUpSpawnTimer = 0;
        this.mapSeed = Math.floor(Math.random() * 1000000);
        
        // Initialize tanks for both players
        this.initializeGame();
    }
    
    initializeGame() {
        // Create obstacles based on the map seed
        this.generateMap();
        
        // Set up tanks at valid spawn points
        const spawnPoints = this.getSpawnPoints();
        
        this.tanks = [
            {
                id: this.players[0].id,
                x: spawnPoints[0].x,
                y: spawnPoints[0].y,
                width: 30,
                height: 30,
                angle: 0,
                speed: 0,
                color: "#3498db", // Blue
                lives: 3,
                ammo: 5,
                moving: { forward: false, backward: false, left: false, right: false },
                shooting: false,
                layingMine: false,
                powerUps: {
                    shield: false,
                    ricochet: 0,
                    piercing: 0,
                    speedBoost: false,
                    rapidFire: false,
                    mines: 0,
                    spreadShot: 0,
                    magneticShield: false,
                    invisibility: false,
                    megaBullet: false,
                    homingMissile: 0
                }
            },
            {
                id: this.players[1].id,
                x: spawnPoints[1].x,
                y: spawnPoints[1].y,
                width: 30,
                height: 30,
                angle: Math.PI,
                speed: 0,
                color: "#e74c3c", // Red
                lives: 3,
                ammo: 5,
                moving: { forward: false, backward: false, left: false, right: false },
                shooting: false,
                layingMine: false,
                powerUps: {
                    shield: false,
                    ricochet: 0,
                    piercing: 0,
                    speedBoost: false,
                    rapidFire: false,
                    mines: 0,
                    spreadShot: 0,
                    magneticShield: false,
                    invisibility: false,
                    megaBullet: false,
                    homingMissile: 0
                }
            }
        ];
        
        // Send initial game state to both players
        this.players.forEach((player, index) => {
            const initialState = {
                type: 'game_start',
                gameId: this.gameId,
                playerIndex: index,
                tanks: this.tanks,
                obstacles: this.obstacles,
                mapSeed: this.mapSeed,
                timestamp: Date.now()
            };
            
            player.send(JSON.stringify(initialState));
        });
    }
    
    generateMap() {
        // Seed the random number generator for consistent generation
        const seedrandom = require('seedrandom');
        const rng = seedrandom(this.mapSeed.toString());
        
        // Create border walls
        this.obstacles = [
            { x: 0, y: 0, width: TILE_SIZE, height: CANVAS_HEIGHT, destructible: false }, // Left wall
            { x: 0, y: 0, width: CANVAS_WIDTH, height: TILE_SIZE, destructible: false }, // Top wall
            { x: CANVAS_WIDTH - TILE_SIZE, y: 0, width: TILE_SIZE, height: CANVAS_HEIGHT, destructible: false }, // Right wall
            { x: 0, y: CANVAS_HEIGHT - TILE_SIZE, width: CANVAS_WIDTH, height: TILE_SIZE, destructible: false } // Bottom wall
        ];
        
        // Generate random obstacles (15-25 obstacles)
        const numObstacles = 15 + Math.floor(rng() * 10);
        
        for (let i = 0; i < numObstacles; i++) {
            const width = TILE_SIZE * (1 + Math.floor(rng() * 2));
            const height = TILE_SIZE * (1 + Math.floor(rng() * 2));
            const isDestructible = rng() < 0.25; // 25% chance of being destructible
            
            // Find a valid position
            let x, y, validPosition = false;
            
            for (let attempts = 0; attempts < 50 && !validPosition; attempts++) {
                x = TILE_SIZE + Math.floor(rng() * (GRID_COLS - 3)) * TILE_SIZE;
                y = TILE_SIZE + Math.floor(rng() * (GRID_ROWS - 3)) * TILE_SIZE;
                
                validPosition = true;
                
                // Avoid placing obstacles too close to each other
                for (let obstacle of this.obstacles) {
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
                this.obstacles.push({
                    x, y, width, height,
                    destructible: isDestructible,
                    health: isDestructible ? 1 : 999
                });
            }
        }
    }
    
    getSpawnPoints() {
        const minDistance = 300; // Minimum distance between spawn points
        const margin = 60;
        const tankSize = 30;
        const spawnPoints = [];
        
        // Get two spawn points that are far enough apart
        for (let i = 0; i < 2; i++) {
            let validSpot = false;
            let x, y;
            let attempts = 0;
            
            while (!validSpot && attempts < 50) {
                attempts++;
                x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
                y = margin + Math.random() * (CANVAS_HEIGHT - margin * 2);
                
                validSpot = true;
                
                // Check against obstacles
                for (let obstacle of this.obstacles) {
                    if (x < obstacle.x + obstacle.width + tankSize &&
                        x + tankSize > obstacle.x - tankSize &&
                        y < obstacle.y + obstacle.height + tankSize &&
                        y + tankSize > obstacle.y - tankSize) {
                        validSpot = false;
                        break;
                    }
                }
                
                // Check against existing spawn points
                for (let point of spawnPoints) {
                    const dx = x - point.x;
                    const dy = y - point.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < minDistance) {
                        validSpot = false;
                        break;
                    }
                }
                
                if (validSpot) {
                    spawnPoints.push({ x, y });
                }
            }
            
            // If we can't find a valid spot, just use a fallback
            if (!validSpot) {
                if (i === 0) {
                    spawnPoints.push({ x: 100, y: 100 });
                } else {
                    spawnPoints.push({ x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 100 });
                }
            }
        }
        
        return spawnPoints;
    }
    
    update() {
        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        
        if (deltaTime <= 0) return;
        
        // Update power-up spawn timer
        this.powerUpSpawnTimer -= deltaTime;
        if (this.powerUpSpawnTimer <= 0 && this.powerUps.length < 3) {
            this.spawnPowerUp();
            this.powerUpSpawnTimer = 5000 + Math.random() * 10000; // 5-15 seconds
        }
        
        // Process tank movement and shooting based on current inputs
        this.updateTanks(deltaTime);
        
        // Update bullets, collisions, etc.
        this.updateBullets(deltaTime);
        
        // Update mines
        this.updateMines(deltaTime);
        
        // Update power-ups
        this.updatePowerUps(deltaTime);
        
        // Send updated state to clients
        this.sendStateUpdate();
    }
    
    updateTanks(deltaTime) {
        // Update each tank based on its current input state
        for (let tank of this.tanks) {
            if (tank.lives <= 0) continue;
            
            // Calculate movement
            let moveX = 0;
            let moveY = 0;
            
            const currentSpeed = tank.powerUps.speedBoost ? 2 * 1.5 : 2; // Base speed = 2
            
            if (tank.moving.forward) {
                moveX = Math.cos(tank.angle) * currentSpeed;
                moveY = Math.sin(tank.angle) * currentSpeed;
            }
            if (tank.moving.backward) {
                moveX = -Math.cos(tank.angle) * currentSpeed;
                moveY = -Math.sin(tank.angle) * currentSpeed;
            }
            
            // Check collision for X and Y separately to enable wall sliding
            let newX = tank.x + moveX;
            let newY = tank.y;
            
            // Try horizontal movement
            if (!this.checkCollision(newX, newY, tank.width, tank.height, tank.id)) {
                tank.x = newX;
            }
            
            // Try vertical movement
            newX = tank.x;
            newY = tank.y + moveY;
            
            if (!this.checkCollision(newX, newY, tank.width, tank.height, tank.id)) {
                tank.y = newY;
            }
            
            // Handle rotation
            if (tank.moving.left) {
                tank.angle -= 0.05;
            }
            if (tank.moving.right) {
                tank.angle += 0.05;
            }
            
            // Handle shooting
            if (tank.shooting && tank.ammo > 0) {
                // Create a new bullet
                this.createBullet(tank);
                tank.ammo--;
                tank.lastShotTime = Date.now();
            }
            
            // Handle mine laying
            if (tank.layingMine && tank.powerUps.mines > 0) {
                this.layMine(tank);
                tank.powerUps.mines--;
            }
            
            // Normalize angle
            while (tank.angle < 0) tank.angle += Math.PI * 2;
            while (tank.angle >= Math.PI * 2) tank.angle -= Math.PI * 2;
        }
    }
    
    updateBullets(deltaTime) {
        // Update bullet positions and check collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Move the bullet
            bullet.x += Math.cos(bullet.angle) * bullet.speed;
            bullet.y += Math.sin(bullet.angle) * bullet.speed;
            
            // Check if bullet hit a wall
            if (bullet.x < 0 || bullet.x > CANVAS_WIDTH || bullet.y < 0 || bullet.y > CANVAS_HEIGHT) {
                // Handle ricochet or remove
                if (bullet.ricochet && bullet.bounces < bullet.maxBounces) {
                    // Bounce off wall
                    if (bullet.x < 0 || bullet.x > CANVAS_WIDTH) {
                        bullet.angle = Math.PI - bullet.angle;
                    } else {
                        bullet.angle = -bullet.angle;
                    }
                    bullet.bounces++;
                } else {
                    this.bullets.splice(i, 1);
                }
                continue;
            }
            
            // Check collisions with obstacles
            let obstacleHit = false;
            for (let j = 0; j < this.obstacles.length; j++) {
                const obstacle = this.obstacles[j];
                if (this.checkBulletObstacleCollision(bullet, obstacle)) {
                    if (bullet.ricochet && bullet.bounces < bullet.maxBounces) {
                        // Handle bullet bounce
                        // Determine which side was hit
                        const hitLeft = Math.abs(bullet.x - obstacle.x);
                        const hitRight = Math.abs(bullet.x - (obstacle.x + obstacle.width));
                        const hitTop = Math.abs(bullet.y - obstacle.y);
                        const hitBottom = Math.abs(bullet.y - (obstacle.y + obstacle.height));
                        
                        const minHit = Math.min(hitLeft, hitRight, hitTop, hitBottom);
                        
                        if (minHit === hitLeft || minHit === hitRight) {
                            bullet.angle = Math.PI - bullet.angle;
                        } else {
                            bullet.angle = -bullet.angle;
                        }
                        
                        bullet.bounces++;
                    } else if (bullet.piercing && obstacle.destructible) {
                        // Piercing bullets can destroy destructible obstacles
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            this.obstacles.splice(j, 1);
                        }
                    } else {
                        // Normal bullet hit
                        if (obstacle.destructible) {
                            obstacle.health--;
                            if (obstacle.health <= 0) {
                                this.obstacles.splice(j, 1);
                            }
                        }
                        obstacleHit = true;
                    }
                    
                    if (obstacleHit && !bullet.piercing) {
                        this.bullets.splice(i, 1);
                        break;
                    }
                }
            }
            if (obstacleHit) continue;
            
            // Check collisions with tanks
            for (let tank of this.tanks) {
                if (tank.id === bullet.ownerId || tank.lives <= 0) continue;
                
                if (this.checkBulletTankCollision(bullet, tank)) {
                    // Skip if tank has shield
                    if (tank.powerUps.shield) {
                        tank.powerUps.shield = false;
                    } else {
                        // Tank hit!
                        tank.lives--;
                        
                        // Check if tank is destroyed
                        if (tank.lives <= 0) {
                            // Game over
                            this.gameOver(bullet.ownerId);
                        } else {
                            // Respawn tank
                            this.respawnTank(tank);
                        }
                    }
                    
                    // Remove bullet unless piercing
                    if (!bullet.piercing) {
                        this.bullets.splice(i, 1);
                    }
                    
                    // Send hit notification
                    this.sendBulletHitNotification(bullet, tank);
                    break;
                }
            }
            
            // Update bullet lifetime
            bullet.life -= deltaTime;
            if (bullet.life <= 0) {
                this.bullets.splice(i, 1);
            }
        }
    }

    updateMines(deltaTime) {
        // Update mines
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const mine = this.mines[i];
            
            // Update mine timer
            mine.armTime -= deltaTime;
            
            // Check if mine should explode
            if (mine.armTime <= 0) {
                // Explode the mine
                this.explodeMine(mine);
                this.mines.splice(i, 1);
            }
        }
    }
    
    updatePowerUps(deltaTime) {
        // Check if tanks collect power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            
            for (let tank of this.tanks) {
                if (tank.lives <= 0) continue;
                
                if (this.checkRectCollision(
                    powerUp.x, powerUp.y, powerUp.width, powerUp.height,
                    tank.x, tank.y, tank.width, tank.height
                )) {
                    // Apply power-up effect
                    this.applyPowerUp(powerUp, tank);
                    
                    // Remove power-up
                    this.powerUps.splice(i, 1);
                    
                    // Send power-up collection notification
                    this.sendPowerUpCollectedNotification(powerUp, tank);
                    break;
                }
            }
        }
    }
    
    applyPowerUp(powerUp, tank) {
        switch (powerUp.type) {
            case 'shield':
                tank.powerUps.shield = true;
                break;
            case 'ricochet':
                tank.powerUps.ricochet += 3;
                break;
            case 'piercing':
                tank.powerUps.piercing += 3;
                break;
            case 'speedBoost':
                tank.powerUps.speedBoost = true;
                setTimeout(() => {
                    tank.powerUps.speedBoost = false;
                }, 8000);
                break;
            case 'rapidFire':
                tank.powerUps.rapidFire = true;
                setTimeout(() => {
                    tank.powerUps.rapidFire = false;
                }, 5000);
                break;
            case 'mineLayer':
                tank.powerUps.mines += 3;
                break;
            case 'spreadShot':
                tank.powerUps.spreadShot += 3;
                break;
            case 'magneticShield':
                tank.powerUps.magneticShield = true;
                setTimeout(() => {
                    tank.powerUps.magneticShield = false;
                }, 7000);
                break;
            case 'invisibility':
                tank.powerUps.invisibility = true;
                setTimeout(() => {
                    tank.powerUps.invisibility = false;
                }, 5000);
                break;
            case 'megaBullet':
                tank.powerUps.megaBullet = true;
                break;
            case 'homingMissile':
                tank.powerUps.homingMissile += 2;
                break;
        }
    }
    
    spawnPowerUp() {
        if (this.powerUps.length >= 3) return;
        
        // Find a valid position for the power-up
        const powerUpSize = 30;
        const margin = 60;
        let x, y, validSpot = false;
        
        for (let attempts = 0; attempts < 50 && !validSpot; attempts++) {
            x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
            y = margin + Math.random() * (CANVAS_HEIGHT - margin * 2);
            
            validSpot = true;
            
            // Check against obstacles
            for (let obstacle of this.obstacles) {
                if (x < obstacle.x + obstacle.width + powerUpSize &&
                    x + powerUpSize > obstacle.x - powerUpSize &&
                    y < obstacle.y + obstacle.height + powerUpSize &&
                    y + powerUpSize > obstacle.y - powerUpSize) {
                    validSpot = false;
                    break;
                }
            }
            
            // Check against tanks
            for (let tank of this.tanks) {
                if (tank.lives <= 0) continue;
                
                if (x < tank.x + tank.width + powerUpSize &&
                    x + powerUpSize > tank.x - powerUpSize &&
                    y < tank.y + tank.height + powerUpSize &&
                    y + powerUpSize > tank.y - powerUpSize) {
                    validSpot = false;
                    break;
                }
            }
            
            // Check against other power-ups
            for (let powerUp of this.powerUps) {
                if (x < powerUp.x + powerUp.width + powerUpSize &&
                    x + powerUpSize > powerUp.x - powerUpSize &&
                    y < powerUp.y + powerUp.height + powerUpSize &&
                    y + powerUpSize > powerUp.y - powerUpSize) {
                    validSpot = false;
                    break;
                }
            }
        }
        
        if (validSpot) {
            // Choose a random power-up type
            const types = [
                'shield', 'ricochet', 'piercing', 'speedBoost', 
                'rapidFire', 'mineLayer', 'spreadShot', 
                'magneticShield', 'invisibility', 'megaBullet', 'homingMissile'
            ];
            
            const type = types[Math.floor(Math.random() * types.length)];
            
            // Create the power-up
            const powerUp = {
                id: uuidv4(),
                x,
                y,
                width: powerUpSize,
                height: powerUpSize,
                type
            };
            
            this.powerUps.push(powerUp);
            
            // Send power-up spawn notification
            this.sendPowerUpSpawnNotification(powerUp);
        }
    }
    
    createBullet(tank) {
        // Check if tank can shoot
        const now = Date.now();
        const reloadTime = tank.powerUps.rapidFire ? 500 : 1000;
        
        if (tank.lastShotTime && now - tank.lastShotTime < reloadTime) {
            return;
        }
        
        // Handle spreadShot
        if (tank.powerUps.spreadShot > 0) {
            tank.powerUps.spreadShot--;
            
            // Create 3 bullets in a spread pattern
            const spreadAngle = Math.PI / 12; // 15 degrees
            const angles = [tank.angle - spreadAngle, tank.angle, tank.angle + spreadAngle];
            
            for (let angle of angles) {
                this.createSingleBullet(tank, angle);
            }
        } else {
            // Create a single bullet
            this.createSingleBullet(tank, tank.angle);
        }
        
        // Update last shot time
        tank.lastShotTime = now;
    }
    
    createSingleBullet(tank, angle) {
        const bulletSpeed = 7;
        const bulletRadius = tank.powerUps.megaBullet ? 8 : 4;
        
        // Create the bullet
        const bullet = {
            id: uuidv4(),
            x: tank.x + tank.width/2 + Math.cos(angle) * tank.width,
            y: tank.y + tank.height/2 + Math.sin(angle) * tank.height,
            radius: bulletRadius,
            angle: angle,
            speed: tank.powerUps.megaBullet ? 5 : bulletSpeed,
            ownerId: tank.id,
            ricochet: tank.powerUps.ricochet > 0,
            piercing: tank.powerUps.piercing > 0,
            isMega: tank.powerUps.megaBullet,
            isHoming: tank.powerUps.homingMissile > 0,
            bounces: 0,
            maxBounces: 3,
            life: 3000, // 3 seconds max life
            targetId: tank.powerUps.homingMissile > 0 ? this.getOpponentId(tank.id) : null
        };
        
        // Add the bullet to the game
        this.bullets.push(bullet);
        
        // Decrease power-up counters if used
        if (bullet.ricochet) tank.powerUps.ricochet--;
        if (bullet.piercing) tank.powerUps.piercing--;
        if (bullet.isHoming) tank.powerUps.homingMissile--;
        if (bullet.isMega) tank.powerUps.megaBullet = false;
    }
    
    layMine(tank) {
        if (tank.powerUps.mines <= 0) return;
        
        // Don't allow placing mines too frequently
        const now = Date.now();
        if (tank.lastMinePlaced && now - tank.lastMinePlaced < 1000) return;
        tank.lastMinePlaced = now;
        
        // Create a mine behind the tank
        const mineX = tank.x + tank.width/2 - Math.cos(tank.angle) * tank.width;
        const mineY = tank.y + tank.height/2 - Math.sin(tank.angle) * tank.height;
        
        // Check if there's already a mine nearby
        for (let mine of this.mines) {
            const dx = mine.x - mineX;
            const dy = mine.y - mineY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) return; // Too close to another mine
        }
        
        // Create the mine
        const mine = {
            id: uuidv4(),
            x: mineX,
            y: mineY,
            radius: 8,
            owner: tank.id,
            armTime: 5000, // 5 seconds before explosion
            blastRadius: 80,
        };
        
        this.mines.push(mine);
    }
    
    explodeMine(mine) {
        // Check if any tanks are in blast radius
        for (let tank of this.tanks) {
            if (tank.lives <= 0) continue;
            
            const dx = tank.x + tank.width/2 - mine.x;
            const dy = tank.y + tank.height/2 - mine.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mine.blastRadius) {
                // Skip if tank has shield
                if (tank.powerUps.shield) {
                    tank.powerUps.shield = false;
                } else {
                    // Tank hit!
                    tank.lives--;
                    
                    // Check if tank is destroyed
                    if (tank.lives <= 0) {
                        // Game over
                        this.gameOver(mine.owner);
                    } else {
                        // Respawn tank
                        this.respawnTank(tank);
                    }
                }
            }
        }
        
        // Check if any destructible obstacles are in blast radius
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            if (!obstacle.destructible) continue;
            
            const obstacleX = obstacle.x + obstacle.width/2;
            const obstacleY = obstacle.y + obstacle.height/2;
            const dx = obstacleX - mine.x;
            const dy = obstacleY - mine.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mine.blastRadius) {
                obstacle.health--;
                if (obstacle.health <= 0) {
                    this.obstacles.splice(i, 1);
                }
            }
        }
        
        // Send mine explosion notification
        this.sendMineExplosionNotification(mine);
    }
    
    respawnTank(tank) {
        // Find a new spawn point
        const spawnPoint = this.getValidSpawnPoint();
        
        // Update tank position
        tank.x = spawnPoint.x;
        tank.y = spawnPoint.y;
        
        // Add temporary shield
        tank.powerUps.shield = true;
        setTimeout(() => {
            if (this.active) {
                tank.powerUps.shield = false;
            }
        }, 3000);
    }
    
    getValidSpawnPoint() {
        const margin = 60;
        const tankSize = 30;
        
        for (let attempts = 0; attempts < 50; attempts++) {
            const x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
            const y = margin + Math.random() * (CANVAS_HEIGHT - margin * 2);
            
            if (!this.checkCollision(x, y, tankSize, tankSize, null)) {
                return { x, y };
            }
            }
            
            // Fallback to a default position
            return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        }
        
        getOpponentId(playerId) {
            for (let tank of this.tanks) {
                if (tank.id !== playerId) {
                    return tank.id;
                }
            }
            return null;
        }
        
        checkCollision(x, y, width, height, excludeId = null) {
            // Check collision with obstacles
            for (let obstacle of this.obstacles) {
                if (x < obstacle.x + obstacle.width &&
                    x + width > obstacle.x &&
                    y < obstacle.y + obstacle.height &&
                    y + height > obstacle.y) {
                    return true;
                }
            }
            
            // Check collision with other tanks
            for (let tank of this.tanks) {
                if (tank.id === excludeId || tank.lives <= 0) continue;
                
                if (x < tank.x + tank.width &&
                    x + width > tank.x &&
                    y < tank.y + tank.height &&
                    y + height > tank.y) {
                    return true;
                }
            }
            
            return false;
        }
        
        checkBulletObstacleCollision(bullet, obstacle) {
            // Check if bullet collides with obstacle using circle-rectangle collision detection
            const closestX = Math.max(obstacle.x, Math.min(bullet.x, obstacle.x + obstacle.width));
            const closestY = Math.max(obstacle.y, Math.min(bullet.y, obstacle.y + obstacle.height));
            
            const distanceX = bullet.x - closestX;
            const distanceY = bullet.y - closestY;
            
            return (distanceX * distanceX + distanceY * distanceY) < (bullet.radius * bullet.radius);
        }
        
        checkBulletTankCollision(bullet, tank) {
            // Check if bullet collides with tank using circle-rectangle collision detection
            const closestX = Math.max(tank.x, Math.min(bullet.x, tank.x + tank.width));
            const closestY = Math.max(tank.y, Math.min(bullet.y, tank.y + tank.height));
            
            const distanceX = bullet.x - closestX;
            const distanceY = bullet.y - closestY;
            
            return (distanceX * distanceX + distanceY * distanceY) < (bullet.radius * bullet.radius);
        }
        
        checkRectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
            return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
        }
        
        sendStateUpdate() {
            const stateUpdate = {
                type: 'state_update',
                tanks: this.tanks.map(tank => ({
                    id: tank.id,
                    x: tank.x,
                    y: tank.y,
                    angle: tank.angle,
                    lives: tank.lives,
                    powerUps: tank.powerUps
                })),
                bullets: this.bullets,
                powerUps: this.powerUps,
                mines: this.mines,
                timestamp: Date.now()
            };
            
            for (let player of this.players) {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify(stateUpdate));
                }
            }
        }
        
        sendBulletHitNotification(bullet, tank) {
            const hitNotification = {
                type: 'bullet_hit',
                bulletId: bullet.id,
                tankId: tank.id,
                position: { x: bullet.x, y: bullet.y },
                timestamp: Date.now()
            };
            
            for (let player of this.players) {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify(hitNotification));
                }
            }
        }
        
        sendPowerUpSpawnNotification(powerUp) {
            const spawnNotification = {
                type: 'power_up_spawned',
                powerUp: powerUp,
                timestamp: Date.now()
            };
            
            for (let player of this.players) {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify(spawnNotification));
                }
            }
        }
        
        sendPowerUpCollectedNotification(powerUp, tank) {
            const collectNotification = {
                type: 'power_up_collected',
                powerUpId: powerUp.id,
                tankId: tank.id,
                powerUpType: powerUp.type,
                timestamp: Date.now()
            };
            
            for (let player of this.players) {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify(collectNotification));
                }
            }
        }
        
        sendMineExplosionNotification(mine) {
            const explosionNotification = {
                type: 'mine_explosion',
                mineId: mine.id,
                position: { x: mine.x, y: mine.y },
                radius: mine.blastRadius,
                timestamp: Date.now()
            };
            
            for (let player of this.players) {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify(explosionNotification));
                }
            }
        }
        
        gameOver(winnerId) {
            this.active = false;
            
            // Send game over notification
            const gameOverMsg = {
                type: 'game_over',
                winnerId: winnerId,
                timestamp: Date.now()
            };
            
            for (let player of this.players) {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify(gameOverMsg));
                }
            }
            
            // Remove the game from the active games after a delay
            setTimeout(() => {
                games.delete(this.gameId);
                console.log(`Game ${this.gameId} ended and removed from active games`);
            }, 5000); // 5 seconds delay before removing
        }
    }
    
    // Start the WebSocket server
    const server = new WebSocket.Server({ port: PORT });
    
    console.log(`WebSocket server started on port ${PORT}`);
    
    // Handle new connections
    server.on('connection', (socket) => {
        const clientId = uuidv4();
        console.log(`New client connected: ${clientId}`);
        
        // Add to connected clients
        connectedClients.set(clientId, {
            id: clientId,
            socket: socket,
            name: null,
            inGame: false,
            gameId: null
        });
        
        // Send connection confirmation
        socket.send(JSON.stringify({
            type: 'connected',
            id: clientId,
            timestamp: Date.now()
        }));
        
        // Handle messages
        socket.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handleClientMessage(clientId, data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });
        
        // Handle client disconnection
        socket.on('close', () => {
            handleClientDisconnect(clientId);
        });
    });
    
    // Handle client messages
    function handleClientMessage(clientId, message) {
        const client = connectedClients.get(clientId);
        if (!client) return;
        
        switch(message.type) {
            case 'find_game':
                handleFindGame(client, message.name);
                break;
                
            case 'cancel_matchmaking':
                handleCancelMatchmaking(client);
                break;
                
            case 'game_input':
                handleGameInput(client, message);
                break;
                
            case 'ping':
                // Send pong response back
                client.socket.send(JSON.stringify({
                    type: 'pong',
                    timestamp: message.timestamp
                }));
                break;
                
            case 'pong':
                // Client response to ping, can calculate latency here if needed
                break;
                
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
    }
    
    // Handle find game request
    function handleFindGame(client, playerName) {
        if (client.inGame) return;
        
        client.name = playerName || `Player${client.id.substring(0, 4)}`;
        
        // Remove from waiting list if already there
        const waitingIndex = waitingPlayers.findIndex(p => p.id === client.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }
        
        // Add to waiting players list
        waitingPlayers.push(client);
        console.log(`${client.name} is looking for a game. Waiting players: ${waitingPlayers.length}`);
        
        // Match players if we have enough
        if (waitingPlayers.length >= MAX_PLAYERS_PER_GAME) {
            createGame(waitingPlayers.splice(0, MAX_PLAYERS_PER_GAME));
        }
    }
    
    // Handle cancel matchmaking request
    function handleCancelMatchmaking(client) {
        const waitingIndex = waitingPlayers.findIndex(p => p.id === client.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
            console.log(`${client.name} canceled matchmaking. Waiting players: ${waitingPlayers.length}`);
        }
    }
    
    // Handle game input
    function handleGameInput(client, message) {
        if (!client.inGame || !client.gameId) return;
        
        const game = games.get(client.gameId);
        if (!game) return;
        
        // Find the player's tank
        const tank = game.tanks.find(t => t.id === client.id);
        if (!tank) return;
        
        // Update tank input based on message
        if (message.input) {
            if ('forward' in message.input) tank.moving.forward = message.input.forward;
            if ('backward' in message.input) tank.moving.backward = message.input.backward;
            if ('left' in message.input) tank.moving.left = message.input.left;
            if ('right' in message.input) tank.moving.right = message.input.right;
            if ('shooting' in message.input) tank.shooting = message.input.shooting;
            if ('layingMine' in message.input) tank.layingMine = message.input.layingMine;
        }
        
        // Notify other player about the input
        const otherPlayer = game.players.find(p => p !== client.socket);
        if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify({
                type: 'opponent_input',
                playerNumber: message.playerNumber,
                input: message.input,
                timestamp: Date.now()
            }));
        }
    }
    
    // Handle client disconnection
    function handleClientDisconnect(clientId) {
        const client = connectedClients.get(clientId);
        if (!client) return;
        
        console.log(`Client disconnected: ${clientId}`);
        
        // Remove from waiting players if in matchmaking
        const waitingIndex = waitingPlayers.findIndex(p => p.id === clientId);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }
        
        // Handle if the client was in a game
        if (client.inGame && client.gameId) {
            const game = games.get(client.gameId);
            if (game) {
                // Notify other player
                const otherPlayer = game.players.find(p => p !== client.socket);
                if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                    otherPlayer.send(JSON.stringify({
                        type: 'opponent_disconnected',
                        timestamp: Date.now()
                    }));
                }
                
                // End the game
                games.delete(client.gameId);
                console.log(`Game ${client.gameId} ended due to player disconnection`);
            }
        }
        
        // Remove from connected clients
        connectedClients.delete(clientId);
    }
    
    // Create a new game
    function createGame(players) {
        const gameId = uuidv4();
        console.log(`Creating game ${gameId} with players: ${players.map(p => p.name).join(', ')}`);
        
        // Update client states
        players.forEach((client) => {
            client.inGame = true;
            client.gameId = gameId;
        });
        
        // Get socket references for each player
        const playerSockets = players.map(client => client.socket);
        
        // Create game state
        const game = new GameState(gameId, playerSockets);
        games.set(gameId, game);
        
        // Generate the map and obstacles
        const mapData = {
            seed: game.mapSeed,
            obstacles: game.obstacles,
            tanks: game.tanks.map(tank => ({
                id: tank.id,
                x: tank.x,
                y: tank.y,
                playerNumber: players.findIndex(p => p.id === tank.id) + 1,
                color: tank.color
            })),
            powerUps: game.powerUps
        };
        
        // Send game found notification to players first
        players.forEach((client, index) => {
            const opponent = players[(index + 1) % players.length];
            client.socket.send(JSON.stringify({
                type: 'game_found',
                gameId: gameId,
                playerNumber: index + 1,
                opponent: opponent.name,
                mapSeed: game.mapSeed,
                timestamp: Date.now()
            }));
            
            // Then send complete map data
            setTimeout(() => {
                client.socket.send(JSON.stringify({
                    type: 'game_start',
                    mapData: mapData,
                    timestamp: Date.now()
                }));
            }, 1000);
        });
        
        // Start game update loop
        startGameLoop(gameId);
    }
    
    // Start game update loop
    function startGameLoop(gameId) {
        const gameLoopInterval = setInterval(() => {
            const game = games.get(gameId);
            if (!game || !game.active) {
                clearInterval(gameLoopInterval);
                return;
            }
            
            game.update();
        }, TICK_INTERVAL);
    }
    
    // Server health check and ping
    setInterval(() => {
        connectedClients.forEach((client) => {
            if (client.socket.readyState === WebSocket.OPEN) {
                try {
                    client.socket.send(JSON.stringify({
                        type: 'ping',
                        timestamp: Date.now()
                    }));
                } catch (error) {
                    console.error(`Error sending ping to ${client.id}:`, error);
                }
            }
        });
    }, 30000); // Every 30 seconds
    
    // Log server status periodically
    setInterval(() => {
        console.log(`Server status: ${connectedClients.size} clients, ${waitingPlayers.length} waiting, ${games.size} active games`);
    }, 60000); // Every minute
