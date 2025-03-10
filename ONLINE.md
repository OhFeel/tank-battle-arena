# Tank Battle Arena - Online Multiplayer

Tank Battle Arena supports online multiplayer through WebSockets. This document explains how the multiplayer system works.

## Architecture

The multiplayer system uses a client-server architecture:

- **Server**: A WebSocket server handles matchmaking and relays game actions between players
- **Client**: The game client connects to the server, finds matches, and synchronizes game state

## Networking Components

### Server Side

- **server.js**: The main WebSocket server that handles connections, matchmaking, and message relay
- Game state is not simulated on the server; it only relays input between clients

### Client Side

- **network.js**: Handles WebSocket connections, message sending/receiving, and reconnection logic
- **online-ui.js**: Provides UI for online play including connection status, matchmaking, etc.

## Multiplayer Protocol

Messages between client and server use a simple JSON protocol:

### Client to Server Messages

1. **find_game**: Request to find a match
   ```json
   { "type": "find_game", "name": "PlayerName" }
   ```

2. **game_input**: Send player input to opponent
   ```json
   { 
     "type": "game_input", 
     "gameId": "game123",
     "input": { "moving": {"forward": true}, "position": {"x": 100, "y": 200} },
     "timestamp": 1632145612345
   }
   ```

3. **cancel_matchmaking**: Cancel an ongoing matchmaking request
   ```json
   { "type": "cancel_matchmaking" }
   ```

### Server to Client Messages

1. **connected**: Sent when connection is established
   ```json
   { "type": "connected", "id": "player123" }
   ```

2. **game_found**: Sent when a match is found
   ```json
   { 
     "type": "game_found", 
     "gameId": "game123",
     "playerNumber": 1,
     "opponent": "OpponentName" 
   }
   ```

3. **opponent_input**: Relays input from the opponent
   ```json
   { 
     "type": "opponent_input", 
     "input": { "moving": {"forward": true}, "position": {"x": 100, "y": 200} },
     "timestamp": 1632145612345
   }
   ```

4. **opponent_disconnected**: Sent when opponent disconnects
   ```json
   { "type": "opponent_disconnected" }
   ```

## Network Optimization

The game uses several optimization techniques:

1. **Input Buffering**: Inputs are collected and sent in batches to reduce packet frequency
2. **Delta Compression**: Only changed game state is transmitted
3. **Authority System**: Each player is authoritative over their own tank
4. **Ping Measurement**: Regular ping messages track latency

## Playing Online

1. Click "Play Online" on the main menu
2. Enter the WebSocket server URL
3. Enter your player name
4. Click "Find Match" to start matchmaking
5. Once matched, the game will automatically start

## Troubleshooting

- **Connection Issues**: Check if the server is running and accessible
- **Game Desyncs**: Try refreshing the page and reconnecting
- **Performance Issues**: Check your network latency with the in-game network indicator
