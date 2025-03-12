// Online game logic handler
class OnlineGameManager {
    constructor() {
        this.isOnlineGame = false;
        this.localPlayerNumber = null;
        this.lastServerUpdate = null;
        this.reconciliationThreshold = 5; // Distance in pixels before reconciling
    }
    
    initialize() {
        if (!window.networkManager) {
            console.error('Network manager not available');
            return this;
        }
        
        // Set up event listeners for network events
        window.networkManager.on('onGameFound', (data) => this.handleGameFound(data));
        window.networkManager.on('onStateUpdate', (data) => this.handleStateUpdate(data));
        window.networkManager.on('onOpponentInput', (data) => this.handleOpponentInput(data));
        window.networkManager.on('onPowerUpSpawn', (data) => this.handlePowerUpSpawn(data));
        window.networkManager.on('onOpponentDisconnected', () => this.handleOpponentDisconnect());
        
        return this;
    }
    
    handleGameFound(data) {
        this.isOnlineGame = true;
        this.localPlayerNumber = data.playerNumber;
        
        console.log(`Starting online game as Player ${this.localPlayerNumber}`);
        
        // Set up the game with the received data
        gameState.countdown = true;
        
        // Create obstacles using the map seed
        createObstacles(data.mapSeed);
        
        // Set up tanks using the provided positions
        if (data.tankPositions && data.tankPositions.length === 2) {
            tanks = [
                new Tank(
                    data.tankPositions[0].x, 
                    data.tankPositions[0].y, 
                    "#3498db",
                    {
                        forward: 'w',
                        backward: 's',
                        left: 'a',
                        right: 'd',
                        shoot: ' '
                    }, 
                    1
                ),
                new Tank(
                    data.tankPositions[1].x, 
                    data.tankPositions[1].y, 
                    "#e74c3c",
                    {
                        forward: 'ArrowUp',
                        backward: 'ArrowDown',
                        left: 'ArrowLeft',
                        right: 'ArrowRight',
                        shoot: '/'
                    }, 
                    2
                )
            ];
            
            // In online mode, restrict control to local player only
            if (this.localPlayerNumber === 2) {
                tanks[0].controls = null; // Disable controls for player 1
            } else {
                tanks[1].controls = null; // Disable controls for player 2
            }
        }
        
        // Start countdown
        showCountdown();
    }
    
    handleStateUpdate(data) {
        if (!this.isOnlineGame || !data.tanks || data.tanks.length !== 2) return;
        
        this.lastServerUpdate = data;
        
        // Update opponent's tank directly
        const opponentIndex = this.localPlayerNumber === 1 ? 1 : 0;
        
        if (tanks[opponentIndex] && data.tanks[opponentIndex]) {
            const serverTank = data.tanks[opponentIndex];
            const localTank = tanks[opponentIndex];
            
            // Update opponent tank directly
            localTank.x = serverTank.x;
            localTank.y = serverTank.y;
            localTank.angle = serverTank.angle;
            localTank.lives = serverTank.lives;
            
            if (serverTank.respawning) {
                localTank.respawning = true;
                localTank.respawnTimer = serverTank.respawnTimer;
            }
        }
        
        // Reconcile local player's tank if needed
        const localIndex = this.localPlayerNumber === 1 ? 0 : 1;
        
        if (tanks[localIndex] && data.tanks[localIndex]) {
            const serverTank = data.tanks[localIndex];
            const localTank = tanks[localIndex];
            
            // Only reconcile if the difference is significant
            const dx = serverTank.x - localTank.x;
            const dy = serverTank.y - localTank.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.reconciliationThreshold) {
                // Smoothly reconcile position
                localTank.x += dx * 0.2;
                localTank.y += dy * 0.2;
            }
            
            // Always update critical state
            localTank.lives = serverTank.lives;
            if (serverTank.respawning) {
                localTank.respawning = true;
                localTank.respawnTimer = serverTank.respawnTimer;
            }
        }
        
        // Update bullets directly from server
        bullets = data.bullets.map(b => {
            if (b.isHoming) {
                return new HomingMissile(
                    b.x, b.y, b.angle, b.owner, 
                    tanks[b.owner === 1 ? 1 : 0], // Target the opposite tank
                    b.ricochet, b.piercing, b.isMega
                );
            } else {
                return new Bullet(b.x, b.y, b.angle, b.owner, b.ricochet, b.piercing, b.isMega);
            }
        });
        
        // Update power-ups directly from server
        powerUps = data.powerUps.map(p => new PowerUp(p.x, p.y, p.type));
    }
    
    handleOpponentInput(data) {
        if (!this.isOnlineGame) return;
        
        const opponentIndex = data.playerNumber === 1 ? 0 : 1;
        if (!tanks[opponentIndex]) return;
        
        // Apply opponent input to their tank
        const tank = tanks[opponentIndex];
        const input = data.input;
        
        tank.moving.forward = input.forward;
        tank.moving.backward = input.backward;
        tank.moving.left = input.left;
        tank.moving.right = input.right;
        tank.shooting = input.shoot;
    }
    
    handlePowerUpSpawn(data) {
        if (!this.isOnlineGame) return;
        
        // Add the new power-up
        const powerUp = data.powerUp;
        powerUps.push(new PowerUp(powerUp.x, powerUp.y, powerUp.type));
    }
    
    handleOpponentDisconnect() {
        if (!this.isOnlineGame) return;
        
        // Show a message that the opponent disconnected
        alert("Your opponent has disconnected!");
        
        // End game and return to main menu
        gameState.active = false;
        gameState.over = true;
        showStartScreen();
        
        // Reset online game state
        this.isOnlineGame = false;
    }
}

// Create and initialize the online game manager
window.onlineGameManager = new OnlineGameManager().initialize();
