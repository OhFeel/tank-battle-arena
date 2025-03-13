// Create a global variable immediately before class declaration
window.networkManager = null;

// Network manager for online multiplayer
class NetworkManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.serverUrl = 'wss://tank-battle-arena.onrender.com'; // Change this to your server's public address for remote play
        this.clientId = null;
        this.eventHandlers = {};
        this.latency = 0;
        this.lastPingSent = 0;
        this.playerId = null;
        this.gameId = null;
        this.playerNumber = null;
        this.opponentName = null;
        this.pingInterval = null;
        this.lastPingTime = 0;
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
            onStateUpdate: [], // New callback for state updates
            onMapData: [],         // Add new callback for map data
            onGameStart: []       // Make sure we have this one
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

        // Add properties for full game state synchronization
        this.gameState = null;
        this.lastInput = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            shooting: false,
            layingMine: false
        };
        this.inputChanged = false;
        this.inputUpdateInterval = null;
    }

    // Connect to game server
    connect(serverUrl = this.serverUrl) {
        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.log('Already connected');
                resolve();
                return;
            }
            
            console.log('Connecting to server:', this.serverUrl);
            
            try {
                this.socket = new WebSocket(this.serverUrl);
                
                this.socket.onopen = () => {
                    console.log('Connected to server');
                    this.connected = true;
                    this.networkReady = true;
                    this.startPingInterval();
                    
                    // Start input update loop when connected
                    this.startInputUpdateLoop();
                    
                    this.emit('onConnected');
                    resolve();
                };
                
                this.socket.onclose = (event) => {
                    console.log('Disconnected from server:', event.code, event.reason);
                    this.connected = false;
                    this.networkReady = false;
                    clearInterval(this.pingInterval);
                    this.emit('onDisconnected');
                    
                    // Auto-reconnect if it was an abnormal closure and we were in a game
                    if (this.connectedToGame && event.code !== 1000 && event.code !== 1001) {
                        console.log('Attempting to reconnect in 2 seconds...');
                        setTimeout(() => this.reconnect(), this.reconnectDelay);
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.emit('onError', 'Connection error');
                    reject('Connection error');
                };
                
                this.socket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
            } catch (error) {
                console.error('Failed to connect:', error);
                this.emit('onError', 'Failed to connect');
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
        if (!this.connected) {
            console.error('Not connected to server');
            return;
        }
        
        this.sendMessage({
            type: 'find_game',
            name: playerName
        });
    }
    
    // Cancel matchmaking
    cancelMatchmaking() {
        if (!this.connected) return;
        
        this.sendMessage({
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
                    console.log('Game starting with map seed:', message.mapSeed);
                    this._triggerCallbacks('onGameStart', message);
                    break;

                case 'state_update':
                    this.emit('onStateUpdate', message);
                    break;
                    
                case 'power_up_spawned':
                    this.emit('onPowerUpSpawned', message);
                    break;

                case 'opponent_input':
                    this.emit('onOpponentInput', message);
                    break;
                    
                case 'opponent_disconnected':
                    console.log('Opponent disconnected');
                    this.emit('onOpponentDisconnected');
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
                    
                case 'map_data':
                    console.log('Received map data from server');
                    this._triggerCallbacks('onMapData', message.mapData);
                    break;

                case 'game_state':
                    // Full game state from server; emit to listeners
                    this.gameState = message.state;
                    this.emit('onGameState', message.state);
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
    
    pingServer() {
        if (this.connected) {
            this.lastPingSent = Date.now();
            this.sendMessage({
                type: 'ping',
                timestamp: this.lastPingSent
            });
            
            // Schedule next ping
            setTimeout(() => this.pingServer(), 5000);
        }
    }
    
    sendMessage(data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.error('Socket not open');
            return;
        }
        
        this.socket.send(JSON.stringify(data));
    }
    
    emit(event, data) {
        if (this.eventHandlers[event]) {
            for (const handler of this.eventHandlers[event]) {
                handler(data);
            }
        }
    }

    // Start loop to send inputs to server when they change
    startInputUpdateLoop() {
        if (this.inputUpdateInterval) {
            clearInterval(this.inputUpdateInterval);
        }
        
        this.inputUpdateInterval = setInterval(() => {
            if (this.connected && this.gameId && this.inputChanged) {
                this.sendGameInput(this.lastInput);
                this.inputChanged = false;
            }
        }, 16); // Approx 60 times per second
    }
    
    // Stop input update loop
    stopInputUpdateLoop() {
        if (this.inputUpdateInterval) {
            clearInterval(this.inputUpdateInterval);
            this.inputUpdateInterval = null;
        }
    }
    
    // Update input state - call this when input changes
    updateInput(input) {
        if (!this.lastInput) this.lastInput = {};
        
        let changed = false;
        for (const key in input) {
            if (this.lastInput[key] !== input[key]) {
                changed = true;
                this.lastInput[key] = input[key];
            }
        }
        
        if (changed) {
            this.inputChanged = true;
        }
    }

    // Request full game state from server
    requestGameState() {
        if (!this.connected || !this.gameId) return;
        
        this.send({
            type: 'request_game_state',
            gameId: this.gameId
        });
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
