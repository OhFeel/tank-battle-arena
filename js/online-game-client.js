/**
 * Server-authoritative online game client
 * Handles receiving game state from server and rendering it locally
 */
class OnlineGameClient {
    constructor() {
        this.isActive = false;
        this.playerNumber = null;
        this.opponentName = null;
        this.serverGameState = null;
        this.lastServerUpdate = null;
        this.interpolationBuffer = [];
        this.interpolationDelay = 100; // ms delay for interpolation
        this.inputSequence = 0;
        this.pendingInputs = [];
        this.gameSetup = false;
        this.mapData = null;
        this.powerUpData = [];
        this.latency = 0;
    }
    
    initialize() {
        if (!window.networkManager) {
            console.error('Network manager not available');
            return false;
        }
        
        console.log('Initializing server-authoritative online game client');
        this.setupNetworkHandlers();
        return true;
    }
    
    setupNetworkHandlers() {
        // Setup event handlers for server messages
        window.networkManager.on('onGameFound', this.handleGameFound.bind(this));
        window.networkManager.on('onGameStart', this.handleGameStart.bind(this));
        window.networkManager.on('onStateUpdate', this.handleGameStateUpdate.bind(this));
        window.networkManager.on('onOpponentDisconnected', this.handleOpponentDisconnected.bind(this));
        window.networkManager.on('onMapData', this.handleMapData.bind(this));
        window.networkManager.on('onPowerUpSpawned', this.handlePowerUpSpawned.bind(this));
        window.networkManager.on('onPowerUpCollected', this.handlePowerUpCollected.bind(this));
    }
    
    handleGameFound(data) {
        console.log('Game found, waiting for server data:', data);
        this.playerNumber = data.playerNumber;
        this.opponentName = data.opponentName;
        
        // Hide any menus
        if (window.onlineUI) {
            window.onlineUI.hideImmediately();
        }
        
        // Show waiting for server data message
        this.showWaitingMessage('Receiving game data from server...');
    }
    
    handleGameStart(data) {
        console.log('Game starting with server data:', data);
        
        // Save map data from server
        this.mapData = data.mapData;
        
        // Initialize game using server data
        this.setupServerManagedGame(data);
        
        // Ready to begin
        this.isActive = true;
        
        // Hide waiting message
        this.hideWaitingMessage();
        
        // Show player indicator
        this.showPlayerIndicator();
        
        // Show countdown
        if (window.showCountdown) {
            window.showCountdown();
        } else {
            // Fallback
            this.startGame();
        }
    }
    
    setupServerManagedGame(data) {
        // Clear any existing game objects
        window.tanks = [];
        window.bullets = [];
        window.obstacles = [];
        window.powerUps = [];
        window.mines = [];
        
        // Create obstacles from server data
        this.createObstaclesFromServerData(data.mapData.obstacles);
        
        // Create tanks with positions from server data
        this.createTanksFromServerData(data.mapData.tanks);
        
        // Create any initial powerups
        this.createPowerUpsFromServerData(data.mapData.powerUps);
        
        // Mark setup as complete
        this.gameSetup = true;
    }
    
    createObstaclesFromServerData(obstacleData) {
        window.obstacles = obstacleData.map(data => {
            return new Obstacle(
                data.x,
                data.y,
                data.width,
                data.height,
                data.destructible
            );
        });
    }
    
    createTanksFromServerData(tankData) {
        // Create tanks with proper controls
        tankData.forEach(data => {
            let controls;
            
            // Assign controls based on player number
            if (data.playerNumber === this.playerNumber) {
                // This is my tank
                controls = {
                    forward: 'w',
                    backward: 's',
                    left: 'a',
                    right: 'd',
                    shoot: ' ',
                    mine: 'e'
                };
            } else {
                // This is opponent's tank (won't be controlled by keyboard)
                controls = {};
            }
            
            // Create tank
            const tank = new Tank(
                data.x,
                data.y,
                data.color,
                controls,
                data.playerNumber
            );
            
            // Add to tanks array
            window.tanks.push(tank);
        });
    }
    
    createPowerUpsFromServerData(powerUpData) {
        if (!powerUpData || !powerUpData.length) return;
        
        window.powerUps = powerUpData.map(data => {
            return new PowerUp(data.x, data.y, data.type);
        });
    }
    
    handleGameStateUpdate(data) {
        if (!this.isActive) return;
        
        // Store state update in interpolation buffer
        this.interpolationBuffer.push({
            timestamp: data.timestamp,
            tanks: data.tanks,
            bullets: data.bullets,
            powerUps: data.powerUps,
            mines: data.mines
        });
        
        // Keep buffer size manageable
        while (this.interpolationBuffer.length > 10) {
            this.interpolationBuffer.shift();
        }
    }
    
    update(deltaTime) {
        if (!this.isActive || !this.gameSetup) return;
        
        // Apply interpolation to smooth rendering between server updates
        this.interpolateGameState(deltaTime);
        
        // Process local player input and send to server
        this.processPlayerInput();
    }
    
    interpolateGameState(deltaTime) {
        if (this.interpolationBuffer.length < 2) return;
        
        const now = Date.now();
        const interpolationTime = now - this.interpolationDelay;
        
        // Find the two states to interpolate between
        let older = null;
        let newer = null;
        
        for (let i = 0; i < this.interpolationBuffer.length - 1; i++) {
            if (this.interpolationBuffer[i].timestamp <= interpolationTime &&
                this.interpolationBuffer[i+1].timestamp > interpolationTime) {
                older = this.interpolationBuffer[i];
                newer = this.interpolationBuffer[i+1];
                break;
            }
        }
        
        // If we couldn't find appropriate states, use the most recent ones
        if (!older || !newer) {
            older = this.interpolationBuffer[this.interpolationBuffer.length - 2];
            newer = this.interpolationBuffer[this.interpolationBuffer.length - 1];
        }
        
        // Calculate interpolation ratio (0 to 1)
        const totalTime = newer.timestamp - older.timestamp;
        if (totalTime === 0) return; // Avoid division by zero
        
        const ratio = Math.max(0, Math.min(1, (interpolationTime - older.timestamp) / totalTime));
        
        // Interpolate tank positions and angles
        this.interpolateTanks(older.tanks, newer.tanks, ratio);
        
        // Update bullets (not interpolated)
        this.updateBullets(newer.bullets);
        
        // Update powerups
        this.updatePowerUps(newer.powerUps);
        
        // Update mines
        this.updateMines(newer.mines);
    }
    
    interpolateTanks(olderTanks, newerTanks, ratio) {
        for (let i = 0; i < window.tanks.length; i++) {
            const tank = window.tanks[i];
            
            // Find corresponding server tank data
            const oldTank = olderTanks.find(t => t.playerNumber === tank.playerNumber);
            const newTank = newerTanks.find(t => t.playerNumber === tank.playerNumber);
            
            if (!oldTank || !newTank) continue;
            
            // For opponent tank, interpolate position and angle
            if (tank.playerNumber !== this.playerNumber) {
                // Interpolate position
                tank.x = oldTank.x + (newTank.x - oldTank.x) * ratio;
                tank.y = oldTank.y + (newTank.y - oldTank.y) * ratio;
                
                // Interpolate angle (handle wrapping)
                let angleDiff = newTank.angle - oldTank.angle;
                if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                tank.angle = oldTank.angle + angleDiff * ratio;
                
                // Update movement state
                tank.moving = newTank.moving;
                tank.shooting = newTank.shooting;
            }
            
            // For all tanks, update game state properties
            tank.lives = newTank.lives;
            tank.ammo = newTank.ammo;
            tank.shield = newTank.powerUps.shield;
            tank.ricochetBullets = newTank.powerUps.ricochet;
            tank.piercingBullets = newTank.powerUps.piercing;
            tank.speedBoost = newTank.powerUps.speedBoost;
            tank.rapidFire = newTank.powerUps.rapidFire;
            tank.mines = newTank.powerUps.mines;
            tank.spreadShot = newTank.powerUps.spreadShot;
            tank.magneticShield = newTank.powerUps.magneticShield;
            tank.invisibility = newTank.powerUps.invisibility;
            tank.megaBullet = newTank.powerUps.megaBullet;
            tank.homingMissileBullets = newTank.powerUps.homingMissile;
        }
    }
    
    updateBullets(serverBullets) {
        // Remove bullets that don't exist on the server
        window.bullets = window.bullets.filter(bullet => 
            serverBullets.some(sb => sb.id === bullet.id)
        );
        
        // Add new bullets from server
        for (const serverBullet of serverBullets) {
            const existingBullet = window.bullets.find(b => b.id === serverBullet.id);
            
            if (!existingBullet) {
                // Create new bullet based on server data
                let bullet;
                if (serverBullet.isHoming) {
                    const targetTank = window.tanks.find(tank => tank.playerNumber !== serverBullet.owner);
                    bullet = new HomingMissile(
                        serverBullet.x, serverBullet.y, serverBullet.angle,
                        serverBullet.owner, targetTank, 
                        serverBullet.ricochet, serverBullet.piercing, serverBullet.isMega
                    );
                } else {
                    bullet = new Bullet(
                        serverBullet.x, serverBullet.y, serverBullet.angle,
                        serverBullet.owner, serverBullet.ricochet,
                        serverBullet.piercing, serverBullet.isMega
                    );
                }
                
                // Set ID and add to bullets array
                bullet.id = serverBullet.id;
                window.bullets.push(bullet);
            } else {
                // Update existing bullet
                existingBullet.x = serverBullet.x;
                existingBullet.y = serverBullet.y;
                existingBullet.angle = serverBullet.angle;
            }
        }
    }
    
    updatePowerUps(serverPowerUps) {
        // Remove powerups that don't exist on server
        window.powerUps = window.powerUps.filter(powerUp =>
            serverPowerUps.some(sp => sp.id === powerUp.id)
        );
        
        // Add new powerups from server
        for (const serverPowerUp of serverPowerUps) {
            if (!window.powerUps.some(p => p.id === serverPowerUp.id)) {
                const powerUp = new PowerUp(
                    serverPowerUp.x, serverPowerUp.y, serverPowerUp.type
                );
                powerUp.id = serverPowerUp.id;
                window.powerUps.push(powerUp);
            }
        }
    }
    
    updateMines(serverMines) {
        if (!serverMines) return;
        
        // Remove mines that don't exist on server
        window.mines = window.mines.filter(mine =>
            serverMines.some(sm => sm.id === mine.id)
        );
        
        // Add new mines from server
        for (const serverMine of serverMines) {
            if (!window.mines.some(m => m.id === serverMine.id)) {
                const mine = {
                    id: serverMine.id,
                    x: serverMine.x,
                    y: serverMine.y,
                    radius: serverMine.radius || 8,
                    owner: serverMine.owner,
                    armTime: serverMine.armTime,
                    blastRadius: serverMine.blastRadius || 80,
                    blinkRate: 500,
                    blinkState: false
                };
                window.mines.push(mine);
            } else {
                // Update existing mine
                const mine = window.mines.find(m => m.id === serverMine.id);
                mine.armTime = serverMine.armTime;
                // Don't update position - mines are stationary
            }
        }
    }
    
    processPlayerInput() {
        // Get local player's tank
        const myTank = window.tanks.find(tank => tank.playerNumber === this.playerNumber);
        if (!myTank) return;
        
        // Create input object
        const input = {
            sequence: ++this.inputSequence,
            forward: myTank.moving.forward,
            backward: myTank.moving.backward,
            left: myTank.moving.left,
            right: myTank.moving.right,
            shooting: myTank.shooting,
            layingMine: myTank.layingMine,
            timestamp: Date.now()
        };
        
        // Store input for client-side prediction
        this.pendingInputs.push(input);
        
        // Send to server
        window.networkManager.sendGameInput(input);
    }
    
    handleMapData(data) {
        // Store map data received from server
        this.mapData = data;
    }
    
    handlePowerUpSpawned(data) {
        // Add new powerup
        if (!this.isActive) return;
        
        const powerUp = new PowerUp(data.x, data.y, data.type);
        powerUp.id = data.id;
        window.powerUps.push(powerUp);
    }
    
    handlePowerUpCollected(data) {
        // Remove collected powerup
        if (!this.isActive) return;
        
        window.powerUps = window.powerUps.filter(p => p.id !== data.id);
    }
    
    handleOpponentDisconnected() {
        console.log('Opponent disconnected');
        
        // Show message
        this.showMessage('Your opponent disconnected. Returning to main menu...');
        
        // End game after a delay
        setTimeout(() => {
            this.endGame();
            window.showStartScreen();
        }, 2000);
    }
    
    showWaitingMessage(message) {
        // Show loading message
        const waitingDiv = document.createElement('div');
        waitingDiv.id = 'waiting-for-server';
        waitingDiv.style.position = 'absolute';
        waitingDiv.style.top = '50%';
        waitingDiv.style.left = '50%';
        waitingDiv.style.transform = 'translate(-50%, -50%)';
        waitingDiv.style.background = 'rgba(0,0,0,0.7)';
        waitingDiv.style.color = 'white';
        waitingDiv.style.padding = '20px';
        waitingDiv.style.borderRadius = '5px';
        waitingDiv.style.zIndex = '1000';
        waitingDiv.innerHTML = `
            <div style="text-align:center;">
                <div class="spinner" style="margin:0 auto 15px;width:30px;height:30px;border:3px solid rgba(255,255,255,.3);border-radius:50%;border-top-color:white;animation:spin 1s ease-in-out infinite;"></div>
                <div>${message || 'Waiting for server...'}</div>
            </div>
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(waitingDiv);
    }
    
    hideWaitingMessage() {
        const waitingDiv = document.getElementById('waiting-for-server');
        if (waitingDiv) {
            waitingDiv.remove();
        }
    }
    
    showMessage(message, duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'game-message';
        messageDiv.innerText = message;
        messageDiv.style.position = 'absolute';
        messageDiv.style.top = '20%';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.background = 'rgba(0,0,0,0.7)';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '10px 20px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.zIndex = '1000';
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, duration);
    }
    
    showPlayerIndicator() {
        const playerIndicator = document.createElement('div');
        playerIndicator.id = 'playerIndicator';
        playerIndicator.className = 'player-indicator';
        
        const tankColor = this.playerNumber === 1 ? 'Blue' : 'Red';
        const colorStyle = this.playerNumber === 1 ? '#3498db' : '#e74c3c';
        
        playerIndicator.innerHTML = `<span>You are controlling the <span id="playerColor" style="color:${colorStyle}">${tankColor}</span> tank</span>`;
        document.querySelector('.game-container').appendChild(playerIndicator);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (playerIndicator.parentNode) {
                playerIndicator.parentNode.removeChild(playerIndicator);
            }
        }, 5000);
    }
    
    startGame() {
        gameState.active = true;
        gameState.over = false;
    }
    
    endGame() {
        this.isActive = false;
        this.gameSetup = false;
        window.tanks = [];
        window.bullets = [];
        window.obstacles = [];
        window.powerUps = [];
        window.mines = [];
    }
}

// Create global instance
window.onlineGameClient = new OnlineGameClient();
