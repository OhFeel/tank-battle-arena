// Online multiplayer UI manager
class OnlineUIManager {
    constructor() {
        this.container = null;
        this.statusText = null;
        this.playerNameInput = null;
        this.findGameButton = null;
        this.cancelButton = null;
        this.matchmaking = false;
    }
    
    initialize() {
        // Create the container
        this.container = document.createElement('div');
        this.container.className = 'online-menu overlay hidden';
        this.container.id = 'onlineMenu';
        
        // Create the content
        this.container.innerHTML = `
            <h2>Online Multiplayer</h2>
            <div class="online-form">
                <label for="playerName">Your Name:</label>
                <input type="text" id="playerName" maxlength="15" placeholder="Enter your name">
                <div class="button-container">
                    <button id="findGameBtn" class="game-button">Find Game</button>
                    <button id="cancelMatchmakingBtn" class="game-button hidden">Cancel</button>
                </div>
                <button id="backToMenuBtn" class="game-button">Back to Menu</button>
            </div>
            <div id="matchmakingStatus" class="matchmaking-status hidden">
                <div class="spinner"></div>
                <p id="statusText">Searching for opponent...</p>
                <p id="latencyIndicator">Ping: -- ms</p>
            </div>
        `;
        
        // Add to the document
        document.body.appendChild(this.container);
        
        // Cache references to elements
        this.statusText = document.getElementById('statusText');
        this.playerNameInput = document.getElementById('playerName');
        this.findGameButton = document.getElementById('findGameBtn');
        this.cancelButton = document.getElementById('cancelMatchmakingBtn');
        this.matchmakingStatus = document.getElementById('matchmakingStatus');
        this.backButton = document.getElementById('backToMenuBtn');
        this.latencyIndicator = document.getElementById('latencyIndicator');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Update latency periodically
        setInterval(() => this.updateLatency(), 1000);
        
        return this;
    }
    
    setupEventListeners() {
        this.findGameButton.addEventListener('click', () => this.startMatchmaking());
        this.cancelButton.addEventListener('click', () => this.cancelMatchmaking());
        this.backButton.addEventListener('click', () => this.hide());
        
        // Setup network event listeners
        if (window.networkManager) {
            window.networkManager.on('onConnected', () => {
                this.updateStatus('Connected to server');
                this.enableMatchmaking(true);
            });
            
            window.networkManager.on('onDisconnected', () => {
                this.updateStatus('Disconnected from server');
                this.enableMatchmaking(false);
            });
            
            window.networkManager.on('onError', (error) => {
                this.updateStatus('Connection error: ' + error);
                this.enableMatchmaking(false);
            });
            
            window.networkManager.on('onGameFound', (data) => {
                this.updateStatus(`Game found! Playing against ${data.opponentName}`);
                this.matchmaking = false;
                this.showMatchmakingUI(false);
                setTimeout(() => this.hide(), 1500);
            });
        }
    }
    
    updateLatency() {
        if (window.networkManager && window.networkManager.connected) {
            this.latencyIndicator.textContent = `Ping: ${window.networkManager.latency} ms`;
        }
    }
    
    show() {
        // Hide other menus first
        const startScreen = document.getElementById('startScreen');
        const settingsMenu = document.getElementById('settingsMenu');
        
        if (startScreen) startScreen.classList.add('hidden');
        if (settingsMenu) settingsMenu.classList.add('hidden');
        
        this.container.classList.remove('hidden');
        
        // Try connecting to server if not already connected
        if (window.networkManager && !window.networkManager.connected) {
            this.updateStatus('Connecting to server...');
            window.networkManager.connect().catch(error => {
                this.updateStatus('Failed to connect: ' + error);
            });
        } else if (window.networkManager && window.networkManager.connected) {
            this.enableMatchmaking(true);
        }
    }
    
    hide() {
        this.container.classList.add('hidden');
        
        // Show start screen again
        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.remove('hidden');
        
        // Cancel matchmaking if active
        if (this.matchmaking) {
            this.cancelMatchmaking();
        }
    }
    
    updateStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }
    
    startMatchmaking() {
        if (!window.networkManager || !window.networkManager.connected) {
            this.updateStatus('Not connected to server');
            return;
        }
        
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            this.updateStatus('Please enter your name');
            return;
        }
        
        // Start matchmaking
        window.networkManager.findGame(playerName);
        this.matchmaking = true;
        
        // Update UI
        this.showMatchmakingUI(true);
        this.updateStatus('Searching for opponent...');
    }
    
    cancelMatchmaking() {
        if (window.networkManager && this.matchmaking) {
            window.networkManager.cancelMatchmaking();
            this.matchmaking = false;
        }
        
        this.showMatchmakingUI(false);
        this.updateStatus('Matchmaking canceled');
    }
    
    showMatchmakingUI(show) {
        if (show) {
            this.findGameButton.classList.add('hidden');
            this.cancelButton.classList.remove('hidden');
            this.matchmakingStatus.classList.remove('hidden');
            this.playerNameInput.disabled = true;
        } else {
            this.findGameButton.classList.remove('hidden');
            this.cancelButton.classList.add('hidden');
            this.matchmakingStatus.classList.add('hidden');
            this.playerNameInput.disabled = false;
        }
    }
    
    enableMatchmaking(enabled) {
        this.findGameButton.disabled = !enabled;
        if (!enabled) {
            this.showMatchmakingUI(false);
        }
    }
}

// Create and initialize the online UI
window.onlineUI = new OnlineUIManager().initialize();
