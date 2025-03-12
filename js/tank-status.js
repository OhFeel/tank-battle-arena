/**
 * Tank Status UI Manager
 * Displays and updates the tank power-up statuses on the screen
 */

class TankStatusUI {
    constructor() {
        // Store references to UI elements
        this.p1Status = document.getElementById('p1Status');
        this.p2Status = document.getElementById('p2Status');
        
        this.p1Lives = document.getElementById('p1Lives');
        this.p2Lives = document.getElementById('p2Lives');
        
        this.p1Ammo = document.getElementById('p1Ammo');
        this.p2Ammo = document.getElementById('p2Ammo');
        
        this.p1PowerUps = document.getElementById('p1PowerUps');
        this.p2PowerUps = document.getElementById('p2PowerUps');
        
        // Map of power-up types to maximum durations (in ms)
        this.maxDurations = {
            shield: 5000,
            speedBoost: 8000,
            rapidFire: 5000,
            magneticShield: 7000,
            invisibility: 5000,
            empActive: 3000
        };

        // Initialize UI
        this.init();
    }

    init() {
        // Hide the UI initially, will show when game starts
        if (this.p1Status) this.p1Status.style.opacity = '0';
        if (this.p2Status) this.p2Status.style.opacity = '0';
    }

    show() {
        // Show both tank status panels with fade-in effect
        if (this.p1Status) {
            this.p1Status.style.opacity = '1';
            // Don't change transform for initial show - keep it outside
        }
        if (this.p2Status) {
            this.p2Status.style.opacity = '1';
            // Don't change transform for initial show - keep it outside
        }
    }

    hide() {
        // Hide both tank status panels
        if (this.p1Status) {
            this.p1Status.style.opacity = '0';
        }
        if (this.p2Status) {
            this.p2Status.style.opacity = '0';
        }
    }

    updateTankStatus(tank, playerNum) {
        // Select the right status panel and elements
        const statusPanel = playerNum === 1 ? this.p1Status : this.p2Status;
        const livesElement = playerNum === 1 ? this.p1Lives : this.p2Lives;
        const ammoElement = playerNum === 1 ? this.p1Ammo : this.p2Ammo;
        const powerUpsPanel = playerNum === 1 ? this.p1PowerUps : this.p2PowerUps;
        
        if (!statusPanel || !livesElement || !ammoElement || !powerUpsPanel) return;
        
        // Update lives
        livesElement.textContent = tank.lives;
        
        // Update ammo with progress bar instead of number
        this.updateAmmoDisplay(ammoElement, tank.ammo, tank.maxAmmo);
        
        // Update power-ups
        this.updatePowerUpUI(powerUpsPanel, 'shield', tank.shield, tank.shieldTimer, this.maxDurations.shield);
        
        // Update count-based power-ups with progress bars
        this.updateCountBasedPowerUp(powerUpsPanel, 'ricochet', tank.ricochetBullets > 0, tank.ricochetBullets, 3);
        this.updateCountBasedPowerUp(powerUpsPanel, 'piercing', tank.piercingBullets > 0, tank.piercingBullets, 3);
        
        // Update mines with colored indicator instead of number
        this.updateMineStatus(powerUpsPanel, 'mines', tank.mines > 0, tank.mines);
        
        this.updatePowerUpUI(powerUpsPanel, 'speedBoost', tank.speedBoost, tank.speedBoostTimer, this.maxDurations.speedBoost);
        this.updatePowerUpUI(powerUpsPanel, 'rapidFire', tank.rapidFire, tank.rapidFireTimer, this.maxDurations.rapidFire);
        this.updatePowerUpUI(powerUpsPanel, 'magneticShield', tank.magneticShield, tank.magneticShieldTimer, this.maxDurations.magneticShield);
        this.updatePowerUpUI(powerUpsPanel, 'invisibility', tank.invisibility, tank.invisibilityTimer, this.maxDurations.invisibility);
        this.updatePowerUpUI(powerUpsPanel, 'empActive', tank.empActive, tank.empTimer, this.maxDurations.empActive);
        
        // Special cases for power-ups without timers
        this.updateSpreadShotStatus(powerUpsPanel, 'spreadShot', tank.spreadShot > 0, tank.spreadShot, 3);
        
        this.updatePowerUpUI(powerUpsPanel, 'megaBullet', tank.megaBullet, null, null);
        this.updatePowerUpUI(powerUpsPanel, 'homingMissile', tank.homingMissile, null, null);
    }

    // New method to display ammo as progress steps
    updateAmmoDisplay(ammoElement, ammo, maxAmmo) {
        // Clear current content
        ammoElement.innerHTML = '';
        
        // Calculate percentage for each step
        const stepPercent = 100 / maxAmmo;
        
        // Create progress bar container
        const progressBar = document.createElement('div');
        progressBar.className = 'ammo-progress-bar';
        
        // Create steps
        for (let i = 0; i < maxAmmo; i++) {
            const step = document.createElement('div');
            step.className = 'ammo-step';
            
            // Active class for filled ammo
            if (i < ammo) {
                step.classList.add('active');
            }
            
            progressBar.appendChild(step);
        }
        
        ammoElement.appendChild(progressBar);
    }

    // New method for count-based power-ups with progress bars
    updateCountBasedPowerUp(panel, type, isActive, count, maxCount) {
        const powerUpElement = panel.querySelector(`[data-type="${type}"]`);
        if (!powerUpElement) return;
        
        // Update active state
        if (isActive && count > 0) {
            powerUpElement.classList.add('active');
            
            // Create or update progress bar
            let progressBar = powerUpElement.querySelector('.count-progress-bar');
            if (!progressBar) {
                // Create the progress bar structure if it doesn't exist
                const progressContainer = document.createElement('div');
                progressContainer.className = 'count-progress-container';
                
                progressBar = document.createElement('div');
                progressBar.className = 'count-progress-bar';
                
                progressContainer.appendChild(progressBar);
                powerUpElement.appendChild(progressContainer);
            }
            
            // Update the progress bar width
            const percentage = (count / maxCount) * 100;
            progressBar.style.width = `${percentage}%`;
            
            // Display the count as text
            let countElement = powerUpElement.querySelector('.power-up-count');
            if (!countElement) {
                countElement = document.createElement('div');
                countElement.className = 'power-up-count';
                powerUpElement.appendChild(countElement);
            }
            
            countElement.textContent = count;
        } else {
            powerUpElement.classList.remove('active');
            
            // Remove progress bar if it exists
            const progressContainer = powerUpElement.querySelector('.count-progress-container');
            if (progressContainer) {
                progressContainer.remove();
            }
            
            // Remove count element if it exists
            const countElement = powerUpElement.querySelector('.power-up-count');
            if (countElement) {
                countElement.remove();
            }
        }
    }

    // New method for mine status that uses color intensity instead of count number
    updateMineStatus(panel, type, isActive, count) {
        const powerUpElement = panel.querySelector(`[data-type="${type}"]`);
        if (!powerUpElement) return;
        
        // Update active state
        if (isActive && count > 0) {
            powerUpElement.classList.add('active');
            
            // Set opacity based on count (brighter = more mines)
            const intensityFactor = Math.min(1.0, 0.4 + (count / 3) * 0.6);
            powerUpElement.style.opacity = intensityFactor;
            
            // Create or update progress bar
            let progressBar = powerUpElement.querySelector('.count-progress-bar');
            if (!progressBar) {
                // Create the progress bar structure if it doesn't exist
                const progressContainer = document.createElement('div');
                progressContainer.className = 'count-progress-container';
                
                progressBar = document.createElement('div');
                progressBar.className = 'count-progress-bar';
                
                progressContainer.appendChild(progressBar);
                powerUpElement.appendChild(progressContainer);
            }
            
            // Update the progress bar width
            const percentage = (count / 3) * 100; // Assuming max is 3 mines
            progressBar.style.width = `${percentage}%`;
            
            // Remove any count element if it exists
            const countElement = powerUpElement.querySelector('.power-up-count');
            if (countElement) {
                countElement.remove();
            }
        } else {
            powerUpElement.classList.remove('active');
            powerUpElement.style.opacity = '0.3'; // Reset to default inactive opacity
            
            // Remove progress bar if it exists
            const progressContainer = powerUpElement.querySelector('.count-progress-container');
            if (progressContainer) {
                progressContainer.remove();
            }
            
            // Remove count element if it exists
            const countElement = powerUpElement.querySelector('.power-up-count');
            if (countElement) {
                countElement.remove();
            }
        }
    }

    // New method for spread shots that hides the number
    updateSpreadShotStatus(panel, type, isActive, count, maxCount) {
        const powerUpElement = panel.querySelector(`[data-type="${type}"]`);
        if (!powerUpElement) return;
        
        // Update active state
        if (isActive && count > 0) {
            powerUpElement.classList.add('active');
            
            // Create or update progress bar
            let progressBar = powerUpElement.querySelector('.count-progress-bar');
            if (!progressBar) {
                // Create the progress bar structure if it doesn't exist
                const progressContainer = document.createElement('div');
                progressContainer.className = 'count-progress-container';
                
                progressBar = document.createElement('div');
                progressBar.className = 'count-progress-bar';
                
                progressContainer.appendChild(progressBar);
                powerUpElement.appendChild(progressContainer);
            }
            
            // Update the progress bar width
            const percentage = (count / maxCount) * 100;
            progressBar.style.width = `${percentage}%`;
            
            // Remove any count element if it exists
            const countElement = powerUpElement.querySelector('.power-up-count');
            if (countElement) {
                countElement.remove();
            }
        } else {
            powerUpElement.classList.remove('active');
            
            // Remove progress bar if it exists
            const progressContainer = powerUpElement.querySelector('.count-progress-container');
            if (progressContainer) {
                progressContainer.remove();
            }
            
            // Remove count element if it exists
            const countElement = powerUpElement.querySelector('.power-up-count');
            if (countElement) {
                countElement.remove();
            }
        }
    }

    updatePowerUpUI(panel, type, isActive, currentTimer, maxDuration, count = null) {
        const powerUpElement = panel.querySelector(`[data-type="${type}"]`);
        if (!powerUpElement) return;
        
        // Update active state
        if (isActive) {
            powerUpElement.classList.add('active');
            
            // If we have a count, show it
            if (count !== null && count > 0) {
                const countElement = powerUpElement.querySelector('.power-up-count');
                if (!countElement) {
                    const newCountElement = document.createElement('div');
                    newCountElement.className = 'power-up-count';
                    newCountElement.textContent = count;
                    powerUpElement.appendChild(newCountElement);
                } else {
                    countElement.textContent = count;
                }
            }
        } else {
            powerUpElement.classList.remove('active');
            
            // Remove count element if it exists
            const countElement = powerUpElement.querySelector('.power-up-count');
            if (countElement) {
                countElement.remove();
            }
        }
        
        // Update timer bar if applicable
        if (currentTimer && maxDuration) {
            const timerBar = powerUpElement.querySelector('.power-up-timer-bar');
            if (timerBar) {
                const percentage = (currentTimer / maxDuration) * 100;
                timerBar.style.width = `${percentage}%`;
            }
        }
    }
}

// Create global instance
window.tankStatusUI = new TankStatusUI();
