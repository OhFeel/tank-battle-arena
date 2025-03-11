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
            ricochet: 10000,
            piercing: 8000,
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
        
        // Update lives and ammo
        livesElement.textContent = tank.lives;
        ammoElement.textContent = tank.ammo;
        
        // Update power-ups
        this.updatePowerUpUI(powerUpsPanel, 'shield', tank.shield, tank.shieldTimer, this.maxDurations.shield);
        this.updatePowerUpUI(powerUpsPanel, 'ricochet', tank.ricochet, tank.ricochetTimer, this.maxDurations.ricochet);
        this.updatePowerUpUI(powerUpsPanel, 'piercing', tank.piercing, tank.piercingTimer, this.maxDurations.piercing);
        this.updatePowerUpUI(powerUpsPanel, 'speedBoost', tank.speedBoost, tank.speedBoostTimer, this.maxDurations.speedBoost);
        this.updatePowerUpUI(powerUpsPanel, 'rapidFire', tank.rapidFire, tank.rapidFireTimer, this.maxDurations.rapidFire);
        this.updatePowerUpUI(powerUpsPanel, 'magneticShield', tank.magneticShield, tank.magneticShieldTimer, this.maxDurations.magneticShield);
        this.updatePowerUpUI(powerUpsPanel, 'invisibility', tank.invisibility, tank.invisibilityTimer, this.maxDurations.invisibility);
        this.updatePowerUpUI(powerUpsPanel, 'empActive', tank.empActive, tank.empTimer, this.maxDurations.empActive);
        
        // Special cases for power-ups without timers
        this.updatePowerUpUI(powerUpsPanel, 'spreadShot', tank.spreadShot > 0, null, null);
        this.updatePowerUpUI(powerUpsPanel, 'mines', tank.mines > 0, null, null);
        this.updatePowerUpUI(powerUpsPanel, 'megaBullet', tank.megaBullet, null, null);
        this.updatePowerUpUI(powerUpsPanel, 'homingMissile', tank.homingMissile, null, null);
    }

    updatePowerUpUI(panel, type, isActive, currentTimer, maxDuration) {
        const powerUpElement = panel.querySelector(`[data-type="${type}"]`);
        if (!powerUpElement) return;
        
        // Update active state
        if (isActive) {
            powerUpElement.classList.add('active');
        } else {
            powerUpElement.classList.remove('active');
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
