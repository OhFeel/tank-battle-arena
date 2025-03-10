/**
 * Startup script for Tank Battle Arena server with health monitoring
 */
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Tank Battle Arena server with health monitoring...');

// Start the health check monitor
const monitor = spawn('node', ['health-check.js'], {
    cwd: __dirname,
    stdio: 'inherit'
});

console.log(`Health monitor started with PID ${monitor.pid}`);
console.log('Server is starting...');

// Handle monitor process events
monitor.on('error', (err) => {
    console.error('Error starting health monitor:', err);
});

monitor.on('exit', (code, signal) => {
    console.log(`Health monitor exited with code ${code} and signal ${signal}`);
});

// Log instructions
console.log('\n=== Tank Battle Arena Server ===');
console.log('Server should be running at http://localhost:10000');
console.log('To stop the server, press Ctrl+C\n');
