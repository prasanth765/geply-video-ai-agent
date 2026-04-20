// services/voice/voiceState.js
// Single source of truth for every voice state in Geply.

export const VOICE_STATE = Object.freeze({
  IDLE:        'idle',        // mic off, tts off — waiting
  LISTENING:   'listening',   // mic recording candidate speech
  PROCESSING:  'processing',  // transcript sent to AI, waiting for reply
  SPEAKING:    'speaking',    // Geply TTS is playing aloud
})
