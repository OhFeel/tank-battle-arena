// Create a global variable immediately before class declaration
window.networkManager = null;

// Network manager for online multiplayer

class NetworkManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.playerId = null;
        this.gameId = null;
        this.playerNumber = null;
        this.opponentName = null;
        this.pingInterval = null;
        this.lastPingTime = 0;
        this.latency = 0;
        this.serverUrl = 'wss://tank-battle-arena.onrender.com';
        this.autoConnect = true;
        this.mapSeed = null;
        this.callbacks = {
            onConnected: [],
            onDisconnected: [],
            onGameFound: [],
            onOpponentInput: [],
            onOpponentDisconnected: [],
            onError: [],
            onMapSync: [],
            onPowerUpSpawn: [],
            onPowerUpCollected: [], // New callback type
            onPositionConfirmation: [], // New callback type
            onGameStateSync: []
        };
        
        // Add new properties for game synchronization
        this.initialized = false;
        this.networkReady = false;
        this.serverGameState = null;
        this.lastServerSync = 0;
        this.syncAttempts = 0;
        this.maxSyncAttempts = 5;
        this.reconnectDelay = 2000;
        this.connectedToGame = false;
    }

    // Connect to game server - modified to use the predefined URL
    connect(serverUrl = this.serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                this.serverUrl = serverUrl;
                console.log(`Connecting to server: ${this.serverUrl}`);
                this.socket = new WebSocket(this.serverUrl);
                
                this.socket.onopen = () => {
                    console.log('Connected to server');
                    this.connected = true;
                    this.networkReady = true;
                    this.startPingInterval();
                    this._triggerCallbacks('onConnected');
                    resolve();
                };
                
                this.socket.onclose = (event) => {
                    console.log('Disconnected from server:', event.code, event.reason);
                    this.connected = false;
                    this.networkReady = false;
                    clearInterval(this.pingInterval);
                    this._triggerCallbacks('onDisconnected');
                    
                    // Auto-reconnect if it was an abnormal closure and we were in a game
                    if (this.connectedToGame && event.code !== 1000 && event.code !== 1001) {
                        console.log('Attempting to reconnect in 2 seconds...');
                        setTimeout(() => this.reconnect(), this.reconnectDelay);
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this._triggerCallbacks('onError', error);
                    reject(error);
                };
                
                this.socket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
            } catch (error) {
                console.error('Connection error:', error);
                reject(error);
            }
        });
    }
    
    // Reconnect to server
    reconnect() {
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            this.socket.close();
        }
        return this.connect(this.serverUrl);
    }
    
    // Close connection
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
        
        // Clear any pending timeouts
        if (this.requestStateTimeout) clearTimeout(this.requestStateTimeout);
        if (this.gameStartTimeout) clearTimeout(this.gameStartTimeout);
    }
    
    // Send message to server
    send(messageObj) {
        if (!this.connected) {
            console.warn('Not connected to server');
            return false;
        }
        
        try {
            this.socket.send(JSON.stringify(messageObj));
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }
    
    // Find a game
    findGame(playerName) {
        return this.send({
            type: 'find_game',
            name: playerName
        });
    }
    
    // Cancel matchmaking
    cancelMatchmaking() {
        return this.send({
            type: 'cancel_matchmaking'
        });
    }
    
    // Enhanced input sending with additional state sync
    sendGameInput(input) {
        if (!this.gameId) return false;
        
        // Add player ID and game ID to input data
        return this.send({
            type: 'game_input',
            gameId: this.gameId,
            playerId: this.playerId,
            playerNumber: this.playerNumber,
            input,
            timestamp: Date.now()
        });
    }
    
    // Send full tank state for synchronization
    syncTankState(tankState) {
        if (!this.gameId) return false;
        
        return this.send({
            type: 'sync_state',
            gameId: this.gameId,
            playerId: this.playerId,
            playerNumber: this.playerNumber,
            tankState,
            timestamp: Date.now()
        });
    }
    
    // Enhanced version of sendMapData
    sendMapData(obstacles, seed, tankPositions) {
        if (!this.gameId) return false;
        
        return this.send({
            type: 'map_initialized',
            gameId: this.gameId,
            obstacles: obstacles,
            seed: seed,
            tankPositions: tankPositions
        });
    }
    
    // Add method to inform server about power-up spawns
    sendPowerUpSpawn(powerUpData) {
        if (!this.gameId) return false;
        
        return this.send({
            type: 'spawn_powerup',
            gameId: this.gameId,
            powerUp: powerUpData
        });
    }
    
    // New method to request initial game state from server
    requestGameState() {
        if (!this.gameId) return false;
        
        return this.send({
            type: 'request_game_state',
            gameId: this.gameId,
            playerId: this.playerId
        });
    }
    
    // New method to verify game sync
    verifyGameSync(gameData) {
        return this.send({
            type: 'verify_sync',
            gameId: this.gameId,
            playerId: this.playerId,
            syncData: gameData
        });
    }
    
    // Add method to handle powerup collection
    sendPowerUpCollection(gameId, playerIndex, powerUpIndex) {
        return this.send({
            type: 'collect_powerup',
            gameId: gameId,
            playerIndex: playerIndex,
            powerUpIndex: powerUpIndex
        });
    }
    
    // Handle incoming messages
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch(message.type) {
                case 'connected':
                    this.playerId = message.id;
                    console.log('Assigned player ID:', this.playerId);
                    break;
                    
                case 'game_found':
                    // Use the enhanced handler
                    this.handleGameFound(message);
                    break;

                case 'ping':
                    this.latency = Date.now() - message.timestamp;
                    this.send({
                        type: 'pong',
                        timestamp: message.timestamp
                    });
                    break;
                    
                // Handle all other message types...
                case 'map_sync':
                    this._triggerCallbacks('onMapSync', {
                        obstacles: message.obstacles
                    });
                    break;
                    
                case 'spawn_powerup':
                    this._triggerCallbacks('onPowerUpSpawn', {
                        powerUp: message.powerUp
                    });
                    break;
                    
                case 'opponent_input':
                    // Enhanced to include player identification
                    this._triggerCallbacks('onOpponentInput', {
                        playerNumber: message.playerNumber,
                        input: message.input,
                        timestamp: message.timestamp
                    });
                    break;
                    
                case 'opponent_disconnected':
                    console.log('Opponent disconnected');
                    this._triggerCallbacks('onOpponentDisconnected');
                    break;
                    
                case 'ping':
                    // Calculate latency
                    this.latency = Date.now() - message.timestamp;
                    // Send pong response
                    this.send({
                        type: 'pong',
                        timestamp: Date.now()
                    });
                    break;
                    
                case 'initial_game_state':
                    console.log('Received initial game state from server', message.gameState);
                    this.serverGameState = message.gameState;
                    this._triggerCallbacks('onInitialGameState', message.gameState);
                    break;
                
                case 'sync_verification':
                    console.log('Sync verification result:', message.status);
                    if (message.status === 'success') {
                        this.initialized = true;
                    } else {
                        // If sync failed, request a resync
                        if (this.syncAttempts < this.maxSyncAttempts) {
                            this.syncAttempts++;
                            this.requestGameState();
                        } else {
                            console.error('Failed to sync game state after multiple attempts');
                        }
                    }
                    break;
                
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
                
                default:
                    console.log('Unknown message type:', message.type, message);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    // Start ping interval to measure latency
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.lastPingTime = Date.now();
                this.send({
                    type: 'ping',
                    timestamp: this.lastPingTime
                });
            }
        }, 5000); // Ping every 5 seconds
    }
    
    // Register event callbacks
    on(eventName, callback) {
        if (this.callbacks[eventName] && typeof callback === 'function') {
            this.callbacks[eventName].push(callback);
            return true;
        }
        return false;
    }
    
    // Trigger callbacks
    _triggerCallbacks(eventName, data) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].forEach(callback => callback(data));
        }
    }
    
    // Get current network status
    getNetworkStats() {
        return {
            connected: this.connected,
            latency: this.latency,
            playerId: this.playerId,
            gameId: this.gameId
        };
    }
    
    // Make sure the game state data is properly handled
    handleGameFound(message) {
        // Store game data
        this.gameId = message.gameId;
        this.playerNumber = message.playerNumber;
        this.opponentName = message.opponent;
        this.mapSeed = message.mapSeed;
        this.connectedToGame = true;
        
        // Set a flag to track if the game has started
        this.gameStarted = false;
        
        // Store tank positions for later use
        this.tankPositions = message.tankPositions || null;
        
        console.log(`Game found! You are Player ${this.playerNumber} vs ${this.opponentName}, Map Seed: ${this.mapSeed}`);
        
        // Request initial game state from server after a short delay
        this.requestStateTimeout = setTimeout(() => {
            this.requestGameState();
            console.log('Requested initial game state from server');
            
            // Set a safety timeout - if game doesn't start in 5 seconds, try again
            this.gameStartTimeout = setTimeout(() => {
                if (!this.gameStarted) {
                    console.warn('Game not starting, retrying state request');
                    this.requestGameState();
                    
                    // Last attempt - force game start after another 3 seconds
                    setTimeout(() => {
                        if (!this.gameStarted && window.forceStartGame) {
                            console.warn('Forcing game start after timeouts');
                            window.forceStartGame();
                        }
                    }, 3000);
                }
            }, 5000);
        }, 1000);
        
        // Trigger callbacks
        this._triggerCallbacks('onGameFound', {
            gameId: this.gameId,
            playerNumber: this.playerNumber,
            opponentName: this.opponentName,
            mapSeed: this.mapSeed,
            tankPositions: this.tankPositions
        });
    }
}

// Create global instance and make it available in two ways
window.networkManager = new NetworkManager();
window._realNetworkManager = window.networkManager;

// Auto-connect when the page loads if enabled
window.addEventListener('DOMContentLoaded', () => {
    if (window.networkManager && window.networkManager.autoConnect) {
        setTimeout(() => {
            window.networkManager.connect().catch(error => {
                console.warn('Auto-connect failed:', error);
            });
        }, 1000); // Delay connection slightly to ensure DOM is ready
    }
});

// Notify any code waiting for network manager
if (window.onNetworkManagerReady) {
    window.onNetworkManagerReady(window.networkManager);
}
