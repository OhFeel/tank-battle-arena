// Recovery functions for handling stuck games

/**
 * This script contains recovery functions for fixing common game loading issues
 */
(function() {
    // Check for stuck games every 10 seconds
    const RECOVERY_CHECK_INTERVAL = 10000;
    
    // Storage for game data to use in recovery
    let lastGameData = null;
    let recoveryAttempts = 0;
    const MAX_RECOVERY_ATTEMPTS = 3;
    
    // Store game data when it's received
    if (window.networkManager) {
        networkManager.on('onGameFound', (data) => {
            console.log('Storing game data for recovery if needed');
            lastGameData = {...data};
        });
    }
    
    // Check for stuck game state
    function checkGameState() {
        // Only run if we received game data but game isn't active
        if (lastGameData && 
            window.gameState && 
            !window.gameState.active && 
            !window.gameState.countdown &&
            recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
            
            console.warn(`Game appears stuck. Attempting recovery (attempt ${recoveryAttempts + 1})`);
            
            // Try to recover the game
            recoverGame();
            
            // Increment counter
            recoveryAttempts++;
        }
    }
    
    // Attempt to recover a stuck game
    function recoverGame() {
        // Make sure all screens are in the correct state
        const screens = ['startScreen', 'settingsMenu', 'gameOverScreen', 'countdownScreen'];
        screens.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) screen.classList.add('hidden');
        });
        
        // Hide online menu if it exists
        const onlineMenu = document.getElementById('onlineMenu');
        if (onlineMenu) onlineMenu.classList.add('hidden');
        
        // Hide matchmaking spinner
        const matchmaking = document.getElementById('matchmaking');
        if (matchmaking) matchmaking.classList.add('hidden');
        
        // Show notification
        if (window.networkUI) {
            window.networkUI.showToast('Recovering from stuck game...');
        }
        
        // Try to initialize game with last game data
        if (typeof initGame === 'function' && lastGameData) {
            try {
                initGame(true, lastGameData.playerNumber, lastGameData.mapSeed, lastGameData.tankPositions);
                
                // Start the game directly
                if (typeof startGame === 'function') {
                    // Show brief countdown
                    const countdownScreen = document.getElementById('countdownScreen');
                    if (countdownScreen) countdownScreen.classList.remove('hidden');
                    
                    // Skip countdown and start game
                    setTimeout(() => {
                        if (countdownScreen) countdownScreen.classList.add('hidden');
                        startGame();
                        
                        if (window.networkUI) {
                            window.networkUI.showToast('Game recovered');
                        }
                    }, 1000);
                }
            } catch (error) {
                console.error('Recovery failed:', error);
                
                if (window.networkUI) {
                    window.networkUI.showToast('Recovery failed. Please refresh the page.');
                }
            }
        }
    }
    
    // Add manual recovery button to document
    function addRecoveryButton() {
        const button = document.createElement('button');
        button.id = 'recovery-button';
        button.style.position = 'fixed';
        button.style.bottom = '10px';
        button.style.right = '10px';
        button.style.zIndex = '9999';
        button.style.background = '#e74c3c';
        button.style.color = 'white';
        button.style.padding = '8px 12px';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.display = 'none';
        button.textContent = 'Force Start Game';
        
        button.addEventListener('click', () => {
            recoverGame();
        });
        
        document.body.appendChild(button);
        
        // Show recovery button if the game is stuck for more than 15 seconds
        setTimeout(() => {
            if (lastGameData && 
                window.gameState && 
                !window.gameState.active && 
                !window.gameState.countdown) {
                button.style.display = 'block';
            }
        }, 15000);
    }
    
    // Start periodic check for game state
    const recoveryInterval = setInterval(checkGameState, RECOVERY_CHECK_INTERVAL);
    
    // Add recovery button when page loads
    window.addEventListener('load', addRecoveryButton);
    
    // Clear interval when page is unloaded
    window.addEventListener('beforeunload', () => {
        clearInterval(recoveryInterval);
    });
})();
