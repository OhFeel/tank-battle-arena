// UI components for online mode

document.addEventListener('DOMContentLoaded', function() {
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
        gameContainer.appendChild(tempDiv.firstChild);
    }
    
    // Add online button to start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        const onlineButton = document.createElement('button');
        onlineButton.id = 'onlineButton';
        onlineButton.className = 'game-button';
        onlineButton.textContent = 'Play Online';
        startScreen.appendChild(onlineButton);
    }
    
    // Get UI elements
    const onlineMenu = document.getElementById('onlineMenu');
    const onlineButton = document.getElementById('onlineButton');
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
    if (onlineButton) {
        onlineButton.addEventListener('click', showOnlineMenu);
    }
    
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
    
    // Show online menu
    function showOnlineMenu() {
        startScreen.classList.add('hidden');
        onlineMenu.classList.remove('hidden');
        
        // Update connection status
        updateConnectionStatus();
    }
    
    // Connect to server
    function connectToServer() {
        const serverUrl = serverUrlInput.value.trim();
        if (!serverUrl) {
            alert('Please enter a server URL');
            return;
        }
        
        connectButton.disabled = true;
        connectButton.textContent = 'Connecting...';
        
        networkManager.connect(serverUrl)
            .then(() => {
                connectionStatusDot.classList.add('connected');
                connectionStatusText.textContent = 'Connected';
                connectSection.classList.add('hidden');
                playSection.classList.remove('hidden');
                connectButton.textContent = 'Connect';
                connectButton.disabled = false;
            })
            .catch(error => {
                connectionStatusDot.classList.remove('connected');
                connectionStatusText.textContent = 'Connection Failed';
                connectButton.textContent = 'Retry';
                connectButton.disabled = false;
                console.error('Connection failed:', error);
            });
    }
    
    // Find game
    function findGame() {
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
    
    // Handle game found event
    function handleGameFound(gameData) {
        playSection.classList.remove('finding-game');
        matchmaking.classList.add('hidden');
        onlineMenu.classList.add('hidden');
        
        // Initialize game in online mode
        initGame(true, gameData.playerNumber);
        
        // Show countdown with opponent info
        const countdownInfo = document.querySelector('.countdown-info');
        if (countdownInfo) {
            countdownInfo.textContent = `Playing against ${gameData.opponentName}`;
        }
        
        // Start game countdown
        showCountdown();
    }
    
    // Cancel matchmaking
    function cancelMatchmaking() {
        networkManager.cancelMatchmaking();
        playSection.classList.remove('finding-game');
        matchmaking.classList.add('hidden');
        findGameButton.disabled = false;
    }
    
    // Return to main menu
    function backToMainMenu() {
        onlineMenu.classList.add('hidden');
        startScreen.classList.remove('hidden');
        
        // Clean up
        playSection.classList.remove('finding-game');
        matchmaking.classList.add('hidden');
        findGameButton.disabled = false;
    }
    
    // Update connection status
    function updateConnectionStatus() {
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
});
