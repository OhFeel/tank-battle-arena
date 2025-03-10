// UI components for network status and notifications

class NetworkUI {
    /* ...existing code... */
    
    // Add a method to force game start if it gets stuck
    forceGameStart(gameData) {
        console.log('Force starting game with data:', gameData);
        
        // Hide matchmaking UI
        const onlineMenu = document.getElementById('onlineMenu');
        const matchmaking = document.getElementById('matchmaking');
        if (onlineMenu) onlineMenu.classList.add('hidden');
        if (matchmaking) matchmaking.classList.add('hidden');
        
        // Initialize game if we have the necessary data
        if (gameData && typeof initGame === 'function') {
            initGame(true, gameData.playerNumber, gameData.mapSeed, gameData.tankPositions);
            
            // Show countdown
            if (typeof showCountdown === 'function') {
                showCountdown();
            }
            
            this.showToast('Game started manually');
        } else {
            this.showToast('Could not start game: missing data');
        }
    }
    
    addStatusToMatchmaking() {
        const matchmaking = document.getElementById('matchmaking');
        if (!matchmaking) return;
        
        // Only add if it doesn't already exist
        if (!document.getElementById('matchmaking-status')) {
            const statusDiv = document.createElement('div');



































    window.networkUI = new NetworkUI();document.addEventListener('DOMContentLoaded', () => {// Initialize with a timeout check for stuck games}    /* ...existing code... */        }        }            span.textContent = 'Connecting to server...';            dot.className = 'status-dot status-disconnected';        } else {            span.textContent = 'Connected - Finding opponent...';            dot.className = 'status-dot status-connected';        if (window.networkManager && window.networkManager.connected) {                const span = statusDiv.querySelector('span');        const dot = statusDiv.querySelector('.status-dot');                if (!statusDiv) return;        const statusDiv = document.getElementById('matchmaking-status');    updateMatchmakingStatus() {        }        this.updateMatchmakingStatus();                }            matchmaking.appendChild(statusDiv);            `;                <span>Connecting to server...</span>                <div class="status-dot"></div>            statusDiv.innerHTML = `            statusDiv.className = 'matchmaking-status';            statusDiv.id = 'matchmaking-status';    // Add safety timeout for game start
    if (window.networkManager) {
        networkManager.on('onGameFound', (gameData) => {
            // Set a safety timeout - if the game doesn't start in 5 seconds, try to force start
            setTimeout(() => {
                const countdownScreen = document.getElementById('countdownScreen');
                const onlineMenu = document.getElementById('onlineMenu');
                
                // If countdown screen is not visible but online menu is hidden,
                // the game probably got stuck in loading
                if (countdownScreen && onlineMenu && 
                    countdownScreen.classList.contains('hidden') && 
                    onlineMenu.classList.contains('hidden')) {
                    
                    console.warn('Game appears stuck in loading, attempting to force start');
                    if (window.networkUI) {
                        window.networkUI.forceGameStart(gameData);
                    }
                }
            }, 5000);
        });
    }
}
    )
}}}
