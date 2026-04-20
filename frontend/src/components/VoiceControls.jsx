/**
 * VoiceControls.jsx
 * Shared voice UI components used by InterviewRoom.
 */
import { Mic } from 'lucide-react'
import { VOICE_STATE } from '../services/voice/voiceState'

// ── Mode Toggle (Text / Voice) ──
export function ModeToggle({ voiceEnabled, isSupported, onToggle }) {
  if (!isSupported) return null
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={() => voiceEnabled && onToggle()} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, border: 'none', cursor: 'pointer', background: !voiceEnabled ? 'rgba(99,102,241,0.25)' : 'transparent', color: !voiceEnabled ? '#a5b4fc' : 'rgba(148,163,184,0.5)', transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif' }}>Text</button>
      <button onClick={() => !voiceEnabled && onToggle()} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, border: 'none', cursor: 'pointer', background: voiceEnabled ? 'rgba(99,102,241,0.25)' : 'transparent', color: voiceEnabled ? '#a5b4fc' : 'rgba(148,163,184,0.5)', transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif' }}>Voice</button>
    </div>
  )
}

// ── Always-On Status (shown at bottom of chat panel in voice mode) ──
export function AlwaysOnStatus({ voice }) {
  const isListening = voice.isListening
  const isSpeaking = voice.isSpeaking
  const isProcessing = voice.isProcessing

  const state = isSpeaking ? 'speaking' : isProcessing ? 'processing' : isListening ? 'listening' : 'ready'

  const config = {
    listening: { color: '#f43f5e', bg: 'rgba(244,63,94,0.15)', border: '2px solid #f43f5e', label: 'LISTENING', hint: 'Speak naturally...' },
    speaking: { color: '#818cf8', bg: 'rgba(99,102,241,0.15)', border: '2px solid #6366f1', label: 'GEPLY SPEAKING', hint: '' },
    processing: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: '2px solid #fbbf24', label: 'THINKING', hint: '' },
    ready: { color: '#64748b', bg: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', label: 'Voice ready', hint: 'Speak naturally...' },
  }

  const cfg = config[state]

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cfg.bg, border: cfg.border, transition: 'all 0.3s',
        animation: state === 'listening' ? 'hi-pulse 1.5s ease-in-out infinite' : 'none',
      }}>
        <Mic size={20} color={cfg.color} />
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: cfg.color, textTransform: 'uppercase' }}>
        {cfg.label}
      </div>
      {cfg.hint && <div style={{ fontSize: '10px', color: 'rgba(148,163,184,0.5)', marginTop: '2px' }}>{cfg.hint}</div>}
    </div>
  )
}

// ── Geply Speaking Wave Animation ──
export function GeplySpeakingWave({ visible }) {
  if (!visible) return null
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '16px' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: '3px', borderRadius: '2px',
          background: 'linear-gradient(to top, #6366f1, #a5b4fc)',
          animation: `hi-wave 0.5s ease-in-out ${i * 0.07}s infinite alternate`,
        }} />
      ))}
    </div>
  )
}

// ── Interim Transcript Display ──
export function InterimTranscript({ text }) {
  if (!text) return null
  return (
    <div style={{
      padding: '8px 12px', borderRadius: '10px',
      background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)',
      fontSize: '12px', color: 'rgba(248,113,113,0.9)', fontStyle: 'italic',
      animation: 'hi-fade 0.2s ease-out',
    }}>
      {text}
    </div>
  )
}
