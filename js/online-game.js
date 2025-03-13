// Online game logic handler
class OnlineGameManager {
    constructor() {
        this.isOnlineGame = false;
        this.gameStarted = false;
        this.playerNumber = null;
        this.opponentName = null;
        this.lastServerUpdate = null;
        this.interpolationBuffer = [];
        this.serverUpdateRate = 1000 / 60; // Assuming 60 FPS server update rate
        this.interpolationDelay = 100; // 100ms interpolation delay for smoother gameplay
        this.predictedPositions = {};
        this.lastInputTime = 0;
        this.stateSyncInterval = null;
        this.serverGameState = null;
    }
    
    initialize() {
        // Initialize network manager if not already done
        if (!window.networkManager) {
            console.error('Network manager not available');
            return;
        }
        
        // Set up event listeners for network events
        this.setupNetworkListeners();
        
        console.log('Online game manager initialized');
        return this;
    }
    
    setupNetworkListeners() {
        window.networkManager.on('onGameFound', this.handleGameFound.bind(this));
        window.networkManager.on('onGameStart', this.handleGameStart.bind(this));
        window.networkManager.on('onStateUpdate', this.handleStateUpdate.bind(this));
        window.networkManager.on('onOpponentInput', this.handleOpponentInput.bind(this));
        window.networkManager.on('onOpponentDisconnected', this.handleOpponentDisconnected.bind(this));
    }
    
    handleGameFound(data) {
        console.log('Game found:', data);
        this.isOnlineGame = true;
        this.playerNumber = data.playerNumber;
        this.opponentName = data.opponentName;
        this.mapSeed = data.mapSeed;
        
        // Reset game state
        this.gameStarted = false;
        this.interpolationBuffer = [];
        this.predictedPositions = {};
        
        // Hide the online menu when game is found
        if (window.onlineUI) {
            window.onlineUI.hideImmediately();
        }
        
        // Use server-authoritative client instead of local generation
        if (window.onlineGameClient) {
            window.onlineGameClient.initialize();
        } else {
            console.error('Online game client not available, falling back to local generation');
            
            // Fallback to old method
            setTimeout(() => {
                if (window.showCountdown) {
                    window.showCountdown();
                } else {
                    this.startOnlineGame();
                }
            }, 1000);
        }
    }
    
    handleGameStart(data) {
        console.log('Game starting with seed:', this.mapSeed);
        this.startOnlineGame();
    }
    
    startOnlineGame() {
        try {
            // Instead of calling window.initGame(), call the online game client's initialization
            if (window.onlineGameClient && typeof window.onlineGameClient.initialize === 'function') {
                window.onlineGameClient.initialize();
            } else {
                console.error('onlineGameClient.initialize is not available');
            }
            
            // Now start the game using the online game client
            if (window.onlineGameClient && typeof window.onlineGameClient.startGame === 'function') {
                window.onlineGameClient.startGame();
            } else {
                console.error('onlineGameClient.startGame is not available');
            }
        } catch (err) {
            console.error('Error in startOnlineGame:', err);
        }
    }
    
    startStateSync() {
        // Request state updates every 50ms (20 times per second)
        this.stateSyncInterval = setInterval(() => {
            if (!this.isOnlineGame || !this.gameStarted) return;
            
            // Send current input state to server
            this.sendInputToServer();
        }, 50);
    }
    
    stopStateSync() {
        if (this.stateSyncInterval) {
            clearInterval(this.stateSyncInterval);
            this.stateSyncInterval = null;
        }
    }
    
    handleStateUpdate(data) {
        // Store the latest server update for interpolation
        this.lastServerUpdate = {
            timestamp: data.timestamp,
            tanks: data.tanks,
            bullets: data.bullets,
            powerUps: data.powerUps
        };
        
        // Add to interpolation buffer
        this.interpolationBuffer.push(this.lastServerUpdate);
        
        // Keep buffer from growing too large
        while (this.interpolationBuffer.length > 10) {
            this.interpolationBuffer.shift();
        }
        
        // Apply state update with interpolation delay
        this.applyStateUpdate();
    }
    
    applyStateUpdate() {
        if (!this.isOnlineGame || !this.gameStarted || this.interpolationBuffer.length === 0) return;
        
        const now = Date.now();
        const interpolationTime = now - this.interpolationDelay;
        
        // Find the two updates to interpolate between
        let older = null;
        let newer = null;
        
        for (let i = 0; i < this.interpolationBuffer.length; i++) {
            if (this.interpolationBuffer[i].timestamp <= interpolationTime) {
                older = this.interpolationBuffer[i];
            } else {
                newer = this.interpolationBuffer[i];
                break;
            }
        }
        
        // If we found both updates, interpolate between them
        if (older && newer) {
            const ratio = (interpolationTime - older.timestamp) / (newer.timestamp - older.timestamp);
            this.interpolateGameState(older, newer, ratio);
        }
        // Otherwise just use the most recent update we have
        else if (newer) {
            this.updateGameState(newer);
        } else if (older) {
            this.updateGameState(older);
        }
    }
    
    interpolateGameState(older, newer, ratio) {
        // Apply state to game entities
        this.updateGameState(newer, ratio > 0.5); // Use newer state for decisions if ratio > 0.5
        
        // Interpolate tank positions
        for (let i = 0; i < Math.min(tanks.length, newer.tanks.length); i++) {
            const tank = tanks[i];
            const oldTank = older.tanks.find(t => t.id === tank.id) || older.tanks[i];
            const newTank = newer.tanks.find(t => t.id === tank.id) || newer.tanks[i];
            
            // Skip interpolation for local player's tank to avoid input lag
            if (tank.playerNumber === this.playerNumber) {
                continue;
            }
            
            // Interpolate position
            tank.x = oldTank.x + (newTank.x - oldTank.x) * ratio;
            tank.y = oldTank.y + (newTank.y - oldTank.y) * ratio;
            
            // Interpolate angle
            let angleDiff = newTank.angle - oldTank.angle;
            // Normalize angle difference
            if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            tank.angle = oldTank.angle + angleDiff * ratio;
        }
        
        // Update bullets directly (don't interpolate for simplicity)
        this.updateBullets(newer.bullets);
    }
    
    updateGameState(state, useForBullets = true) {
        // Update tanks
        for (let i = 0; i < Math.min(tanks.length, state.tanks.length); i++) {
            const tank = tanks[i];
            const serverTank = state.tanks.find(t => t.id === tank.id) || state.tanks[i];
            
            // Don't override local player's position directly to avoid stuttering
            if (tank.playerNumber !== this.playerNumber) {
                tank.x = serverTank.x;
                tank.y = serverTank.y;
                tank.angle = serverTank.angle;
            }
            
            // Update other properties
            tank.lives = serverTank.lives;
            
            // Update power-ups
            tank.shield = serverTank.powerUps.shield;
            tank.ricochetBullets = serverTank.powerUps.ricochet;
            tank.piercingBullets = serverTank.powerUps.piercing;
            tank.speedBoost = serverTank.powerUps.speedBoost;
            tank.rapidFire = serverTank.powerUps.rapidFire;
            tank.mines = serverTank.powerUps.mines;
            tank.spreadShot = serverTank.powerUps.spreadShot;
            tank.magneticShield = serverTank.powerUps.magneticShield;
            tank.invisibility = serverTank.powerUps.invisibility;
            tank.megaBullet = serverTank.powerUps.megaBullet;
            tank.homingMissileBullets = serverTank.powerUps.homingMissile;
        }
        
        // Update bullets, power-ups, mines, etc.
        if (useForBullets) {
            this.updateBullets(state.bullets);
            this.updatePowerUps(state.powerUps);
        }
    }
    
    updateBullets(serverBullets) {
        // Remove bullets that no longer exist on the server
        bullets = bullets.filter(bullet => 
            serverBullets.some(sb => sb.id === bullet.id)
        );
        
        // Add new bullets from server
        for (const serverBullet of serverBullets) {
            const existingBullet = bullets.find(b => b.id === serverBullet.id);
            
            if (!existingBullet) {
                // Create a new bullet based on server data
                let bullet;
                if (serverBullet.isHoming) {
                    // Find target tank
                    const targetTank = tanks.find(tank => tank.playerNumber !== serverBullet.owner);
                    bullet = new HomingMissile(
                        serverBullet.x,
                        serverBullet.y,
                        serverBullet.angle,
                        serverBullet.owner,
                        targetTank,
                        serverBullet.ricochet,
                        serverBullet.piercing,
                        serverBullet.isMega
                    );
                } else {
                    bullet = new Bullet(
                        serverBullet.x,
                        serverBullet.y,
                        serverBullet.angle,
                        serverBullet.owner,
                        serverBullet.ricochet,
                        serverBullet.piercing,
                        serverBullet.isMega
                    );
                }
                bullet.id = serverBullet.id; // Ensure we use the server's ID
                bullets.push(bullet);
            } else {
                // Update existing bullet
                existingBullet.x = serverBullet.x;
                existingBullet.y = serverBullet.y;
                existingBullet.angle = serverBullet.angle;
            }
        }
    }
    
    updatePowerUps(serverPowerUps) {
        // Remove power-ups that no longer exist on the server
        powerUps = powerUps.filter(powerUp => 
            serverPowerUps.some(sp => sp.id === powerUp.id)
        );
        
        // Add new power-ups from server
        for (const serverPowerUp of serverPowerUps) {
            if (!powerUps.some(p => p.id === serverPowerUp.id)) {
                const powerUp = new PowerUp(
                    serverPowerUp.x,
                    serverPowerUp.y,
                    serverPowerUp.type
                );
                powerUp.id = serverPowerUp.id; // Ensure we use the server's ID
                powerUps.push(powerUp);
            }
        }
    }
    
    handleOpponentInput(data) {
        // Apply opponent input to their tank
        const opponentTank = tanks.find(tank => tank.playerNumber !== this.playerNumber);
        if (!opponentTank) return;
        
        const input = data.input;
        if (!input) return;
        
        if ('forward' in input) opponentTank.moving.forward = input.forward;
        if ('backward' in input) opponentTank.moving.backward = input.backward;
        if ('left' in input) opponentTank.moving.left = input.left;
        if ('right' in input) opponentTank.moving.right = input.right;
        if ('shooting' in input) opponentTank.shooting = input.shooting;
        if ('layingMine' in input) opponentTank.layingMine = input.layingMine;
    }
    
    handleOpponentDisconnected() {
        console.log('Opponent disconnected');
        
        // Show message
        alert('Your opponent has disconnected. Returning to main menu...');
        
        // End the game and return to menu
        this.endOnlineGame();
        showStartScreen();
    }
    
    sendInputToServer() {
        if (!this.isOnlineGame || !this.playerNumber) return;
        
        // Get the local player's tank
        const localTank = tanks.find(tank => tank.playerNumber === this.playerNumber);
        if (!localTank) return;
        
        // Send input state to server
        window.networkManager.sendGameInput({
            forward: localTank.moving.forward,
            backward: localTank.moving.backward,
            left: localTank.moving.left,
            right: localTank.moving.right,
            shooting: localTank.shooting,
            layingMine: localTank.layingMine
        });
        
        this.lastInputTime = Date.now();
    }
    
    endOnlineGame() {
        // Clean up
        this.isOnlineGame = false;
        this.gameStarted = false;
        this.playerNumber = null;
        this.opponentName = null;
        this.stopStateSync();
        
        // Reset game components
        bullets = [];
        powerUps = [];
    }
}

// Initialize the online game manager
window.onlineGameManager = new OnlineGameManager().initialize();

// Connect online button
document.addEventListener('DOMContentLoaded', () => {
    const onlineButton = document.getElementById('onlineButton');
    if (onlineButton) {
        onlineButton.addEventListener('click', () => {
            if (window.onlineUI) {
                window.onlineUI.show();
            } else {
                console.error('Online UI not initialized');
            }
        });
    }
});
