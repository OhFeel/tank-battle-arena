/**
 * Victory Screen Manager
 * Handles the enhanced game over screen with 3D effects and detailed stats
 */

class VictoryScreen {
    constructor() {
        this.container = document.getElementById('victoryScreen');
        this.confetti = [];
        this.confettiColors = [
            '#f94144', '#f3722c', '#f8961e', '#f9c74f', 
            '#90be6d', '#43aa8b', '#577590', '#277da1'
        ];
        this.stats = {};
        this.gameData = null;
    }

    // Initialize the victory screen with game data
    initialize(gameData) {
        this.gameData = gameData;
        
        // Create container if it doesn't exist
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'victoryScreen';
            this.container.className = 'victory-screen hidden';
            document.querySelector('.game-container').appendChild(this.container);
        }

        // Load CSS if not already loaded
        if (!document.getElementById('victory-screen-css')) {
            const link = document.createElement('link');
            link.id = 'victory-screen-css';
            link.rel = 'stylesheet';
            link.href = 'css/victory-screen.css';
            document.head.appendChild(link);
        }

        // Set up event listeners
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // Precompute stats
        this.computeStats();
    }

    // Show the victory screen with the given winner
    show(winningPlayer) {
        // Create content
        this.buildContent(winningPlayer);
        
        // Show the screen
        this.container.classList.remove('hidden');
        
        // Start confetti
        this.startConfetti();
        
        // Play victory sound
        const victorySound = document.getElementById('victorySound');
        if (victorySound) {
            victorySound.volume = 0.7;
            victorySound.play().catch(e => console.log("Couldn't play victory sound"));
        }
        
        // Return a promise that resolves when animations are complete
        return new Promise(resolve => {
            setTimeout(resolve, 1500);
        });
    }

    // Hide the victory screen
    hide() {
        this.container.classList.add('hidden');
        this.stopConfetti();
    }

    // Build the content of the victory screen
    buildContent(winningPlayer) {
        const playerColor = winningPlayer === 1 ? '#3498db' : '#e74c3c';
        const losingPlayer = winningPlayer === 1 ? 2 : 1;
        
        const content = `
            <div class="victory-content">
                <div class="stage-floor"></div>
                
                <div class="trophy">
                    <div class="trophy-cup">
                        <div class="trophy-highlight"></div>
                    </div>
                    <div class="trophy-stem"></div>
                    <div class="trophy-base"></div>
                </div>
                
                <h1 class="victory-title">Player ${winningPlayer} Wins!</h1>
                
                <div class="winner-display">
                    <div class="winner-tank">
                        <div class="tank-body" style="background-color: ${playerColor}">
                            <div class="tank-turret"></div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-container">
                    <div class="stats-column">
                        <h3 class="stats-heading">Player ${winningPlayer} Stats</h3>
                        <div class="stat-item">
                            <span class="stat-label">Shots Fired:</span>
                            <span class="stat-value">${this.stats[`p${winningPlayer}ShotsFired`] || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Power-ups Collected:</span>
                            <span class="stat-value">${this.stats[`p${winningPlayer}PowerupsCollected`] || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Hit Ratio:</span>
                            <span class="stat-value">${this.stats[`p${winningPlayer}HitRatio`] || '0%'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Damage Dealt:</span>
                            <span class="stat-value">${this.stats[`p${winningPlayer}DamageDealt`] || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Lives Remaining:</span>
                            <span class="stat-value">${this.stats[`p${winningPlayer}LivesRemaining`] || 0}</span>
                        </div>
                    </div>
                    
                    <div class="stats-column">
                        <h3 class="stats-heading">Player ${losingPlayer} Stats</h3>
                        <div class="stat-item">
                            <span class="stat-label">Shots Fired:</span>
                            <span class="stat-value">${this.stats[`p${losingPlayer}ShotsFired`] || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Power-ups Collected:</span>
                            <span class="stat-value">${this.stats[`p${losingPlayer}PowerupsCollected`] || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Hit Ratio:</span>
                            <span class="stat-value">${this.stats[`p${losingPlayer}HitRatio`] || '0%'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Damage Dealt:</span>
                            <span class="stat-value">${this.stats[`p${losingPlayer}DamageDealt`] || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Lives Remaining:</span>
                            <span class="stat-value">0</span>
                        </div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button id="victoryRestartButton" class="victory-button">Play Again</button>
                    <button id="victoryMenuButton" class="victory-button">Main Menu</button>
                </div>
            </div>
        `;
        
        this.container.innerHTML = content;
        
        // Add event listeners to buttons
        document.getElementById('victoryRestartButton').addEventListener('click', () => {
            this.hide();
            restartButton.click(); // Use the original game's restart button
        });
        
        document.getElementById('victoryMenuButton').addEventListener('click', () => {
            this.hide();
            menuButton.click(); // Use the original game's menu button
        });
    }

    // Handle mouse movement for 3D effect
    handleMouseMove(event) {
        if (this.container.classList.contains('hidden')) return;
        
        const content = this.container.querySelector('.victory-content');
        if (!content) return;
        
        // Get container dimensions and mouse position
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Calculate rotation and perspective based on mouse position
        const rotateY = (event.clientX - centerX) / (rect.width / 2) * 5;
        const rotateX = (event.clientY - centerY) / (rect.height / 2) * -5;
        
        // Apply 3D transform
        content.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }
    
    // Create confetti effect
    startConfetti() {
        // Create 50 confetti pieces
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                this.createConfettiPiece();
            }, i * 100);
        }
    }
    
    createConfettiPiece() {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random properties
        const size = 5 + Math.random() * 10;
        const color = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)];
        const left = Math.random() * 100;
        const duration = 3 + Math.random() * 4;
        
        // Apply styles
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.backgroundColor = color;
        confetti.style.left = `${left}%`;
        confetti.style.animationDuration = `${duration}s`;
        
        // Add to container
        this.container.appendChild(confetti);
        this.confetti.push(confetti);
        
        // Remove after animation is complete
        setTimeout(() => {
            confetti.remove();
            this.confetti = this.confetti.filter(c => c !== confetti);
        }, duration * 1000);
    }
    
    stopConfetti() {
        this.confetti.forEach(confetti => confetti.remove());
        this.confetti = [];
    }
    
    // Compute additional statistics
    computeStats() {
        // Use the existing stats and tanks data
        const p1ShotsFired = this.gameData?.stats?.p1ShotsFired || 0;
        const p2ShotsFired = this.gameData?.stats?.p2ShotsFired || 0;
        
        // Calculate hit ratio (approximate based on lives lost)
        const p1HitRatio = p1ShotsFired > 0 ? Math.min(100, Math.round((2/p1ShotsFired) * 100)) : 0;
        const p2HitRatio = p2ShotsFired > 0 ? Math.min(100, Math.round((2/p2ShotsFired) * 100)) : 0;
        
        // Get other stats from the game
        const p1PowerupsCollected = this.gameData?.stats?.p1PowerupsCollected || 0;
        const p2PowerupsCollected = this.gameData?.stats?.p2PowerupsCollected || 0;
        
        // Lives remaining - need to get from tanks array
        const p1LivesRemaining = this.gameData?.tanks?.[0]?.lives || 0;
        const p2LivesRemaining = this.gameData?.tanks?.[1]?.lives || 0;
        
        // Calculate damage dealt (for the demo, estimate based on lives) 
        const p1DamageDealt = 3 - p2LivesRemaining;
        const p2DamageDealt = 3 - p1LivesRemaining;
        
        // Store computed stats
        this.stats = {
            p1ShotsFired,
            p2ShotsFired,
            p1PowerupsCollected,
            p2PowerupsCollected,
            p1HitRatio: p1HitRatio + '%',
            p2HitRatio: p2HitRatio + '%',
            p1DamageDealt,
            p2DamageDealt,
            p1LivesRemaining,
            p2LivesRemaining
        };
    }
}

// Create and export the victory screen instance
const victoryScreen = new VictoryScreen();
