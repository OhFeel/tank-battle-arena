const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Game state management
const games = new Map();
const waitingPlayers = [];

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// WebSocket connection handling
wss.on('connection', (ws) => {
    // Assign unique ID to player connection
    const playerId = uuidv4();
    console.log(`Player connected: ${playerId}`);
    
    // Set up message handling
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleMessage(ws, playerId, data);
    });
    
    // Handle disconnection
    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        handlePlayerDisconnect(playerId);
    });
    
    // Initial player setup
    ws.playerId = playerId;
    ws.send(JSON.stringify({
        type: 'connected',
        id: playerId
    }));
});

// Message handler
function handleMessage(ws, playerId, data) {
    switch(data.type) {
        case 'find_game':
            findGame(ws, playerId, data.name);
            break;
            
        case 'game_input':
            forwardGameInput(playerId, data);
            break;
            
        case 'sync_state':
            forwardTankState(playerId, data);
            break;
            
        case 'game_state':
            syncGameState(playerId, data.gameId, data.state);
            break;
            
        case 'cancel_matchmaking':
            cancelMatchmaking(playerId);
            break;
            
        case 'ping':
            handlePing(ws, data);
            break;
            
        case 'map_initialized':
            syncMapData(playerId, data.gameId, data.obstacles);
            break;
            
        case 'spawn_powerup':
            handlePowerUpSpawn(playerId, data.gameId, data.powerUp);
            break;

        case 'request_game_state':
            sendInitialGameState(playerId, data.gameId);
            break;
        
        case 'verify_sync':
            verifySyncState(playerId, data.gameId, data.syncData);
            break;

        case 'collect_powerup':
            handlePowerUpCollection(data.gameId, data.playerIndex, data.powerUpIndex);
            break;
    }
}

// Find an available game or create one
function findGame(ws, playerId, playerName) {
    // Remove player from waiting list if already there
    const existingIndex = waitingPlayers.findIndex(p => p.id === playerId);
    if (existingIndex !== -1) {
        waitingPlayers.splice(existingIndex, 1);
    }
    
    // Add player to waiting list
    waitingPlayers.push({
        id: playerId,
        ws,
        name: playerName || `Player ${playerId.substr(0, 4)}`
    });
    
    // Try to match players
    matchPlayers();
}

// Match waiting players
function matchPlayers() {
    if (waitingPlayers.length >= 2) {
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();
        
        // Generate a seed for deterministic map generation
        const mapSeed = generateSeed();
        
        // Create initial game state
        const gameState = createDefaultGameState(mapSeed);
        
        // Create new game session with game state
        const gameId = uuidv4();
        games.set(gameId, {
            id: gameId,
            players: [player1, player2],
            state: gameState,
            status: 'initializing',
            startTime: Date.now()
        });
        
        // Extract tank positions for client
        const tankPositions = gameState.tanks.map(tank => ({
            x: tank.x,
            y: tank.y,
            angle: tank.angle,
            playerNumber: tank.playerNumber
        }));
        
        // Notify players about the match with tank positions
        player1.ws.send(JSON.stringify({
            type: 'game_found',
            gameId,
            playerNumber: 1,
            opponent: player2.name,
            mapSeed: mapSeed,
            tankPositions: tankPositions
        }));
        
        player2.ws.send(JSON.stringify({
            type: 'game_found',
            gameId,
            playerNumber: 2,
            opponent: player1.name,
            mapSeed: mapSeed,
            tankPositions: tankPositions
        }));
        
        console.log(`Game ${gameId} created between ${player1.name} and ${player2.name} with seed ${mapSeed}`);

        // After creating the game, start powerup spawning
        setTimeout(() => {
            spawnPowerUp(gameId);
        }, 5000); // Start spawning after 5 seconds
    }
}

// Add a more robust player movement handling function
function forwardGameInput(playerId, data) {
    const gameId = data.gameId;
    const game = games.get(gameId);
    
    if (!game) return;
    
    // Find player
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    // Get opponent
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = game.players[opponentIndex];
    
    // Update server's game state with player input
    const tankIndex = playerIndex;
    const tankState = game.state.tanks[tankIndex];
    
    // Record previous state for change detection
    const prevPos = { 
        x: tankState.x, 
        y: tankState.y, 
        angle: tankState.angle 
    };
    
    // Apply input to server's game state
    applyInputToGameState(game.state, playerIndex + 1, data.input);
    
    // Check if position actually changed
    const positionChanged = (
        prevPos.x !== tankState.x || 
        prevPos.y !== tankState.y || 
        prevPos.angle !== tankState.angle
    );
    
    // Forward input to opponent with server's authoritative position
    opponent.ws.send(JSON.stringify({
        type: 'opponent_input',
        playerNumber: playerIndex + 1,
        input: {
            ...data.input,
            // Include server's authoritative position
            serverPosition: {
                x: tankState.x,
                y: tankState.y,
                angle: tankState.angle
            },
            positionChanged: positionChanged
        },
        timestamp: data.timestamp
    }));
    
    // If position changed significantly, also send confirmation back to the player
    if (positionChanged) {
        const player = game.players[playerIndex];
        player.ws.send(JSON.stringify({
            type: 'position_confirmation',
            position: {
                x: tankState.x,
                y: tankState.y,
                angle: tankState.angle
            },
            timestamp: Date.now()
        }));
    }
}

// Improve server-side physics to prevent position rubber-banding
function applyInputToGameState(gameState, playerNumber, input) {
    const tankIndex = playerNumber - 1;
    if (!gameState.tanks || tankIndex >= gameState.tanks.length) return;
    
    const tank = gameState.tanks[tankIndex];
    
    // Update movement state
    if (input.moving !== undefined) {
        tank.moving = input.moving;
        
        // Apply actual movement based on input
        const moveSpeed = 1.5; // Base speed
        const turnSpeed = 0.03;
        
        // Handle rotation
        if (tank.moving.left) {
            tank.angle -= turnSpeed;
        }
        if (tank.moving.right) {
            tank.angle += turnSpeed;
        }
        
        // Handle forward/backward movement with proper physics
        let moveX = 0;
        let moveY = 0;
        
        if (tank.moving.forward) {
            moveX = Math.cos(tank.angle) * moveSpeed;
            moveY = Math.sin(tank.angle) * moveSpeed;
        }
        if (tank.moving.backward) {
            moveX = -Math.cos(tank.angle) * moveSpeed * 0.5;
            moveY = -Math.sin(tank.angle) * moveSpeed * 0.5;
        }
        
        // Apply movement
        if (moveX !== 0 || moveY !== 0) {
            // Check for collisions with map boundaries
            const newX = tank.x + moveX;
            const newY = tank.y + moveY;
            
            const tankWidth = 30;
            const tankHeight = 30;
            const canvasWidth = 1000;
            const canvasHeight = 750;
            
            // Boundary checks
            if (newX >= 0 && newX + tankWidth <= canvasWidth) {
                tank.x = newX;
            }
            if (newY >= 0 && newY + tankHeight <= canvasHeight) {
                tank.y = newY;
            }
        }
    }
    
    // Update shooting state
    if (input.shooting !== undefined) {
        tank.shooting = input.shooting;
        
        // Handle shooting logic if needed
        if (tank.shooting && tank.canShoot && tank.ammo > 0) {
            // Server-side shooting logic would go here
            // This would need to handle ammo, reloading, etc.
        }
    }
    
    // Record the last update time
    gameState.lastUpdateTime = Date.now();
}

// Sync game state
function syncGameState(playerId, gameId, state) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Update game state
    game.state = state;
    
    // Check if game is over
    if (state === 'completed') {
        setTimeout(() => {
            if (games.has(gameId)) {
                games.delete(gameId);
                console.log(`Game ${gameId} cleaned up`);
            }
        }, 60000); // Clean up after 1 minute
    }
}

// Handle player disconnect
function handlePlayerDisconnect(playerId) {
    // Remove from waiting list
    const waitingIndex = waitingPlayers.findIndex(p => p.id === playerId);
    if (waitingIndex !== -1) {
        waitingPlayers.splice(waitingIndex, 1);
    }
    
    // Check active games
    for (const [gameId, game] of games.entries()) {
        const playerIndex = game.players.findIndex(p => p.id === playerId);
        
        if (playerIndex !== -1) {
            const opponentIndex = playerIndex === 0 ? 1 : 0;
            const opponent = game.players[opponentIndex];
            
            // Notify opponent about disconnection
            opponent.ws.send(JSON.stringify({
                type: 'opponent_disconnected'
            }));
            
            // Mark game as abandoned
            game.state = 'abandoned';
            
            // Schedule cleanup
            setTimeout(() => {
                if (games.has(gameId)) {
                    games.delete(gameId);
                    console.log(`Game ${gameId} cleaned up after disconnect`);
                }
            }, 60000); // Clean up after 1 minute
            
            break;
        }
    }
}

// Cancel matchmaking
function cancelMatchmaking(playerId) {
    const index = waitingPlayers.findIndex(p => p.id === playerId);
    if (index !== -1) {
        waitingPlayers.splice(index, 1);
        console.log(`Player ${playerId} canceled matchmaking`);
    }
}

// Add this function to handle pings
function handlePing(ws, data) {
    ws.send(JSON.stringify({
        type: 'pong',
        timestamp: data.timestamp
    }));
}

// Add this function to handle full state syncing
function forwardTankState(playerId, data) {
    const gameId = data.gameId;
    const game = games.get(gameId);
    
    if (!game) return;
    
    // Find opponent
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = game.players[opponentIndex];
    
    // Forward state to opponent
    opponent.ws.send(JSON.stringify({
        type: 'opponent_state_sync',
        tankState: data.tankState,
        timestamp: data.timestamp
    }));
}

// Add a seed generator function
function generateSeed() {
    return Math.floor(Math.random() * 1000000);
}

// Function to synchronize map data across players
function syncMapData(playerId, gameId, obstacleData) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Initialize obstacles array in game state if it doesn't exist
    if (!game.state.obstacles) {
        game.state.obstacles = [];
    }
    
    // If obstacles array is empty, this is the first player sending data
    if (game.state.obstacles.length === 0) {
        game.state.obstacles = obstacleData;
        console.log(`Map data initialized for game ${gameId}`);
    }
    
    // Find the opponent player
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = game.players[opponentIndex];
    
    // Send the obstacle data to the opponent
    opponent.ws.send(JSON.stringify({
        type: 'map_sync',
        obstacles: game.state.obstacles
    }));
}

// Function to handle power-up spawning
function handlePowerUpSpawn(playerId, gameId, powerUpData) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Store the power-up data
    if (!game.state.powerUps) {
        game.state.powerUps = [];
    }
    game.state.powerUps.push(powerUpData);
    
    // Find the opponent player
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = game.players[opponentIndex];
    
    // Forward power-up data to opponent
    opponent.ws.send(JSON.stringify({
        type: 'spawn_powerup',
        powerUp: powerUpData
    }));
}

// Add a function to create a default game state
function createDefaultGameState(mapSeed) {
    const canvasWidth = 1000;
    const canvasHeight = 750;
    const tankSize = 30;
    
    // Create tank spawn positions at opposite corners
    const p1Spawn = {
        x: 100,
        y: 100
    };
    
    const p2Spawn = {
        x: canvasWidth - 100 - tankSize,
        y: canvasHeight - 100 - tankSize
    };
    
    return {
        mapSeed,
        obstacles: [], // Initialize empty obstacles array
        tanks: [
            {
                x: p1Spawn.x,
                y: p1Spawn.y,
                angle: 0,
                lives: 3,
                playerNumber: 1,
                moving: { forward: false, backward: false, left: false, right: false },
                shooting: false,
                canShoot: true,
                ammo: 5
            },
            {
                x: p2Spawn.x,
                y: p2Spawn.y,
                angle: Math.PI, // Face opposite direction
                lives: 3,
                playerNumber: 2,
                moving: { forward: false, backward: false, left: false, right: false },
                shooting: false,
                canShoot: true,
                ammo: 5
            }
        ],
        powerUps: [],
        bullets: [],
        mines: [],
        lastUpdateTime: Date.now()
    };
}

// Send initial game state to player
function sendInitialGameState(playerId, gameId) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Find the player
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const player = game.players[playerIndex];
    
    // Send the current game state
    player.ws.send(JSON.stringify({
        type: 'initial_game_state',
        gameState: game.state
    }));
}

// Verify game synchronization
function verifySyncState(playerId, gameId, syncData) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Find the player
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const player = game.players[playerIndex];
    
    // Compare client data with server data
    const tankPositionsMatch = syncData.tankPositions.every((clientTank, index) => {
        const serverTank = game.state.tanks[index];
        return Math.abs(clientTank.x - serverTank.x) < 10 &&
               Math.abs(clientTank.y - serverTank.y) < 10;
    });
    
    // Let client know if sync was successful
    player.ws.send(JSON.stringify({
        type: 'sync_verification',
        status: tankPositionsMatch ? 'success' : 'failed'
    }));
}

// Add support for server-side powerup spawning
function spawnPowerUp(gameId) {
    const game = games.get(gameId);
    if (!game || !game.state) return;
    
    // Constants
    const powerUpSize = 30;
    const margin = 60;
    const canvasWidth = 1000;
    const canvasHeight = 750;
    const maxPowerUps = 3;
    
    // Don't spawn if we already have max powerups
    if (!game.state.powerUps) {
        game.state.powerUps = [];
    }
    
    if (game.state.powerUps.length >= maxPowerUps) {
        // Schedule next spawn attempt
        setTimeout(() => spawnPowerUp(gameId), 5000);
        return;
    }
    
    // Power up types
    const POWER_UP_TYPES = [
        'shield', 'ricochet', 'piercing', 'speedBoost', 'rapidFire',
        'mineLayer', 'spreadShot', 'magneticShield', 'invisibility', 'extraLife'
    ];
    
    // Create a powerup at a random position
    const x = margin + Math.random() * (canvasWidth - margin * 2);
    const y = margin + Math.random() * (canvasHeight - margin * 2);
    const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
    
    const powerUp = {
        x, y, type,
        width: powerUpSize,
        height: powerUpSize
    };
    
    // Add to game state
    game.state.powerUps.push(powerUp);
    
    // Notify both players
    for (const player of game.players) {
        player.ws.send(JSON.stringify({
            type: 'spawn_powerup',
            powerUp: powerUp
        }));
    }
    
    // Schedule next powerup
    setTimeout(() => spawnPowerUp(gameId), 5000 + Math.random() * 10000);
}

// Add powerup collection handling
function handlePowerUpCollection(gameId, playerIndex, powerUpIndex) {
    const game = games.get(gameId);
    if (!game || !game.state || !game.state.powerUps) return;
    
    // Make sure the powerup exists
    if (powerUpIndex < 0 || powerUpIndex >= game.state.powerUps.length) return;
    
    // Remove the powerup from game state
    const powerUp = game.state.powerUps[powerUpIndex];
    game.state.powerUps.splice(powerUpIndex, 1);
    
    // Notify both players
    for (const player of game.players) {
        player.ws.send(JSON.stringify({
            type: 'powerup_collected',
            playerNumber: playerIndex + 1,
            powerUpIndex: powerUpIndex,
            powerUpType: powerUp.type
        }));
    }
}

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
