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
        this.serverUrl = 'ws://localhost:3000'; // Change to your server URL in production
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
            onPowerUpCollected: [],
            onPositionConfirmation: [],
            onGameStateSync: [],
            onStateUpdate: [] // New callback for state updates
        };
        
        // Add properties for game synchronization
        this.initialized = false;
        this.networkReady = false;
        this.serverGameState = null;
        this.lastServerSync = 0;
        this.syncAttempts = 0;
        this.maxSyncAttempts = 5;
        this.reconnectDelay = 2000;
        this.connectedToGame = false;
        this.predictedMoves = []; // To store predicted moves
    }

    // Connect to game server
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
    
    // Send game input with prediction
    sendGameInput(input) {
        if (!this.gameId) return false;
        
        const timestamp = Date.now();
        
        // Store this input for prediction
        this.predictedMoves.push({
            input: input,
            timestamp: timestamp
        });
        
        // Keep only recent predictions
        if (this.predictedMoves.length > 10) {
            this.predictedMoves.shift();
        }
        
        // Add player ID and game ID to input data
        return this.send({
            type: 'game_input',
            gameId: this.gameId,
            playerId: this.playerId,
            playerNumber: this.playerNumber,
            input,
            timestamp: timestamp
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
                    this.handleGameFound(message);
                    break;

                case 'game_start':
                    console.log('Game starting!');
                    this._triggerCallbacks('onGameStart');
                    break;

                case 'state_update':
                    this._triggerCallbacks('onStateUpdate', {
                        tanks: message.tanks,
                        bullets: message.bullets,
                        powerUps: message.powerUps,
                        timestamp: message.timestamp
                    });
                    break;
                    
                case 'power_up_spawned':
                    this._triggerCallbacks('onPowerUpSpawn', {
                        powerUp: message.powerUp
                    });
                    break;

                case 'opponent_input':
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
                        timestamp: message.timestamp
                    });
                    break;
                    
                case 'pong':
                    this.latency = Date.now() - message.timestamp;
                    console.log(`Current latency: ${this.latency}ms`);
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
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
    
    // Handle game found message
    handleGameFound(message) {
        // Store game data
        this.gameId = message.gameId;
        this.playerNumber = message.playerNumber;
        this.opponentName = message.opponent;
        this.mapSeed = message.mapSeed;
        this.connectedToGame = true;
        
        console.log(`Game found! You are Player ${this.playerNumber} vs ${this.opponentName}, Map Seed: ${this.mapSeed}`);
        
        // Trigger callbacks
        this._triggerCallbacks('onGameFound', {
            gameId: this.gameId,
            playerNumber: this.playerNumber,
            opponentName: this.opponentName,
            mapSeed: this.mapSeed,
            tankPositions: message.tankPositions
        });
    }
    
    // Reset game state
    resetGameState() {
        this.gameId = null;
        this.playerNumber = null;
        this.opponentName = null;
        this.mapSeed = null;
        this.connectedToGame = false;
        this.predictedMoves = [];
    }
}

// Create global instance and make it available in two ways
window.networkManager = new NetworkManager();

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
