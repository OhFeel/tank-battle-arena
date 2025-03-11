/**
 * Victory Screen
 * Creates an animated victory celebration screen with stats and effects
 */

class VictoryScreen {
    constructor() {
        this.container = document.getElementById('victoryScreen');
        this.gameData = null;
        this.confetti = [];
        this.stars = [];
        this.confettiColors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
            '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
            '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
            '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
        ];
    }

    initialize(gameData) {
        this.gameData = gameData;
        
        // Clean up any existing content
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    show(winningPlayer) {
        if (!this.container) return;
        
        // Create victory content
        this.createContent(winningPlayer);
        
        // Show the container
        this.container.classList.remove('hidden');
        
        // Play victory sound
        const victorySound = document.getElementById('victorySound');
        if (victorySound) {
            victorySound.play().catch(err => console.warn('Could not play victory sound:', err));
        }
        
        // Generate effects
        this.generateConfetti();
        this.generateStars();
        this.startAnimation();
    }

    hide() {
        if (!this.container) return;
        this.container.classList.add('hidden');
        
        // Clean up animations
        this.stopAnimation();
    }

    createContent(winningPlayer) {
        if (!this.gameData) return;
        
        const winner = this.gameData.winner || winningPlayer;
        const p1 = this.gameData.tanks && this.gameData.tanks[0];
        const p2 = this.gameData.tanks && this.gameData.tanks[1];
        const stats = this.gameData.stats || {
            p1ShotsFired: 0,
            p2ShotsFired: 0,
            p1PowerupsCollected: 0,
            p2PowerupsCollected: 0
        };

        // Add ribbons for decoration
        const leftRibbon = document.createElement('div');
        leftRibbon.className = 'ribbon left';
        this.container.appendChild(leftRibbon);
        
        const rightRibbon = document.createElement('div');
        rightRibbon.className = 'ribbon right';
        this.container.appendChild(rightRibbon);
        
        // Create a star background container
        const starContainer = document.createElement('div');
        starContainer.className = 'star-container';
        this.container.appendChild(starContainer);
        
        // Trophy animation
        const trophy = document.createElement('div');
        trophy.className = 'trophy-animation';
        trophy.innerHTML = '🏆';
        this.container.appendChild(trophy);
        
        // Main content container
        const content = document.createElement('div');
        content.className = 'victory-content';
        
        // Victory title
        const title = document.createElement('h1');
        title.className = `victory-title ${winner === 1 ? 'p1-win' : 'p2-win'} glow-effect`;
        title.textContent = `Player ${winner} Wins!`;
        content.appendChild(title);
        
        // Add medals/decoration
        const medalDiv = document.createElement('div');
        medalDiv.className = 'medal-container';
        
        const medal = document.createElement('div');
        medal.className = 'medal';
        medalDiv.appendChild(medal);
        
        content.appendChild(medalDiv);
        
        // Stats section
        const statsDiv = document.createElement('div');
        statsDiv.className = 'victory-stats';
        
        const statsTitle = document.createElement('h3');
        statsTitle.textContent = 'Battle Statistics';
        statsDiv.appendChild(statsTitle);
        
        // Create stat cards
        const createStatCard = (value, label) => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            
            const statValue = document.createElement('div');
            statValue.className = 'stat-value';
            statValue.textContent = value;
            card.appendChild(statValue);
            
            const statLabel = document.createElement('div');
            statLabel.className = 'stat-label';
            statLabel.textContent = label;
            card.appendChild(statLabel);
            
            return card;
        };
        
        // Add stat cards for winning player
        const winnerStats = winner === 1 ? 
            { shots: stats.p1ShotsFired, powerups: stats.p1PowerupsCollected } : 
            { shots: stats.p2ShotsFired, powerups: stats.p2PowerupsCollected };
        
        statsDiv.appendChild(createStatCard(winnerStats.shots, 'Shots Fired'));
        statsDiv.appendChild(createStatCard(winnerStats.powerups, 'Power-ups Collected'));
        
        const winnerLives = winner === 1 ? (p1 ? p1.lives : '?') : (p2 ? p2.lives : '?');
        statsDiv.appendChild(createStatCard(winnerLives, 'Lives Remaining'));
        
        // Calculate accuracy if we have meaningful stats
        if (winnerStats.shots > 0) {
            // Simple approximation: assume each hit reduced opponent's lives by 1
            const opponentMaxLives = 3; // Based on the tank class definition
            const hits = opponentMaxLives - 0; // Opponent has 0 lives left
            const accuracy = Math.round((hits / winnerStats.shots) * 100);
            
            statsDiv.appendChild(createStatCard(accuracy + '%', 'Accuracy'));
        } else {
            statsDiv.appendChild(createStatCard('N/A', 'Accuracy'));
        }
        
        content.appendChild(statsDiv);
        
        // Action buttons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'victory-buttons';
        
        const playAgainBtn = document.createElement('button');
        playAgainBtn.className = 'victory-button';
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.addEventListener('click', () => {
            this.hide();
            
            // Reset game state
            if (window.gameState) {
                window.gameState.over = false;
            }
            
            // Reset and restart the game
            if (typeof initGame === 'function' && typeof showCountdown === 'function') {
                initGame();
                setTimeout(showCountdown, 500);
            }
        });
        buttonsDiv.appendChild(playAgainBtn);
        
        const menuBtn = document.createElement('button');
        menuBtn.className = 'victory-button';
        menuBtn.textContent = 'Main Menu';
        menuBtn.addEventListener('click', () => {
            this.hide();
            
            // Return to main menu
            if (typeof showStartScreen === 'function') {
                showStartScreen();
            }
        });
        buttonsDiv.appendChild(menuBtn);
        
        content.appendChild(buttonsDiv);
        
        // Add content to container
        this.container.appendChild(content);
    }

    generateConfetti() {
        // Clear existing confetti
        this.confetti = [];
        
        // Create confetti pieces
        const confettiCount = 100;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.backgroundColor = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)];
            this.container.appendChild(confetti);
            
            // Store confetti element with its animation properties
            this.confetti.push({
                element: confetti,
                x: Math.random() * window.innerWidth,
                y: -20 - Math.random() * 100,
                size: 5 + Math.random() * 10,
                rotation: Math.random() * 360,
                speed: 1 + Math.random() * 3,
                rotationSpeed: (Math.random() - 0.5) * 10,
                wobble: Math.random() * 10,
                wobbleSpeed: Math.random() * 0.1
            });
        }
    }

    generateStars() {
        // Clear existing stars
        this.stars = [];
        
        const starContainer = this.container.querySelector('.star-container');
        if (!starContainer) return;
        
        // Create star elements
        const starCount = 100;
        
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            starContainer.appendChild(star);
            
            // Set initial position
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            star.style.left = `${x}px`;
            star.style.top = `${y}px`;
            
            // Set random size and opacity
            const size = Math.random() * 3 + 1;
            const opacity = Math.random() * 0.7 + 0.3;
            
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.opacity = opacity;
            
            // Add twinkle animation with random delay
            star.style.animation = `glow ${2 + Math.random() * 3}s infinite alternate`;
            star.style.animationDelay = `${Math.random() * 5}s`;
            
            this.stars.push(star);
        }
    }

    startAnimation() {
        // Cancel any existing animation
        this.stopAnimation();
        
        // Start the animation loop
        this.animationId = requestAnimationFrame(this.animate.bind(this));
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate() {
        // Animate confetti falling
        for (const item of this.confetti) {
            item.y += item.speed;
            item.rotation += item.rotationSpeed;
            item.x += Math.sin(item.y * item.wobbleSpeed) * item.wobble;
            
            // Apply styles
            item.element.style.opacity = '1';
            item.element.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`;
            item.element.style.width = `${item.size}px`;
            item.element.style.height = `${item.size}px`;
            
            // Reset confetti that goes off screen
            if (item.y > window.innerHeight) {
                item.y = -20;
                item.x = Math.random() * window.innerWidth;
            }
        }
        
        // Continue the animation loop
        this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
}

// Create global instance
window.victoryScreen = new VictoryScreen();
