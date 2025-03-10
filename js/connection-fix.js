/**
 * Connection fix for Tank Battle Arena
 * Resolves issues with game initialization after server matches players
 */
(function() {
    // Check if NetworkManager is available
    if (!window.networkManager) {
        console.error('Network manager not found, cannot apply connection fixes');
        return;
    }
    
    console.log('Connection Fix: Installing enhanced game found handler');
    
    // Enhance the handleGameFound function in NetworkManager to be more robust
    const originalHandleGameFound = networkManager.handleGameFound || function() {};
    
    networkManager.handleGameFound = function(message) {
        console.log('Enhanced game_found handler received:', message);
        
        // Store game data with proper field names
        this.gameId = message.gameId;
        this.playerNumber = message.playerNumber;
        this.opponentName = message.opponent || message.opponentName || 'Opponent';
        this.mapSeed = message.mapSeed;
        this.connectedToGame = true;
        
        // Set a flag to track if the game has started
        this.gameStarted = false;
        
        // Store tank positions for later use
        this.tankPositions = message.tankPositions || null;
        
        console.log(`Game found! You are Player ${this.playerNumber} vs ${this.opponentName}, Map Seed: ${this.mapSeed}`);
        
        // Ensure tank positions are in the correct format
        if (this.tankPositions) {
            console.log('Using server-provided tank positions:', this.tankPositions);
        } else {
            console.warn('No tank positions provided by server, will use defaults');
        }
        
        // Call original method if it exists and is a function
        if (typeof originalHandleGameFound === 'function') {
            try {
                originalHandleGameFound.call(this, message);
            } catch (error) {
                console.error('Error in original handleGameFound:', error);
            }
        }
        
        // Trigger callbacks with correct opponent name
        this._triggerCallbacks('onGameFound', {
            gameId: this.gameId,
            playerNumber: this.playerNumber,
            opponentName: this.opponentName,
            mapSeed: this.mapSeed,
            tankPositions: this.tankPositions
        });
        
        // Set a safety timeout to force game start if not started after 5 seconds
        setTimeout(() => {
            if (!this.gameStarted) {
                console.warn('Game not started after 5 seconds, forcing UI update');
                
                // Try to update UI
                const onlineMenu = document.getElementById('onlineMenu');
                const matchmaking = document.getElementById('matchmaking');
                const playSection = document.querySelector('#playSection');
                
                if (onlineMenu) onlineMenu.classList.add('hidden');
                if (matchmaking) matchmaking.classList.add('hidden');
                if (playSection) playSection.classList.remove('finding-game');
                
                // Force game initialization
                if (typeof initGame === 'function') {
                    try {
                        console.log('Forcing game initialization');
                        initGame(true, this.playerNumber, this.mapSeed, this.tankPositions);
                        
                        // Show countdown
                        const countdownScreen = document.getElementById('countdownScreen');
                        if (countdownScreen) countdownScreen.classList.remove('hidden');
                        
                        const countdownInfo = document.querySelector('.countdown-info');
                        if (countdownInfo) {
                            countdownInfo.textContent = `Playing against ${this.opponentName}`;
                        }
                        
                        // Start countdown
                        if (typeof showCountdown === 'function') {
                            console.log('Starting countdown');
                            showCountdown();
                        }
                        
                        // Show notification
                        console.log('Game started via safety timeout');
                    } catch (error) {
                        console.error('Error force-starting game:', error);
                    }
                }
            }
        }, 5000);
    };
    
    // Add a message processing interceptor to fix opponentName issues
    const originalHandleMessage = networkManager.handleMessage;
    
    networkManager.handleMessage = function(data) {
        try {
            const message = JSON.parse(data);
            
            // Fix missing opponentName in game_found messages
            if (message.type === 'game_found' && message.opponent && !message.opponentName) {
                message.opponentName = message.opponent;
                console.log('Added missing opponentName field to game_found message');
            }
            
            // Call the original handler with the possibly fixed message
            return originalHandleMessage.call(this, data);
        } catch (error) {
            console.error('Error in enhanced message handler:', error);
            
            // Still try to call original handler
            return originalHandleMessage.call(this, data);
        }
    };
    
    console.log('Connection Fix: Enhanced handlers installed successfully');
    
    // Add diagnostic button to the page
    const btn = document.createElement('button');
    btn.textContent = 'Force Start Game';
    btn.style.position = 'fixed';
    btn.style.bottom = '10px';
    btn.style.left = '10px';
    btn.style.zIndex = '9999';
    btn.style.background = '#e74c3c';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.padding = '10px';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';
    
    btn.addEventListener('click', function() {
        if (!networkManager || !networkManager.gameId) {
            alert('No game found to start');
            return;
        }
        
        // Try to force start game
        console.log('Manual force start triggered');
        
        try {
            // Hide UI elements
            const elements = ['startScreen', 'settingsMenu', 'onlineMenu', 'matchmaking'];
            elements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            // Start game
            initGame(true, networkManager.playerNumber, networkManager.mapSeed, networkManager.tankPositions);
            showCountdown();
        } catch (error) {
            console.error('Error forcing game start:', error);
        }
    });
    
    // Only show the button in case of issues
    setTimeout(function() {
        if (networkManager && networkManager.gameId && (!window.gameState || !gameState.active)) {
            document.body.appendChild(btn);
        }
    }, 10000); // Show after 10 seconds if game hasn't started
    
    // Remove button when game starts
    const checkInterval = setInterval(function() {
        if (window.gameState && gameState.active) {
            if (btn.parentElement) {
                btn.parentElement.removeChild(btn);
            }
            clearInterval(checkInterval);
        }
    }, 1000);
})();
