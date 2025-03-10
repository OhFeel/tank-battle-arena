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
    }
}

// Forward game input to opponent
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
    
    // Apply the input to the server's game state
    applyInputToGameState(game.state, playerIndex + 1, data.input);
    
    // Forward input to opponent with authoritative position
    opponent.ws.send(JSON.stringify({
        type: 'opponent_input',
        playerNumber: playerIndex + 1,
        input: {
            ...data.input,
            // Include server's authoritative position
            serverPosition: {
                x: game.state.tanks[playerIndex].x,
                y: game.state.tanks[playerIndex].y,
                angle: game.state.tanks[playerIndex].angle
            }
        },
        timestamp: data.timestamp
    }));
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
    
    // If obstacles array is empty, this is the first player sending data
    if (game.obstacles.length === 0) {
        game.obstacles = obstacleData;
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
        obstacles: game.obstacles
    }));
}

// Function to handle power-up spawning
function handlePowerUpSpawn(playerId, gameId, powerUpData) {
    const game = games.get(gameId);
    if (!game) return;
    
    // Store the power-up data
    game.powerUps.push(powerUpData);
    
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
        obstacles: [],
        tanks: [
            {
                x: p1Spawn.x,
                y: p1Spawn.y,
                angle: 0,
                lives: 3,
                playerNumber: 1
            },
            {
                x: p2Spawn.x,
                y: p2Spawn.y,
                angle: Math.PI, // Face opposite direction
                lives: 3,
                playerNumber: 2
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

// Apply player input to server game state
function applyInputToGameState(gameState, playerNumber, input) {
    const tankIndex = playerNumber - 1;
    const tank = gameState.tanks[tankIndex];
    
    // Update movement state
    if (input.moving !== undefined) {
        tank.moving = input.moving;
    }
    
    // Update position from client (with validation)
    if (input.position) {
        // Limit the maximum position change to prevent cheating
        const maxPositionChange = 10;
        const dx = input.position.x - tank.x;
        const dy = input.position.y - tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= maxPositionChange) {
            tank.x = input.position.x;
            tank.y = input.position.y;
        } else {
            // If change is too large, move in the same direction but limit the distance
            const factor = maxPositionChange / distance;
            tank.x += dx * factor;
            tank.y += dy * factor;
        }
    }
    
    // Update angle
    if (input.angle !== undefined) {
        tank.angle = input.angle;
    }
    
    // Record the last update time
    gameState.lastUpdateTime = Date.now();
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
