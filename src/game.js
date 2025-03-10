const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

const shootSound = document.getElementById('shootSound');
const hitSound = document.getElementById('hitSound');

const backgroundImg = new Image();
backgroundImg.src = 'background1.png';

const redTankImg = new Image();
redTankImg.src = 'red_tank.png';

const blueTankImg = new Image();
blueTankImg.src = 'blue_tank.png';

const obstacleImg = new Image();
obstacleImg.src = 'obstacle.png'; // Zorg dat je een obstakelafbeelding hebt genaamd "obstacle.png"

const obstacleSize = 60; // Grootte van elk obstakel in pixels
const gridSize = 11; // 11x11 grid

let tank1, tank2, bullets, gameOver, gameStarted, winner, flashTimer, obstacles, powerUps;

const POWER_UP_TYPES = {
    SHIELD: 'shield',
    RICOCHET: 'ricochet',
    PIERCING: 'piercing'
};

// Functie om obstakels te genereren
function generateObstacles() {
    for (let i = 0; i < 20; i++) { // Voeg 20 willekeurige obstakels toe
        let x = Math.floor(Math.random() * gridSize);
        let y = Math.floor(Math.random() * gridSize);

        if (!isPositionOccupiedByTank(x, y)) {
            obstacles[x][y] = true;
        }
    }
}

// Functie om te controleren of een positie door een tank is bezet
function isPositionOccupiedByTank(gridX, gridY) {
    if (!tank1 || !tank2) return false; // Controleer of tanks zijn geïnitialiseerd

    const tank1GridX = Math.floor(tank1.x / obstacleSize);
    const tank1GridY = Math.floor(tank1.y / obstacleSize);
    const tank2GridX = Math.floor(tank2.x / obstacleSize);
    const tank2GridY = Math.floor(tank2.y / obstacleSize);

    return (
        (gridX === tank1GridX && gridY === tank1GridY) ||
        (gridX === tank2GridX && gridY === tank2GridY)
    );
}

function drawObstacles() {
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            if (obstacles[x][y]) {
                ctx.drawImage(
                    obstacleImg,
                    x * obstacleSize,
                    y * obstacleSize,
                    obstacleSize,
                    obstacleSize
                );
            }
        }
    }
}

// Functie om het spel te resetten
function resetGame() {
    // Obstakels initialiseren
    obstacles = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

    // Stel een spawnlocatie in die niet op een obstakel staat
    function getSafeSpawn() {
        let x, y;
        do {
            x = Math.random() * (canvas.width - 50);
            y = Math.random() * (canvas.height - 50);
        } while (isCollidingWithObstacle(x, y));
        return { x, y };
    }

    // Tanks initialiseren
    const spawn1 = getSafeSpawn();
    const spawn2 = getSafeSpawn();

    tank1 = {
        x: spawn1.x,
        y: spawn1.y,
        width: 40,
        height: 40,
        angle: 0,
        speed: 2,
        sprite: blueTankImg,
        moving: { up: false, down: false, left: false, right: false },
        ammo: 4,
        reloadTime: 5,
        lives: 3,
        shield: false,
        ricochet: false,
        piercing: false,
        shieldTimer: 0
    };

    tank2 = {
        x: spawn2.x,
        y: spawn2.y,
        width: 40,
        height: 40,
        angle: 0,
        speed: 2,
        sprite: redTankImg,
        moving: { up: false, down: false, left: false, right: false },
        ammo: 4,
        reloadTime: 5,
        lives: 3,
        shield: false,
        ricochet: false,
        piercing: false,
        shieldTimer: 0
    };

    // Obstakels genereren nadat tanks zijn geïnitialiseerd
    generateObstacles();

    bullets = [];
    gameOver = false;
    winner = null;
    flashTimer = 0;
    gameStarted = false;
    powerUps = [];
    spawnPowerUp();
}

function spawnPowerUp() {
    const types = Object.values(POWER_UP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    
    let x, y;
    do {
        x = Math.random() * (canvas.width - 30);
        y = Math.random() * (canvas.height - 30);
    } while (isCollidingWithObstacle(x, y));

    powerUps.push({ x, y, type, size: 30 });
}

resetGame();

function drawStartingScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 48px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Tank Battle Arena", canvas.width / 2, canvas.height / 3);

    if (flashTimer % 60 < 30) {
        ctx.font = "24px Arial";
        ctx.fillStyle = "yellow";
        ctx.fillText("Press Enter to Start", canvas.width / 2, canvas.height / 2);
    }

    flashTimer++;
    if (!gameStarted) requestAnimationFrame(drawStartingScreen);
}

function isCollidingWithObstacle(x, y) {
    let gridX = Math.floor(x / obstacleSize);
    let gridY = Math.floor(y / obstacleSize);
    return obstacles[gridX]?.[gridY] || false;
}

// Functie om obstakels en tanks te tekenen
function drawBackground() {
    ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    drawObstacles(); // Obstakels tekenen
}

function drawTank(tank) {
    ctx.save();
    ctx.translate(tank.x + tank.width / 2, tank.y + tank.height / 2);
    ctx.rotate(tank.angle);
    ctx.drawImage(tank.sprite, -tank.width / 2, -tank.height / 2, tank.width, tank.height);
    ctx.restore();
}

function moveTank(tank) {
    let nextX = tank.x;
    let nextY = tank.y;

    if (tank.moving.up) {
        nextX += Math.cos(tank.angle) * tank.speed;
        nextY += Math.sin(tank.angle) * tank.speed;
    }
    if (tank.moving.down) {
        nextX -= Math.cos(tank.angle) * tank.speed;
        nextY -= Math.sin(tank.angle) * tank.speed;
    }

    if (!isCollidingWithObstacle(nextX, nextY)) {
        tank.x = nextX;
        tank.y = nextY;
    }

    if (tank.moving.left) tank.angle -= 0.05;
    if (tank.moving.right) tank.angle += 0.05;

    tank.x = Math.max(0, Math.min(canvas.width - tank.width, tank.x));
    tank.y = Math.max(0, Math.min(canvas.height - tank.height, tank.y));
}

function shootBullet(tank, owner) {
    if (tank.ammo <= 0) return;
    tank.ammo--;
    setTimeout(() => tank.ammo++, tank.reloadTime * 1000);

    shootSound.currentTime = 0;
    shootSound.play();

    let bullet = {
        x: tank.x + tank.width / 2,
        y: tank.y + tank.height / 2,
        size: 10,
        directionX: Math.cos(tank.angle),
        directionY: Math.sin(tank.angle),
        speed: 7,
        owner: owner,
        ricochet: tank.ricochet,
        piercing: tank.piercing
    };
    bullets.push(bullet);
}

function moveBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];
        let nextX = bullet.x + bullet.directionX * bullet.speed;
        let nextY = bullet.y + bullet.directionY * bullet.speed;

        if (isCollidingWithObstacle(nextX, nextY)) {
            if (bullet.ricochet) {
                // Implement ricochet logic
                if (isCollidingWithObstacle(nextX, bullet.y)) {
                    bullet.directionX *= -1;
                }
                if (isCollidingWithObstacle(bullet.x, nextY)) {
                    bullet.directionY *= -1;
                }
            } else if (!bullet.piercing) {
                bullets.splice(i, 1);
                continue;
            }
        }

        bullet.x = nextX;
        bullet.y = nextY;

        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }
}

function detectCollision() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];

        // Check collisions with tanks
        [tank1, tank2].forEach((tank, index) => {
            if (bullet.owner !== `tank${index + 1}` &&
                bullet.x < tank.x + tank.width &&
                bullet.x > tank.x &&
                bullet.y < tank.y + tank.height &&
                bullet.y > tank.y) {
                
                if (!tank.shield) {
                    tank.lives--;
                    hitSound.currentTime = 0;
                    hitSound.play();

                    if (tank.lives <= 0) {
                        gameOver = true;
                        winner = `Tank ${index === 0 ? 2 : 1} Wins!`;
                    } else {
                        respawnTank(tank);
                    }
                }
                
                bullets.splice(i, 1);
            }
        });

        // Check collisions with power-ups
        powerUps.forEach((powerUp, index) => {
            if (bullet.x < powerUp.x + powerUp.size &&
                bullet.x > powerUp.x &&
                bullet.y < powerUp.y + powerUp.size &&
                bullet.y > powerUp.y) {
                applyPowerUp(bullet.owner === 'tank1' ? tank1 : tank2, powerUp.type);
                powerUps.splice(index, 1);
                setTimeout(spawnPowerUp, 5000);
            }
        });
    }
}

function respawnTank(tank) {
    let spawn = getSafeSpawn();
    tank.x = spawn.x;
    tank.y = spawn.y;
    tank.shield = true;
    tank.shieldTimer = 3000; // 3 seconds of shield
    setTimeout(() => tank.shield = false, tank.shieldTimer);
}

function applyPowerUp(tank, type) {
    switch(type) {
        case POWER_UP_TYPES.SHIELD:
            tank.shield = true;
            setTimeout(() => tank.shield = false, 5000);
            break;
        case POWER_UP_TYPES.RICOCHET:
            tank.ricochet = true;
            setTimeout(() => tank.ricochet = false, 10000);
            break;
        case POWER_UP_TYPES.PIERCING:
            tank.piercing = true;
            setTimeout(() => tank.piercing = false, 8000);
            break;
    }
}

function drawGameOverScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 48px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(winner, canvas.width / 2, canvas.height / 3);

    if (flashTimer % 60 < 30) {
        ctx.font = "24px Arial";
        ctx.fillStyle = "yellow";
        ctx.fillText("Press Enter to Restart", canvas.width / 2, canvas.height / 2);
    }

    flashTimer++;
    requestAnimationFrame(drawGameOverScreen);
}

function draw() {
    if (gameOver) {
        drawGameOverScreen();
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawTank(tank1);
    drawTank(tank2);
    moveTank(tank1);
    moveTank(tank2);
    moveBullets();

    for (let bullet of bullets) {
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw power-ups
    powerUps.forEach(powerUp => {
        ctx.fillStyle = getPowerUpColor(powerUp.type);
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.size, powerUp.size);
    });

    detectCollision();
    drawUI();
    requestAnimationFrame(draw);
}

function drawUI() {
    // Draw lives
    ctx.font = "20px Arial";
    ctx.fillStyle = "blue";
    ctx.fillText(`P1 Lives: ${tank1.lives}`, 10, 30);
    ctx.fillStyle = "red";
    ctx.fillText(`P2 Lives: ${tank2.lives}`, canvas.width - 100, 30);

    // Draw active power-ups
    [tank1, tank2].forEach((tank, index) => {
        let y = 60;
        if (tank.shield) {
            ctx.fillStyle = "yellow";
            ctx.fillText("Shield", index === 0 ? 10 : canvas.width - 100, y);
        }
        if (tank.ricochet) {
            ctx.fillStyle = "orange";
            ctx.fillText("Ricochet", index === 0 ? 10 : canvas.width - 100, y + 25);
        }
        if (tank.piercing) {
            ctx.fillStyle = "purple";
            ctx.fillText("Piercing", index === 0 ? 10 : canvas.width - 100, y + 50);
        }
    });
}

function getPowerUpColor(type) {
    switch(type) {
        case POWER_UP_TYPES.SHIELD: return 'yellow';
        case POWER_UP_TYPES.RICOCHET: return 'orange';
        case POWER_UP_TYPES.PIERCING: return 'purple';
        default: return 'white';
    }
}

document.addEventListener('keydown', (e) => {
    if (!gameStarted && e.key === 'Enter') {
        gameStarted = true;
        draw();
        return;
    }

    if (gameOver && e.key === 'Enter') {
        resetGame();
        drawStartingScreen();
        return;
    }

    if (gameStarted && !gameOver) {
        if (e.key === 'w') tank1.moving.up = true;
        if (e.key === 's') tank1.moving.down = true;
        if (e.key === 'a') tank1.moving.left = true;
        if (e.key === 'd') tank1.moving.right = true;
        if (e.key === ' ') shootBullet(tank1, 'tank1');

        if (e.key === 'ArrowUp') tank2.moving.up = true;
        if (e.key === 'ArrowDown') tank2.moving.down = true;
        if (e.key === 'ArrowLeft') tank2.moving.left = true;
        if (e.key === 'ArrowRight') tank2.moving.right = true;
        if (e.key === '/') shootBullet(tank2, 'tank2');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w') tank1.moving.up = false;
    if (e.key === 's') tank1.moving.down = false;
    if (e.key === 'a') tank1.moving.left = false;
    if (e.key === 'd') tank1.moving.right = false;

    if (e.key === 'ArrowUp') tank2.moving.up = false;
    if (e.key === 'ArrowDown') tank2.moving.down = false;
    if (e.key === 'ArrowLeft') tank2.moving.left = false;
    if (e.key === 'ArrowRight') tank2.moving.right = false;
});

drawStartingScreen();
