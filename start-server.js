/**
 * Helper script to start the multiplayer server
 */
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const serverPath = path.join(__dirname, 'server', 'server.js');

console.log('Starting Tank Battle Arena multiplayer server...');
console.log('Press Ctrl+C to stop the server');

// Check if Node.js is installed
try {
    const nodeProcess = spawn('node', [serverPath], {
        stdio: 'inherit'
    });

    nodeProcess.on('error', (err) => {
        console.error('Failed to start server:', err.message);
        console.error('Make sure Node.js is installed and run: npm install in the server directory');
    });

    nodeProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Server exited with code ${code}`);
        } else {
            console.log('Server stopped');
        }
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        console.log('\nStopping server...');
        nodeProcess.kill('SIGINT');
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    });
} catch (err) {
    console.error('Error starting server:', err.message);
    console.error('Make sure Node.js is installed and run: npm install in the server directory');
}
