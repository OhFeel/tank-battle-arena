
/**
 * Enhanced debugging and logging system for the Tank Battle Arena
 */
(function() {
    // Create a more robust logger
    const Logger = {
        // Store logs in memory for review
        logs: [],
        maxLogs: 200,

        // Log levels
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error',
        NETWORK: 'network',
        GAME: 'game',
        
        // Main log function
        log: function(level, message, data) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                time: timestamp,
                level: level || this.INFO,
                message: message,
                data: data
            };
            
            // Store in memory
            this.logs.unshift(logEntry);
            if (this.logs.length > this.maxLogs) {
                this.logs.pop();
            }
            
            // Output to console with appropriate styling
            const consoleMethod = level === this.ERROR ? 'error' : 
                                 level === this.WARN ? 'warn' : 'log';
                                 
            let style = '';
            switch(level) {
                case this.NETWORK: style = 'color: #3498db'; break;
                case this.GAME: style = 'color: #2ecc71'; break;
                case this.WARN: style = 'color: #f39c12'; break;
                case this.ERROR: style = 'color: #e74c3c; font-weight: bold'; break;
                default: style = 'color: #bdc3c7';
            }
            
            if (data) {
                console[consoleMethod](`%c[${level.toUpperCase()}] ${message}`, style, data);
            } else {
                console[consoleMethod](`%c[${level.toUpperCase()}] ${message}`, style);
            }
            
            // Emit custom event for UI listeners
            window.dispatchEvent(new CustomEvent('game-log', { detail: logEntry }));
            
            return logEntry;
        },
        
        info: function(message, data) {
            return this.log(this.INFO, message, data);
        },
        
        warn: function(message, data) {
            return this.log(this.WARN, message, data);
        },
        
        error: function(message, data) {
            return this.log(this.ERROR, message, data);
        },
        
        network: function(message, data) {
            return this.log(this.NETWORK, message, data);
        },
        
        game: function(message, data) {
            return this.log(this.GAME, message, data);
        },
        
        // Get all logs or filtered logs
        getLogs: function(level) {
            if (level) {
                return this.logs.filter(log => log.level === level);
            }
            return [...this.logs];
        },
        
        // Save logs to file for debugging
        downloadLogs: function() {
            const logText = JSON.stringify(this.logs, null, 2);
            const blob = new Blob([logText], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `tank-game-logs-${new Date().toISOString().split('.')[0].replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    };
    
    // Create shorthand global function for logging
    window.gameLog = function(level, message, data) {
        return Logger.log(level, message, data);
    };
    
    // Add global logger object
    window.GameLogger = Logger;
    
    // Add logging hooks for easier debugging
    const originalFetch = window.fetch;
    window.fetch = function() {
        Logger.network(`Fetch request to: ${arguments[0]}`, { args: [...arguments] });
        return originalFetch.apply(this, arguments)
            .then(response => {
                Logger.network(`Fetch response from: ${arguments[0]}`, { status: response.status });
                return response;
            })
            .catch(error => {
                Logger.error(`Fetch error for: ${arguments[0]}`, error);
                throw error;
            });
    };
    
    // Create an error tracking system
    window.addEventListener('error', function(e) {
        Logger.error('Global error caught', {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            stack: e.error ? e.error.stack : 'No stack available'
        });
    });
    
    // Add network error tracking
    window.addEventListener('unhandledrejection', function(e) {
        Logger.error('Unhandled promise rejection', {
            reason: e.reason,
            message: e.reason ? e.reason.message : 'No message',
            stack: e.reason && e.reason.stack ? e.reason.stack : 'No stack available'
        });
    });
    
    // Log initialization
    Logger.info('Debug logger initialized');
})();
