// This is a NodeJS script you can run to move files if needed
// You would need to run it with Node.js

/*
const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
['css', 'js', 'audio'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Move files from src to appropriate directories
if (fs.existsSync('src')) {
    if (fs.existsSync('src/game.js')) {
        fs.copyFileSync('src/game.js', 'js/game.js');
    }
    if (fs.existsSync('src/style.css')) {
        fs.copyFileSync('src/style.css', 'css/style.css');
    }
}
*/

// This is just a reference - you would need to manually move the files
console.log('Check if you need to move files from src/ to js/ and css/ directories');
