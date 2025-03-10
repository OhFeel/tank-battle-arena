// Create placeholder networkManager if it doesn't exist yet
if (typeof networkManager === 'undefined') {
    console.log('Creating placeholder networkManager until the real one loads');
    window.networkManager = {
        connected: false,
        connect: function() {
            console.log('Placeholder connect called - real networkManager not loaded');
            return new Promise((resolve, reject) => {
                // Check if the real networkManager has loaded during this time
                if (window._realNetworkManager) {
                    window.networkManager = window._realNetworkManager;
                    return window.networkManager.connect.apply(window.networkManager, arguments);
                }
                setTimeout(reject, 100, new Error('Network manager not initialized'));
            });
        },
        findGame: () => console.warn('Network manager not ready'),
        cancelMatchmaking: () => {},
        on: () => {},
        sendGameInput: () => {}
    };
}

// Poll for the real networkManager to be loaded from network.js
function waitForNetworkManager() {
    if (window._realNetworkManager) {
        window.networkManager = window._realNetworkManager;
        console.log('Real networkManager loaded and ready');
        return;
    }
    
    setTimeout(waitForNetworkManager, 200);
}

waitForNetworkManager();

// UI components for online mode

document.addEventListener('DOMContentLoaded', function() {
    // First check if we already have an online menu
    if (document.getElementById('onlineMenu')) {
        console.log('Online menu already exists, skipping creation');
        return;
    }

    // Create online menu HTML
    const onlineMenuHTML = `
        <div id="onlineMenu" class="overlay hidden">
            <h2>Online Play</h2>
            <div class="connection-status">
                <span id="connectionStatusDot"></span>
                <span id="connectionStatusText">Not Connected</span>
            </div>
            
            <div id="connectSection">
                <input type="text" id="serverUrlInput" placeholder="Server URL (ws://)" value="ws://localhost:3000">
                <button id="connectButton" class="game-button">Connect</button>
            </div>
            
            <div id="playSection" class="hidden">
                <input type="text" id="playerNameInput" placeholder="Your Name" maxlength="15">
                <button id="findGameButton" class="game-button">Find Match</button>
                <div id="matchmaking" class="hidden">
                    <p>Looking for opponent...</p>
                    <div class="spinner"></div>
                    <button id="cancelMatchButton" class="game-button cancel-button">Cancel</button>
                </div>
            </div>
            
            <button id="backToMenuButton" class="game-button">Back to Main Menu</button>
        </div>
    `;
    
    // Add online menu to game container
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = onlineMenuHTML;
        gameContainer.appendChild(tempDiv.firstElementChild);
    } else {
        console.error('Game container not found');
        return;
    }
    
    // Add online button to start screen if it doesn't exist yet
    const startScreen = document.getElementById('startScreen');
    if (startScreen && !document.getElementById('onlineButton')) {
        const onlineButton = document.createElement('button');
        onlineButton.id = 'onlineButton';
        onlineButton.className = 'game-button';
        onlineButton.textContent = 'Play Online';
        startScreen.appendChild(onlineButton);
    } else if (!startScreen) {
        console.error('Start screen not found');
        return;
    }
    
    // Get UI elements again after creating them
    const onlineMenu = document.getElementById('onlineMenu');
    const onlineButton = document.getElementById('onlineButton');
    
    // Now check if they exist
    if (!onlineButton || !onlineMenu) {
        console.error('Required online UI elements not found:', {
            onlineButton: !!onlineButton,
            onlineMenu: !!onlineMenu
        });
        return;
    }
    
    // Ensure network manager exists
    if (typeof networkManager === 'undefined') {
        console.error('Network manager not found, creating placeholder');
        window.networkManager = {
            connect: () => Promise.resolve(),
            connected: false,
            findGame: () => {},
            cancelMatchmaking: () => {},
            on: () => {},
            sendGameInput: () => {},
            syncTankState: () => {}
        };
    }
    
    const connectButton = document.getElementById('connectButton');
    const serverUrlInput = document.getElementById('serverUrlInput');
    const playerNameInput = document.getElementById('playerNameInput');
    const findGameButton = document.getElementById('findGameButton');
    const cancelMatchButton = document.getElementById('cancelMatchButton');
    const backToMenuButton = document.getElementById('backToMenuButton');
    const connectionStatusDot = document.getElementById('connectionStatusDot');
    const connectionStatusText = document.getElementById('connectionStatusText');
    const connectSection = document.getElementById('connectSection');
    const playSection = document.getElementById('playSection');
    const matchmaking = document.getElementById('matchmaking');
    
    // Setup event listeners
    onlineButton.addEventListener('click', showOnlineMenu);
    
    if (connectButton) {
        connectButton.addEventListener('click', connectToServer);
    }
    
    if (findGameButton) {
        findGameButton.addEventListener('click', findGame);
    }
    
    if (cancelMatchButton) {
        cancelMatchButton.addEventListener('click', cancelMatchmaking);
    }
    
    if (backToMenuButton) {
        backToMenuButton.addEventListener('click', backToMainMenu);
    }
    
    // Show online menu - updated to check connection status
    function showOnlineMenu() {
        // Do safety checks on DOM elements
        const startScreen = document.getElementById('startScreen');
        const onlineMenu = document.getElementById('onlineMenu');
        
        if (!startScreen) {
            console.error('Start screen not found when trying to show online menu');
            return;
        }
        
        if (!onlineMenu) {
            console.error('Online menu not found');
            return;
        }
        
        startScreen.classList.add('hidden');
        onlineMenu.classList.remove('hidden');
        
        // Check if we're already connected and update UI appropriately
        updateConnectionStatus();
        
        // If auto-connected, show the play section directly
        if (networkManager.connected) {
            if (connectSection) connectSection.classList.add('hidden');
            if (playSection) playSection.classList.remove('hidden');
        }
    }
    
    // Connect to server
    function connectToServer() {
        if (!serverUrlInput || !connectButton) return;
        
        const serverUrl = serverUrlInput.value.trim();
        if (!serverUrl) {
            alert('Please enter a server URL');
            return;
        }
        
        connectButton.disabled = true;
        connectButton.textContent = 'Connecting...';
        
        // Check if we have a real network manager now
        if (window.networkManager && window.networkManager.connect) {
            networkManager.connect(serverUrl)
                .then(() => {
                    if (connectionStatusDot) connectionStatusDot.classList.add('connected');
                    if (connectionStatusText) connectionStatusText.textContent = 'Connected';
                    if (connectSection) connectSection.classList.add('hidden');
                    if (playSection) playSection.classList.remove('hidden');
                    connectButton.textContent = 'Connect';
                    connectButton.disabled = false;
                })
                .catch(error => {
                    if (connectionStatusDot) connectionStatusDot.classList.remove('connected');
                    if (connectionStatusText) connectionStatusText.textContent = 'Connection Failed';
                    connectButton.textContent = 'Retry';
                    connectButton.disabled = false;
                    console.error('Connection failed:', error);
                });
        } else {
            console.error('Network manager not available after waiting');
            connectButton.textContent = 'Connect';
            connectButton.disabled = false;
            alert('Network functionality not available. Please refresh the page.');
        }
    }
    
    // Find game
    function findGame() {
        if (!playerNameInput || !playSection || !findGameButton || !matchmaking) return;
        
        const playerName = playerNameInput.value.trim() || generateRandomName();
        playerNameInput.value = playerName;
        
        playSection.classList.add('finding-game');
        findGameButton.disabled = true;
        matchmaking.classList.remove('hidden');
        
        // Send find game request
        networkManager.findGame(playerName);
        
        // Listen for game found event
        networkManager.on('onGameFound', handleGameFound);
    }
    
    // Update handleGameFound function to properly pass tank positions
    function handleGameFound(gameData) {
        if (!playSection || !matchmaking || !onlineMenu) {
            console.error("Required UI elements not found for handling game start");
            return;
        }
        
        console.log('Game found with data:', gameData);
        
        // Clear loading animation immediately
        playSection.classList.remove('finding-game');
        matchmaking.classList.add('hidden');
        onlineMenu.classList.add('hidden');
        
        // Show a toast notification that the game was found
        if (window.networkUI) {
            window.networkUI.showToast(`Game found! Playing against ${gameData.opponentName}`);
        }
        
        // Make sure we have the required data
        if (!gameData.mapSeed) {
            console.error('Missing map seed in game data!', gameData);
            gameData.mapSeed = Math.floor(Math.random() * 1000000); // Fallback seed
        }
        
        if (!gameData.tankPositions) {
            console.warn('Missing tank positions in game data, using defaults');
            gameData.tankPositions = null;
        }
        
        // Initialize game in online mode with the map seed and tank positions
        if (typeof initGame === 'function') {
            // Force a small timeout to ensure UI updates first
            setTimeout(() => {
                try {
                    initGame(true, gameData.playerNumber, gameData.mapSeed, gameData.tankPositions);
                    
                    // Enable network UI
                    if (window.networkUI) {
                        window.networkUI.toggleIndicator(true);
                    }
                    
                    // Debug log current state
                    console.log('Game initialized with:', { 
                        player: gameData.playerNumber, 
                        opponent: gameData.opponentName,
                        mapSeed: gameData.mapSeed,
                        onlineMode: true
                    });
                    
                    // Show countdown with opponent info
                    const countdownInfo = document.querySelector('.countdown-info');
                    if (countdownInfo) {
                        countdownInfo.textContent = `Playing against ${gameData.opponentName}`;
                    }
                    
                    // Start game countdown immediately
                    if (typeof showCountdown === 'function') {
                        showCountdown();
                    } else {
                        console.error('showCountdown function not found!');
                    }
                } catch (error) {
                    console.error('Error initializing game:', error);
                    // Show error notification
                    if (window.networkUI) {
                        window.networkUI.showToast('Error starting game. Please try again.');
                    }
                }
            }, 250); // Small delay to allow UI updates
        } else {
            console.error('initGame function not found!');
            return;
        }
    }
    
    // Cancel matchmaking
    function cancelMatchmaking() {
        if (!networkManager || !playSection || !matchmaking || !findGameButton) return;
        
        networkManager.cancelMatchmaking();
        playSection.classList.remove('finding-game');
        matchmaking.classList.add('hidden');
        findGameButton.disabled = false;
    }
    
    // Return to main menu
    function backToMainMenu() {
        const onlineMenu = document.getElementById('onlineMenu');
        const startScreen = document.getElementById('startScreen');
        
        if (!onlineMenu || !startScreen) {
            console.error('Cannot return to main menu: required elements not found');
            return;
        }
        
        onlineMenu.classList.add('hidden');
        startScreen.classList.remove('hidden');
        
        // Clean up
        if (playSection && matchmaking && findGameButton) {
            playSection.classList.remove('finding-game');
            matchmaking.classList.add('hidden');
            findGameButton.disabled = false;
        }
    }
    
    // Update connection status
    function updateConnectionStatus() {
        if (!networkManager || !connectionStatusDot || !connectionStatusText || 
            !connectSection || !playSection) return;
            
        if (networkManager.connected) {
            connectionStatusDot.classList.add('connected');
            connectionStatusText.textContent = 'Connected';
            connectSection.classList.add('hidden');
            playSection.classList.remove('hidden');
        } else {
            connectionStatusDot.classList.remove('connected');
            connectionStatusText.textContent = 'Not Connected';
            connectSection.classList.remove('hidden');
            playSection.classList.add('hidden');
        }
    }
    
    // Generate random player name
    function generateRandomName() {
        const adjectives = ['Swift', 'Brave', 'Mighty', 'Epic', 'Fierce', 'Silent'];
        const nouns = ['Tank', 'Commander', 'Captain', 'General', 'Warrior'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj}${noun}${Math.floor(Math.random() * 100)}`;
    }
    
    // Initialize listeners for connection events
    initConnectionListeners();
    
    // Function to set up network connection listeners
    function initConnectionListeners() {
        // Listen for connection events
        networkManager.on('onConnected', () => {
            console.log('Connected to server from UI listener');
            updateConnectionStatus();
        });
        
        networkManager.on('onDisconnected', () => {
            console.log('Disconnected from server');
            updateConnectionStatus();
        });
        
        // Check connection status immediately
        if (networkManager.connected) {
            console.log('Already connected to server');
            updateConnectionStatus();
        }
    }
    
    console.log('Online UI initialized successfully');
});
