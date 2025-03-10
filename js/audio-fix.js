// Audio fallback and error handling

// Create placeholder audio files if they don't load
document.addEventListener('DOMContentLoaded', function() {
    const audioElements = document.querySelectorAll('audio');
    
    audioElements.forEach(audio => {
        // Add error listener to each audio element
        audio.addEventListener('error', function(e) {
            console.warn(`Audio failed to load: ${audio.id}`, e);
            
            // Create an AudioContext for fallback sounds
            if (!window.fallbackAudio) {
                try {
                    window.AudioContext = window.AudioContext || window.webkitAudioContext;
                    window.fallbackAudio = new AudioContext();
                } catch (err) {
                    console.error("Web Audio API not supported:", err);
                }
            }
        });
    });
    
    // Function to create empty audio files
    function createEmptyAudios() {
        const audioFolder = 'audio/';
        const requiredAudios = [
            'background_music.mp3',
            'shoot.mp3',
            'explosion.mp3',
            'powerup.mp3',
            'bounce.mp3'
        ];
        
        // Check if the audio directory exists, if not create it
        const dir = document.createElement('div');
        dir.style.display = 'none';
        dir.id = 'audio-check';
        document.body.appendChild(dir);
        
        // For each required audio file, create a data URI
        requiredAudios.forEach(filename => {
            const audioPath = audioFolder + filename;
            
            // Check if file exists
            const img = new Image();
            img.onerror = function() {
                console.warn(`Missing audio file: ${audioPath} - creating empty fallback`);
                
                // Create silent audio element as fallback
                const audioElement = document.querySelector(`audio[src="${audioPath}"], audio source[src="${audioPath}"]`);
                if (audioElement) {
                    const parent = audioElement.tagName === 'AUDIO' ? audioElement : audioElement.parentElement;
                    // Create a silent 1-second audio as fallback
                    parent.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAYaAAAAAAAAASDoqqqqqqoD/';
                }
            };
            img.src = audioPath;
        });
        
        setTimeout(() => {
            document.body.removeChild(dir);
        }, 1000);
    }
    
    createEmptyAudios();
});

// Create a helper for playing sounds that handles errors
function createSoundPlayer() {
    window.playSoundSafely = function(sound, volume = 0.7) {
        if (!sound) return;
        
        try {
            // Reset the audio
            sound.currentTime = 0;
            sound.volume = volume;
            
            // Try to play it
            const playPromise = sound.play();
            
            // Handle autoplay policy
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.warn('Audio playback blocked:', err);
                });
            }
        } catch (e) {
            console.warn('Error playing sound:', e);
        }
    };
}

createSoundPlayer();
