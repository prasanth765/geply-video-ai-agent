// services/voice/index.js
// ─────────────────────────────────────────────────────────────────
// Barrel export — import everything voice-related from here.
//
// Usage anywhere in the app:
//   import { createSTT, createTTS, VOICE_STATE } from '../services/voice'
// ─────────────────────────────────────────────────────────────────

export { createSTT }    from './stt'
export { createTTS }    from './tts'
export { VOICE_STATE }  from './voiceState'
