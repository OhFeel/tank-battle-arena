// This script adds protection against missing audio files
document.addEventListener('DOMContentLoaded', function() {
    // Create audio directory if loading from local file system
    const audioElements = document.querySelectorAll('audio');
    
    audioElements.forEach(audio => {
        // Add error handling for all audio elements
        audio.addEventListener('error', function(e) {
            console.warn('Could not load audio file:', e.target.src);
        });
        
        // Check if we have source elements
        const sources = audio.querySelectorAll('source');
        if (sources.length === 0) {
            // If no source, create one with a fallback
            const source = document.createElement('source');
            source.setAttribute('src', 'about:blank');
            source.setAttribute('type', 'audio/mpeg');
            audio.appendChild(source);
        }
    });
});
