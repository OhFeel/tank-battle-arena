// Debug overlay for network game troubleshooting
class DebugOverlay {
    constructor() {
        this.isVisible = false;
        this.element = null;
        this.networkStatus = {
            connected: false,
            latency: 0,
            syncStatus: 'Not synced'
        };
        
        this.createOverlay();
        this.bindToggle();
    }
    
    createOverlay() {
        // Create overlay element
        this.element = document.createElement('div');
        this.element.className = 'debug-overlay';
        this.element.innerHTML = `
            <h3>Debug Info</h3>
            <div class="debug-status">
                <div>Connection: <span id="debug-connection">Not connected</span></div>
                <div>Latency: <span id="debug-latency">0ms</span></div>
                <div>Sync: <span id="debug-sync">Not synced</span></div>
                <div>Player: <span id="debug-player">N/A</span></div>
                <div>Opponent: <span id="debug-opponent">N/A</span></div>
            </div>
            <div class="debug-tank-info">
                <div id="debug-tank1">Tank 1: x=0, y=0, angle=0</div>
                <div id="debug-tank2">Tank 2: x=0, y=0, angle=0</div>
            </div>
            <div class="debug-actions">
                <button id="debug-request-sync">Request Sync</button>
            </div>
        `;
        
        // Style the overlay
        const style = document.createElement('style');
        style.textContent = `
            .debug-overlay {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: #00ff00;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 1000;
                width: 300px;
                display: none;
                pointer-events: auto;
            }
            
            .debug-overlay h3 {
                margin: 0 0 8px 0;
                color: #3498db;
            }
            
            .debug-status {
                margin-bottom: 8px;
                padding: 5px;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .debug-status div {
                margin: 3px 0;
            }
            
            .debug-tank-info {
                margin-bottom: 8px;
                padding: 5px;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .debug-actions button {
                background: #3498db;
                border: none;
                color: white;
                padding: 5px;
                cursor: pointer;
                border-radius: 3px;
                margin-top: 5px;
            }
            
            .debug-actions button:hover {
                background: #2980b9;
            }
            
            .connected {
                color: #2ecc71;
            }
            
            .disconnected {
                color: #e74c3c;
            }
            
            .debug-overlay.visible {
                display: block;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(this.element);
        
        // Add action handlers
        document.getElementById('debug-request-sync').addEventListener('click', () => {
            if (window.networkManager) {
                window.networkManager.requestGameState();
            }
        });
    }
    
    bindToggle() {
        // Toggle visibility with F10
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F10') {
                this.toggleVisibility();
            }
        });
    }
    
    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.element.classList.toggle('visible', this.isVisible);
        
        if (this.isVisible) {
            this.updateState();
            this.startUpdates();
        } else {
            this.stopUpdates();
        }
    }
    
    startUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateState();
        }, 200);
    }
    
    stopUpdates() {
        clearInterval(this.updateInterval);
    }
    
    updateState() {
        if (!this.isVisible) return;
        
        // Get references to elements
        const connectionEl = document.getElementById('debug-connection');
        const latencyEl = document.getElementById('debug-latency');
        const syncEl = document.getElementById('debug-sync');
        const playerEl = document.getElementById('debug-player');
        const opponentEl = document.getElementById('debug-opponent');
        const tank1El = document.getElementById('debug-tank1');
        const tank2El = document.getElementById('debug-tank2');
        
        // Update network status if networkManager is available
        if (window.networkManager) {
            const nm = window.networkManager;
            
            connectionEl.textContent = nm.connected ? 'Connected' : 'Disconnected';
            connectionEl.className = nm.connected ? 'connected' : 'disconnected';
            
            latencyEl.textContent = `${nm.latency}ms`;
            
            syncEl.textContent = nm.initialized ? 'Synchronized' : 'Not synchronized';
            syncEl.className = nm.initialized ? 'connected' : 'disconnected';
            
            playerEl.textContent = nm.playerNumber ? `Player ${nm.playerNumber}` : 'N/A';
            opponentEl.textContent = nm.opponentName || 'N/A';
        }
        
        // Update tank info if tanks are available
        if (window.tanks && window.tanks.length > 0) {
            const formatTank = (tank, index) => {
                const angleStr = (tank.angle * 180 / Math.PI).toFixed(1);
                return `Tank ${index + 1}: x=${Math.floor(tank.x)}, y=${Math.floor(tank.y)}, angle=${angleStr}°`;
            };
            
            if (tanks[0]) tank1El.textContent = formatTank(tanks[0], 0);
            if (tanks[1]) tank2El.textContent = formatTank(tanks[1], 1);
        }
    }
}

// Initialize debug overlay when page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.debugOverlay = new DebugOverlay();
    console.log('Debug overlay initialized. Press F10 to toggle.');
});