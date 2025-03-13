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
        this.gameSetup = false;
        this.mapData = null;
        this.lastKeyState = {};
        this.wasdControls = true; // Both players will use WASD
    }
    
    initialize() {
        if (!window.networkManager) {
            console.error('Network manager not available');
            return false;
        }
        
        console.log('Initializing server-authoritative online game client');
        this.setupNetworkHandlers();
        this.setupKeyboardHandlers();
        return true;
    }
    
    setupNetworkHandlers() {
        // Setup event handlers for server messages
        window.networkManager.on('onGameFound', this.handleGameFound.bind(this));
        window.networkManager.on('onGameStart', this.handleGameStart.bind(this));
        window.networkManager.on('onGameState', this.handleGameState.bind(this));
        window.networkManager.on('onOpponentDisconnected', this.handleOpponentDisconnected.bind(this));
        window.networkManager.on('onMapData', this.handleMapData.bind(this));
    }
    
    setupKeyboardHandlers() {
        // Setup keyboard event listeners
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    handleKeyDown(e) {
        if (!this.isActive || !gameState.active || gameState.over) return;
        
        // Use WASD controls for both players as that's what the server expects
        const input = {};
        
        // WASD for movement
        if (e.key === 'w') input.forward = true;
        if (e.key === 's') input.backward = true;
        if (e.key === 'a') input.left = true;
        if (e.key === 'd') input.right = true;
        
        // Space for shooting
        if (e.key === ' ') input.shooting = true;
        
        // E for mine laying
        if (e.key === 'e') input.layingMine = true;
        
        // Only update if something changed
        let changed = false;
        for (const key in input) {
            if (this.lastKeyState[key] !== input[key]) {
                changed = true;
                this.lastKeyState[key] = input[key];
            }
        }
        
        if (changed && window.networkManager) {
            window.networkManager.updateInput(this.lastKeyState);
        }
        
        // Prevent default browser actions for game controls
        if (['w', 's', 'a', 'd', ' ', 'e'].includes(e.key)) {
            e.preventDefault();
        }
    }
    
    handleKeyUp(e) {
        if (!this.isActive || !gameState.active || gameState.over) return;
        
        const input = {};
        
        // WASD for movement
        if (e.key === 'w') input.forward = false;
        if (e.key === 's') input.backward = false;
        if (e.key === 'a') input.left = false;
        if (e.key === 'd') input.right = false;
        
        // Space for shooting
        if (e.key === ' ') input.shooting = false;
        
        // E for mine laying
        if (e.key === 'e') input.layingMine = false;
        
        // Only update if something changed
        let changed = false;
        for (const key in input) {
            if (this.lastKeyState[key] !== input[key]) {
                changed = true;
                this.lastKeyState[key] = input[key];
            }
        }
        
        if (changed && window.networkManager) {
            window.networkManager.updateInput(this.lastKeyState);
        }
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
        this.mapData = data.mapData || data;
        
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
    
    handleGameState(state) {
        if (!this.gameSetup || !state) return;
        this.serverGameState = state;
        // Sync local game entities with server state
        this.syncGameState(state);
    }
    
    syncGameState(state) {
        // Update tanks
        if (state.tanks && tanks.length >= 2) {
            for (let i = 0; i < Math.min(state.tanks.length, tanks.length); i++) {
                const localTank = tanks[i];
                const serverTank = state.tanks[i];
                
                // Apply server position
                localTank.x = serverTank.x;
                localTank.y = serverTank.y;
                localTank.angle = serverTank.angle;
                
                // Update tank state
                localTank.lives = serverTank.lives;
                localTank.ammo = serverTank.ammo;
                localTank.moving = serverTank.moving;
                localTank.shooting = serverTank.shooting;
                
                // Update powerups
                localTank.shield = serverTank.shield;
                localTank.ricochetBullets = serverTank.ricochetBullets;
                localTank.piercingBullets = serverTank.piercingBullets;
                localTank.speedBoost = serverTank.speedBoost;
                localTank.rapidFire = serverTank.rapidFire;
                localTank.spreadShot = serverTank.spreadShot;
                localTank.mines = serverTank.mines;
                localTank.megaBullet = serverTank.megaBullet;
                localTank.homingMissileBullets = serverTank.homingMissileBullets;
                localTank.magneticShield = serverTank.magneticShield;
                localTank.invisibility = serverTank.invisibility;
            }
        }
        
        // Sync bullets
        this.syncBullets(state.bullets || []);
        
        // Sync powerups
        this.syncPowerUps(state.powerUps || []);
        
        // Sync mines
        this.syncMines(state.mines || []);
    }
    
    syncBullets(serverBullets) {
        // Remove bullets that no longer exist
        bullets = bullets.filter(bullet => 
            serverBullets.some(sb => sb.id === bullet.id)
        );
        
        // Add or update bullets from server
        for (const serverBullet of serverBullets) {
            const existingBullet = bullets.find(b => b.id === serverBullet.id);
            
            if (!existingBullet) {
                // Create new bullet
                let bullet = this.createBulletFromServer(serverBullet);
                bullets.push(bullet);
            } else {
                // Update existing bullet
                existingBullet.x = serverBullet.x;
                existingBullet.y = serverBullet.y;
                existingBullet.angle = serverBullet.angle;
            }
        }
    }
    
    createBulletFromServer(data) {
        // Create right type of bullet based on server data
        if (data.isHoming) {
            // Find target tank for homing missile
            const targetTank = tanks.find(tank => tank.playerNumber !== data.owner);
            return new HomingMissile(
                data.x, data.y, data.angle, data.owner, 
                targetTank, data.ricochet, data.piercing, data.isMega
            );
        } else {
            return new Bullet(
                data.x, data.y, data.angle, data.owner,
                data.ricochet, data.piercing, data.isMega
            );
        }
    }
    
    syncPowerUps(serverPowerUps) {
        // Remove powerups that no longer exist
        powerUps = powerUps.filter(powerUp =>
            serverPowerUps.some(sp => sp.id === powerUp.id)
        );
        
        // Add new powerups from server
        for (const serverPowerUp of serverPowerUps) {
            if (!powerUps.some(p => p.id === serverPowerUp.id)) {
                const powerUp = new PowerUp(
                    serverPowerUp.x, serverPowerUp.y, serverPowerUp.type
                );
                powerUp.id = serverPowerUp.id;
                powerUps.push(powerUp);
            }
        }
    }
    
    syncMines(serverMines) {
        // Remove mines that no longer exist
        mines = mines.filter(mine =>
            serverMines.some(sm => sm.id === mine.id)
        );
        
        // Add new mines from server
        for (const serverMine of serverMines) {
            if (!mines.some(m => m.id === serverMine.id)) {
                mines.push({
                    id: serverMine.id,
                    x: serverMine.x,
                    y: serverMine.y,
                    radius: serverMine.radius || 8,
                    owner: serverMine.owner,
                    armTime: serverMine.armTime,
                    blastRadius: serverMine.blastRadius || 80,
                    blinkRate: 500,
                    blinkState: false
                });
            } else {
                // Update existing mine timer
                const mine = mines.find(m => m.id === serverMine.id);
                if (mine) mine.armTime = serverMine.armTime;
            }
        }
    }
    
    setupServerManagedGame(data) {
        const mapData = data.mapData || data;
        // Clear local entities
        window.tanks = [];
        window.bullets = [];
        window.obstacles = [];
        window.powerUps = [];
        window.mines = [];
        
        // Create obstacles and tanks from mapData received from server:
        this.createObstaclesFromServerData(mapData.obstacles);
        this.createTanksFromServerData(mapData.tanks);
        if (mapData.powerUps) {
            this.createPowerUpsFromServerData(mapData.powerUps);
        }
        
        this.gameSetup = true;
    }
    
    createObstaclesFromServerData(obstacleData) {
        if (!obstacleData || !obstacleData.length) return;
        
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
        if (!tankData || !tankData.length) return;
        
        // Both players use WASD controls in online mode
        const wasdControls = {
            forward: 'w',
            backward: 's',
            left: 'a',
            right: 'd',
            shoot: ' ',
            mine: 'e'
        };
        
        // Create tanks from server data
        tankData.forEach(data => {
            const tank = new Tank(
                data.x,
                data.y,
                data.color,
                wasdControls, // Both players use WASD
                data.playerNumber
            );
            
            // Copy any other properties
            for (const key in data) {
                if (key !== 'x' && key !== 'y' && key !== 'color' && key !== 'playerNumber') {
                    tank[key] = data[key];
                }
            }
            
            window.tanks.push(tank);
        });
    }
    
    createPowerUpsFromServerData(powerUpData) {
        if (!powerUpData || !powerUpData.length) return;
        
        window.powerUps = powerUpData.map(data => {
            const powerUp = new PowerUp(data.x, data.y, data.type);
            powerUp.id = data.id;
            return powerUp;
        });
    }
    
    handleMapData(data) {
        console.log('Received map data from server:', data);
        this.mapData = data;
        
        // Initialize game with the map data
        if (!this.gameSetup && this.mapData) {
            this.setupServerManagedGame(this.mapData);
        }
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
        
        playerIndicator.innerHTML = `<span>You are Player ${this.playerNumber} (${tankColor} Tank) - Use WASD to move, Space to shoot, E for mines</span>`;
        document.querySelector('.game-container').appendChild(playerIndicator);
        
        // Remove after 8 seconds
        setTimeout(() => {
            if (playerIndicator.parentNode) {
                playerIndicator.parentNode.removeChild(playerIndicator);
            }
        }, 8000);
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
