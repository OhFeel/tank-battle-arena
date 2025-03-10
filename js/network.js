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
        this.serverUrl = null;
        this.callbacks = {
            onConnected: [],
            onDisconnected: [],
            onGameFound: [],
            onOpponentInput: [],
            onOpponentDisconnected: [],
            onError: []
        };
    }

    // Connect to game server
    connect(serverUrl = 'ws://localhost:3000') {
        return new Promise((resolve, reject) => {
            try {
                this.serverUrl = serverUrl;
                this.socket = new WebSocket(serverUrl);
                
                this.socket.onopen = () => {
                    console.log('Connected to server');
                    this.connected = true;
                    this.startPingInterval();
                    this._triggerCallbacks('onConnected');
                    resolve();
                };
                
                this.socket.onclose = () => {
                    console.log('Disconnected from server');
                    this.connected = false;
                    clearInterval(this.pingInterval);
                    this._triggerCallbacks('onDisconnected');
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
    
    // Send game input
    sendGameInput(input) {
        if (!this.gameId) return false;
        
        return this.send({
            type: 'game_input',
            gameId: this.gameId,
            input,
            timestamp: Date.now()
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
                    this.gameId = message.gameId;
                    this.playerNumber = message.playerNumber;
                    this.opponentName = message.opponent;
                    console.log(`Game found! You are Player ${this.playerNumber} vs ${this.opponentName}`);
                    this._triggerCallbacks('onGameFound', {
                        gameId: this.gameId,
                        playerNumber: this.playerNumber,
                        opponentName: this.opponentName
                    });
                    break;
                    
                case 'opponent_input':
                    this._triggerCallbacks('onOpponentInput', {
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
}

// Create global instance
const networkManager = new NetworkManager();
