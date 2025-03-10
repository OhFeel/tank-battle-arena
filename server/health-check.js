/**
 * Health check and auto-restart script for Tank Battle Arena server
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CHECK_INTERVAL = 30000; // Check every 30 seconds
const SERVER_PORT = 10000;
const LOG_FILE = path.join(__dirname, 'server-health.log');

// Ensure log directory exists
try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
} catch (err) {
    // Ignore errors if directory already exists
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(LOG_FILE, logMessage);
}

// Process status
let serverProcess = null;
let isShuttingDown = false;

// Start the server
function startServer() {
    log('Starting server...');
    
    // Kill existing process if it exists
    if (serverProcess) {
        try {
            serverProcess.kill();
        } catch (err) {
            log(`Error killing existing process: ${err.message}`);
        }
    }
    
    // Start new process
    serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: 'inherit'
    });
    
    // Handle process events
    serverProcess.on('error', (err) => {
        log(`Server process error: ${err.message}`);
        if (!isShuttingDown) {
            setTimeout(startServer, 5000);
        }
    });
    
    serverProcess.on('exit', (code, signal) => {
        log(`Server process exited with code ${code} and signal ${signal}`);
        if (!isShuttingDown) {
            setTimeout(startServer, 5000);
        }
    });
    
    log(`Server started with PID ${serverProcess.pid}`);
}

// Check if server is healthy
function checkHealth() {
    const options = {
        hostname: 'localhost',
        port: SERVER_PORT,
        path: '/health',
        method: 'GET',
        timeout: 5000
    };
    
    const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
            // Server is healthy
            res.setEncoding('utf8');
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const healthData = JSON.parse(data);
                    log(`Health check passed: ${JSON.stringify(healthData)}`);
                } catch (err) {
                    log(`Health check passed but invalid JSON response: ${data}`);
                }
            });
        } else {
            log(`Health check failed with status: ${res.statusCode}`);
            restartServer();
        }
    });
    
    req.on('error', (err) => {
        log(`Health check error: ${err.message}`);
        restartServer();
    });
    
    req.on('timeout', () => {
        log('Health check timed out');
        req.destroy();
        restartServer();
    });
    
    req.end();
}

// Restart the server
function restartServer() {
    log('Restarting server due to failed health check');
    startServer();
}

// Handle shutdown
process.on('SIGINT', () => {
    isShuttingDown = true;
    log('Shutting down health check monitor');
    
    if (serverProcess) {
        log('Terminating server process');
        serverProcess.kill();
    }
    
    process.exit(0);
});

// Start the server and health checks
log('Health check monitor started');
startServer();
setInterval(checkHealth, CHECK_INTERVAL);
