import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { interviewsApi } from '../lib/api'
import { Video, VideoOff, Mic, MicOff, PhoneOff, Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import axios from 'axios'
import { useVoiceMode } from '../hooks/useVoiceMode'
import { ModeToggle, AlwaysOnStatus, GeplySpeakingWave, InterimTranscript } from '../components/VoiceControls'

const T = {
  base:        '#030711',
  glass:       'rgba(255,255,255,0.04)',
  glassBorder: '1px solid rgba(255,255,255,0.07)',
  accent:      '#6366f1',
  rose:        '#f43f5e',
  amber:       '#f59e0b',
  textPrimary: '#e2e8f0',
  textMuted:   'rgba(148,163,184,0.7)',
  textFaint:   'rgba(148,163,184,0.4)',
}
const glass = { background: T.glass, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: T.glassBorder }

const CODING_KEYWORDS = [
  'write a', 'write the', 'write code', 'code for', 'implement', 'function',
  'algorithm', 'debug', 'program', 'syntax', 'in python', 'in javascript',
  'in java', 'sql query', 'data structure', 'complexity', 'pseudo', 'snippet',
  'class ', 'method ', 'loop ', 'recursion', 'big o', 'o(n', 'array ', 'string ',
]
function isCodingQuestion(text) {
  const lower = text.toLowerCase()
  return CODING_KEYWORDS.some(k => lower.includes(k))
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  .hi-room { font-family: 'DM Sans', sans-serif; }
  .hi-room * { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.3) transparent; }
  .hi-room *::-webkit-scrollbar { width: 4px; }
  .hi-room *::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 2px; }
  @keyframes hi-fade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes hi-slide { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes hi-spin  { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes hi-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes hi-wave  { from{height:3px} to{height:14px} }
  @keyframes hi-bounce{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes hi-glow  { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.8;transform:scale(1.07)} }
  @keyframes hi-count { from{transform:scale(1.3);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes hi-toast { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
  .hi-msg   { animation: hi-fade 0.25s ease-out; }
  .hi-input:focus { outline:none; border-color:rgba(99,102,241,.5)!important; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
  .hi-send:hover:not(:disabled) { background:#4f46e5!important; }
  .hi-ctrl:hover { background:rgba(255,255,255,.10)!important; }
`
function injectGlobal() {
  if (typeof document === 'undefined' || document.getElementById('hi-css')) return
  const el = document.createElement('style')
  el.id = 'hi-css'; el.textContent = GLOBAL_CSS
  document.head.appendChild(el)
}

function MonitoringToast({ visible }) {
  if (!visible) return null
  return (
    <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, maxWidth: '480px', width: 'calc(100% - 32px)', background: 'rgba(15,18,40,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'hi-toast 0.4s ease-out' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
        <Shield size={15} color="#818cf8" />
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: T.textPrimary, marginBottom: '4px' }}>Camera & mic are now active</div>
        <div style={{ fontSize: '12px', color: T.textMuted, lineHeight: 1.6 }}>Please keep them on for the full interview. This session is recorded and monitored.</div>
      </div>
    </div>
  )
}

function CountdownScreen({ videoRef, count }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(3,7,17,0.7)', backdropFilter: 'blur(4px)' }}>
      <div style={{ textAlign: 'center' }}>
        <div key={count} style={{ fontSize: '96px', fontWeight: 700, color: 'white', lineHeight: 1, animation: 'hi-count 0.4s ease-out', textShadow: '0 0 40px rgba(99,102,241,0.6)' }}>{count}</div>
        <div style={{ fontSize: '16px', color: T.textMuted, marginTop: '16px', letterSpacing: '0.04em' }}>Interview starting...</div>
        <div style={{ fontSize: '12px', color: T.textFaint, marginTop: '6px' }}>Get comfortable and speak naturally</div>
      </div>
    </div>
  )
}

function AIAvatar({ isSpeaking, name, avatarUrl }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'AI'
  const showPhoto = avatarUrl && !imgFailed
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, #030711 70%)', borderRadius: '14px', overflow: 'hidden' }}>
      {isSpeaking && <><div style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', border: '1.5px solid rgba(99,102,241,0.5)', animation: 'hi-glow 1.8s ease-in-out infinite' }} /><div style={{ position: 'absolute', width: '118px', height: '118px', borderRadius: '50%', border: '1px solid rgba(99,102,241,0.25)', animation: 'hi-glow 1.8s ease-in-out 0.4s infinite' }} /></>}
      <div style={{ position: 'relative', width: '88px', height: '88px', borderRadius: '50%', overflow: 'hidden', boxShadow: isSpeaking ? '0 0 0 3px rgba(99,102,241,0.6), 0 0 32px rgba(99,102,241,0.3)' : '0 0 0 2px rgba(255,255,255,0.08)', transform: isSpeaking ? 'scale(1.04)' : 'scale(1)', transition: 'all 0.3s' }}>
        {showPhoto ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgFailed(true)} /> : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '26px', fontWeight: 600, color: 'white' }}>{initials}</span></div>}
        {isSpeaking && <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.08)', animation: 'hi-pulse 2s ease-in-out infinite' }} />}
      </div>
      {isSpeaking && <div style={{ position: 'absolute', bottom: '12px', display: 'flex', gap: '3px' }}>{[0,1,2,3,4,5,6].map(i => <div key={i} style={{ width: '3px', borderRadius: '2px', background: 'linear-gradient(to top, #6366f1, #a5b4fc)', animation: `hi-wave 0.6s ease-in-out ${i*0.08}s infinite alternate` }} />)}</div>}
      <div style={{ position: 'absolute', bottom: '6px', left: 0, right: 0, textAlign: 'center' }}><span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px', background: isSpeaking ? 'rgba(99,102,241,0.25)' : 'rgba(0,0,0,0.5)', color: isSpeaking ? '#a5b4fc' : 'rgba(148,163,184,0.6)', transition: 'all 0.3s' }}>{isSpeaking ? 'Speaking' : name || 'AI Interviewer'}</span></div>
    </div>
  )
}

function ConsentScreen({ jobTitle, onConsent }) {
  injectGlobal()
  const [checks, setChecks] = useState({ webcam: false, screen: false, recording: false, data: false })
  const allChecked = Object.values(checks).every(Boolean)
  const items = [
    { key: 'webcam', label: 'Webcam access during the interview' },
    { key: 'screen', label: 'Tab and screen activity monitoring' },
    { key: 'recording', label: 'The interview being recorded' },
    { key: 'data', label: 'Data retained for 60 days' },
  ]
  return (
    <div className="hi-room" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.base, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', borderRadius: '20px', ...glass, padding: '32px', animation: 'hi-fade 0.4s ease-out', boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color="#818cf8" /></div>
          <div><div style={{ fontSize: '16px', fontWeight: 600, color: T.textPrimary }}>Interview Consent</div><div style={{ fontSize: '12px', color: T.textMuted }}>Please review before proceeding</div></div>
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />
        <p style={{ fontSize: '13px', color: T.textMuted, marginBottom: '20px', lineHeight: 1.6 }}>For <strong style={{ color: T.textPrimary }}>{jobTitle}</strong>, I consent to:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {items.map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div onClick={() => setChecks(p => ({ ...p, [key]: !p[key] }))} style={{ width: '18px', height: '18px', borderRadius: '6px', flexShrink: 0, border: checks[key] ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.15)', background: checks[key] ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s', cursor: 'pointer' }}>
                {checks[key] && <svg width="10" height="10" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize: '13px', color: checks[key] ? T.textPrimary : T.textMuted, transition: 'color 0.2s' }}>{label}</span>
            </label>
          ))}
        </div>
        <button onClick={() => allChecked && onConsent()} disabled={!allChecked} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: allChecked ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.06)', color: allChecked ? 'white' : 'rgba(148,163,184,0.4)', fontSize: '14px', fontWeight: 600, cursor: allChecked ? 'pointer' : 'not-allowed', transition: 'all 0.25s', boxShadow: allChecked ? '0 4px 20px rgba(99,102,241,0.35)' : 'none', fontFamily: 'DM Sans, sans-serif' }}>Enter Room</button>
      </div>
    </div>
  )
}

const SCREENSHOT_EVENTS = new Set(['tab_switch', 'window_blur', 'copy_paste', 'devtools_attempt', 'view_source_attempt'])
const MAX_SCREENSHOTS = 15

function useProctorSDK(interviewId, enabled, onWarning, videoRef, screenshotsRef) {
  const sendEvent = useCallback((type, metadata = {}) => {
    if (!enabled || !interviewId) return
    interviewsApi.sendProctorEvent({ interview_id: interviewId, event_type: type, timestamp: new Date().toISOString(), metadata }).catch(() => {})
    if (SCREENSHOT_EVENTS.has(type) && screenshotsRef.current.length < MAX_SCREENSHOTS) {
      try {
        const video = videoRef.current
        if (video && video.videoWidth > 0) {
          const canvas = document.createElement('canvas')
          canvas.width = Math.min(video.videoWidth, 640); canvas.height = Math.min(video.videoHeight, 480)
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
          screenshotsRef.current.push({ event_type: type, timestamp: new Date().toISOString(), image: canvas.toDataURL('image/jpeg', 0.4) })
        }
      } catch (err) { console.warn('Screenshot failed:', err) }
    }
    if (onWarning) onWarning(type)
  }, [interviewId, enabled, onWarning, videoRef, screenshotsRef])

  useEffect(() => {
    if (!enabled) return
    const onVis = () => { if (document.hidden) sendEvent('tab_switch') }
    const onCopy = () => sendEvent('copy_paste', { action: 'copy' })
    const onPaste = () => sendEvent('copy_paste', { action: 'paste' })
    const onContext = (e) => { e.preventDefault(); sendEvent('right_click') }
    const onKeyDown = (e) => {
      if (e.key === 'F12') { e.preventDefault(); sendEvent('devtools_attempt') }
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) { e.preventDefault(); sendEvent('devtools_attempt') }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); sendEvent('view_source_attempt') }
    }
    const onBlur = () => sendEvent('window_blur', { reason: 'focus_lost' })
    const onFull = () => { if (!document.fullscreenElement) sendEvent('fullscreen_exit') }
    let iW = window.innerWidth, iH = window.innerHeight
    const onResize = () => {
      if (Math.abs(window.innerWidth - iW) > 100 || Math.abs(window.innerHeight - iH) > 100) {
        sendEvent('window_resize', { from: `${iW}x${iH}`, to: `${window.innerWidth}x${window.innerHeight}` })
        iW = window.innerWidth; iH = window.innerHeight
      }
    }
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('copy', onCopy); document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContext); document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onBlur); document.addEventListener('fullscreenchange', onFull)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('copy', onCopy); document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContext); document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur); document.removeEventListener('fullscreenchange', onFull)
      window.removeEventListener('resize', onResize)
    }
  }, [enabled, sendEvent])
}

export default function InterviewRoom() {
  injectGlobal()
  const { token } = useParams()

  const [stage, setStage] = useState('loading')
  const [roomData, setRoomData] = useState(null)
  const [error, setError] = useState('')
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [messages, setMessages] = useState([])
  const [inputMsg, setInputMsg] = useState('')
  const [proctorWarning, setProctorWarning] = useState('')
  const [warningCount, setWarningCount] = useState(0)
  const [sending, setSending] = useState(false)
  const [aiSpeaking, setAiSpeaking] = useState(false)

  // Expose AI speaking state to VAD (avoids stale closures)
  useEffect(() => { window.__geplyAiSpeaking = aiSpeaking }, [aiSpeaking])
  const [ending, setEnding] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [countdown, setCountdown] = useState(6)
  const [showToast, setShowToast] = useState(false)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [codeInputMsg, setCodeInputMsg] = useState('')
  const [revealedWordCount, setRevealedWordCount] = useState(null)
  const revealTimerRef = useRef(null)
  const interviewEndingRef = useRef(false)
  const autoEndTimerRef = useRef(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const chatEndRef = useRef(null)
  const canvasRef = useRef(null)
  const historyRef = useRef([])
  const screenshotsRef = useRef([])
  const sendMessageRef = useRef(null)
  const isListeningRef = useRef(false)

  // VAD (Voice Activity Detection) — enables phone-call style interrupt
  const analyserRef = useRef(null)
  const vadActiveRef = useRef(false)  // true = candidate voice detected during AI speech

  const startWordReveal = useCallback((text) => {
    clearInterval(revealTimerRef.current)
    if (!text?.trim()) return
    const words = text.split(/\s+/).filter(Boolean)
    if (words.length <= 1) return
    let idx = 1
    setRevealedWordCount(1)
    revealTimerRef.current = setInterval(() => {
      idx++
      if (idx >= words.length) { clearInterval(revealTimerRef.current); setRevealedWordCount(null) }
      else setRevealedWordCount(idx)
    }, 480)
  }, [])

  const voice = useVoiceMode({
    enabled: voiceEnabled,
    alwaysOn: voiceEnabled,
    onTranscript: useCallback((text) => { sendMessageRef.current?.(text) }, []),
  })

  useEffect(() => { isListeningRef.current = voice.isListening }, [voice.isListening])

  useEffect(() => {
    if (voice.isIdle && !serverAudioPlayingRef.current) {
      clearInterval(revealTimerRef.current)
      setRevealedWordCount(null)
      setAiSpeaking(false)
      if (interviewEndingRef.current && !ending) {
        clearTimeout(autoEndTimerRef.current)
        autoEndTimerRef.current = setTimeout(() => endInterview(), 1500)
      }
    }
  }, [voice.isIdle])

  useEffect(() => { return () => { clearInterval(revealTimerRef.current); clearTimeout(autoEndTimerRef.current) } }, [])

  const handleProctorWarning = useCallback((type) => {
    const map = { tab_switch: 'Tab switch detected — please stay on this page.', copy_paste: 'Copy/paste detected — this is being monitored.', right_click: 'Right-click is disabled during the interview.', devtools_attempt: 'Developer tools are not allowed.', view_source_attempt: 'Viewing source is not allowed.', window_blur: 'You left the interview window.', fullscreen_exit: 'Please remain in the interview window.', window_resize: 'Window resized — please keep the interview fullscreen.' }
    setProctorWarning(map[type] || 'Activity detected.')
    setWarningCount(p => p + 1)
    setTimeout(() => setProctorWarning(''), 5000)
  }, [])

  useProctorSDK(roomData?.interview_id, stage === 'interview', handleProctorWarning, videoRef, screenshotsRef)
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    (async () => {
      try {
        const { data } = await interviewsApi.getRoomToken(token)
        setRoomData(data)
        if (data.status === 'already_completed') { setStage('ended'); return }
        setStage('consent')
      } catch (err) { setError(err.response?.data?.error?.message || 'Invalid or expired link'); setStage('error') }
    })()
  }, [token])

  useEffect(() => {
    if (stage !== 'entering' && stage !== 'interview') return
    let stream, animId, audioCtx
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyserRef.current = analyser
        analyser.fftSize = 256; source.connect(analyser)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let vadFrames = 0
        const VAD_THRESHOLD = 0.15   // mic volume to trigger interrupt (0-1)
        const VAD_FRAMES_NEEDED = 8  // consecutive frames (~130ms) to confirm speech

        const draw = () => {
          animId = requestAnimationFrame(draw)
          analyser.getByteFrequencyData(dataArray)

          // ── VAD: detect candidate voice while AI is speaking ──
          let avgLevel = 0
          for (let i = 0; i < 10; i++) avgLevel += dataArray[i] / 255
          avgLevel /= 10

          if (avgLevel > VAD_THRESHOLD) {
            vadFrames++
            if (vadFrames >= VAD_FRAMES_NEEDED && !vadActiveRef.current) {
              // Check if AI is currently speaking (use window flag to avoid stale closure)
              if (window.__geplyAiSpeaking) {
                vadActiveRef.current = true
                console.log('[VAD] Candidate interrupted AI — stopping speech')
                // Cancel TTS + open mic (same as old toggleAudio interrupt)
                try { window.speechSynthesis?.cancel() } catch (_) {}
                window.__geplyInterrupt?.()
              }
            }
          } else {
            vadFrames = Math.max(0, vadFrames - 2)  // decay slowly
            if (vadFrames === 0) vadActiveRef.current = false
          }

          // ── Audio visualizer ──
          const canvas = canvasRef.current; if (!canvas) return
          const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height
          ctx.clearRect(0, 0, w, h)
          const bars = 20, barW = w / bars
          for (let i = 0; i < bars; i++) {
            const val = dataArray[i * 2] / 255
            ctx.fillStyle = isListeningRef.current ? `rgba(129,140,248,${0.4 + val * 0.6})` : val > 0.1 ? '#22c55e' : '#374151'
            ctx.fillRect(i * barW + 1, h - Math.max(val * h, 1), barW - 2, Math.max(val * h, 1))
          }
        }
        draw()
      } catch (err) { console.error('Camera/mic error:', err) }
    })()
    return () => { if (stage === 'interview') return; stream?.getTracks().forEach(t => t.stop()); cancelAnimationFrame(animId); audioCtx?.close() }
  }, [stage])

  useEffect(() => {
    if (stage !== 'entering') return
    setShowToast(true)
    const toastTimer = setTimeout(() => setShowToast(false), 3000)
    const candidateFirst = roomData?.candidate_name?.split(' ')[0] || roomData?.candidate_name || 'there'
    const greeting = `Hi! Am I speaking with ${candidateFirst}?`
    setCountdown(6)
    let current = 6
    const tick = setInterval(() => {
      current -= 1; setCountdown(current)
      if (current <= 0) { clearInterval(tick); clearTimeout(toastTimer); setShowToast(false); _startInterview(greeting, null) }
    }, 1000)
    return () => { clearInterval(tick); clearTimeout(toastTimer) }
  }, [stage])

  function _startInterview(greetingText) {
    setStage('interview')
    const candidateFirst = roomData?.candidate_name?.split(' ')[0] || roomData?.candidate_name || 'there'
    const greeting = greetingText || `Hi! Am I speaking with ${candidateFirst}?`
    setMessages([{ role: 'agent', text: greeting, time: new Date() }])
    historyRef.current = [{ role: 'assistant', content: greeting }]
    setAiSpeaking(true)
    serverAudioPlayingRef.current = true
    if (voiceEnabled) { playReply(greeting, null) }
  }

  const handleConsent = () => {
    try { const primer = new SpeechSynthesisUtterance(''); window.speechSynthesis.speak(primer); window.speechSynthesis.cancel() } catch (_) {}
    setStage('entering')
  }

  // VAD interrupt handler — called from draw loop when candidate speaks over AI
  useEffect(() => {
    window.__geplyInterrupt = () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null }
      voice.stopSpeaking?.()
      serverAudioPlayingRef.current = false
      clearInterval(revealTimerRef.current); setRevealedWordCount(null); setAiSpeaking(false)
      setTimeout(() => voice.startListening?.(), 150)
    }
    return () => { delete window.__geplyInterrupt }
  })

  const toggleVideo = () => { const t = streamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setVideoEnabled(t.enabled) } }

  const toggleAudio = () => {
    if (aiSpeaking || voice.isSpeaking || serverAudioPlayingRef.current) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null }
      try { window.speechSynthesis?.cancel() } catch (_) {}
      voice.stopSpeaking?.()
      serverAudioPlayingRef.current = false
      clearInterval(revealTimerRef.current); setRevealedWordCount(null); setAiSpeaking(false)
      setTimeout(() => voice.startListening?.(), 150)
      return
    }
    const t = streamRef.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; setAudioEnabled(t.enabled) }
  }

  const endInterview = async () => {
    if (ending) return; setEnding(true)
    clearInterval(revealTimerRef.current); clearTimeout(autoEndTimerRef.current); interviewEndingRef.current = true
    try { voice.stop?.() } catch (_) {}
    try { voice.stopAll?.() } catch (_) {}
    try { window.speechSynthesis?.cancel() } catch (_) {}
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null } } catch (_) {}
    streamRef.current?.getTracks().forEach(t => t.stop())
    try { await axios.post(`/api/v1/internal/interview/${roomData.interview_id}/end`, { transcript: historyRef.current, screenshots: screenshotsRef.current }) } catch (err) { console.error('Failed to submit transcript:', err) }
    setStage('ended')
    setTimeout(() => { try { window.close() } catch (_) {} }, 5000)
  }

  const EXIT_PHRASES = ["pass this along to the recruiter", "i'll pass this along", "thank you for your time", "recruiter will be in touch", "recruiter will reach out", "reach out at a better time", "take care", "have a great day", "have a good day", "all the best", "best of luck"]
  const isExitReply = (text) => EXIT_PHRASES.some(p => text.toLowerCase().includes(p))

  const audioRef = useRef(null)
  const serverAudioPlayingRef = useRef(false)

  const playBase64Audio = useCallback(async (base64mp3, onEnd, onError) => {
    try {
      const binary = atob(base64mp3); const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'audio/mpeg' }); const url = URL.createObjectURL(blob)
      const audio = new Audio(url); audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); if (audioRef.current === audio) audioRef.current = null; onEnd?.() }
      audio.onerror = (e) => { URL.revokeObjectURL(url); if (audioRef.current === audio) audioRef.current = null; onError?.(e) }
      await audio.play()
    } catch (e) { onError?.(e) }
  }, [])

  const onAudioFinished = useCallback(() => {
    serverAudioPlayingRef.current = false; clearInterval(revealTimerRef.current); setRevealedWordCount(null); setAiSpeaking(false)
    if (interviewEndingRef.current && !ending) { clearTimeout(autoEndTimerRef.current); autoEndTimerRef.current = setTimeout(() => endInterview(), 1500); return }
    if (voiceEnabled && !interviewEndingRef.current) { setTimeout(() => { if (!serverAudioPlayingRef.current) voice.startListening?.() }, 150) }
  }, [voiceEnabled, ending, voice])

  const playReply = useCallback((text, audioB64) => {
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null } } catch (_) {}
    voice.stopAll?.(); try { window.speechSynthesis?.cancel() } catch (_) {}
    serverAudioPlayingRef.current = true
    if (audioB64) {
      playBase64Audio(audioB64, onAudioFinished, () => { serverAudioPlayingRef.current = false; voice.speak(text) })
    } else {
      serverAudioPlayingRef.current = false; voice.speak(text)
    }
  }, [voice, onAudioFinished, playBase64Audio])

  const sendMessage = async (overrideText) => {
    const userMsg = typeof overrideText === 'string' ? overrideText : (showCodeInput ? codeInputMsg.trim() : inputMsg.trim())
    if (!userMsg || sending) return; if (interviewEndingRef.current) return
    if (typeof overrideText !== 'string') { if (showCodeInput) { setCodeInputMsg(''); setShowCodeInput(false) } else setInputMsg('') }
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', text: userMsg, time: new Date() }])
    historyRef.current.push({ role: 'user', content: userMsg })
    let reply = ''
    try {
      const { data } = await axios.post('/api/v1/internal/chat', { interview_id: roomData.interview_id, message: userMsg, history: historyRef.current, job_title: roomData.job_title, candidate_name: roomData.candidate_name })
      reply = data.reply || ''
    } catch { reply = "Could you please repeat that?" } finally { setSending(false) }
    setMessages(prev => [...prev, { role: 'agent', text: reply, time: new Date() }])
    historyRef.current.push({ role: 'assistant', content: reply })
    if (isExitReply(reply)) interviewEndingRef.current = true
    setAiSpeaking(true); serverAudioPlayingRef.current = true
    if (voiceEnabled && isCodingQuestion(reply) && !interviewEndingRef.current) setShowCodeInput(true)
    if (!voiceEnabled) return
    playReply(reply, null)
  }

  sendMessageRef.current = sendMessage

  if (stage === 'error') return (<div className="hi-room" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.base }}><div style={{ textAlign: 'center', maxWidth: '320px' }}><div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><AlertTriangle size={24} color="#fb7185" /></div><div style={{ fontSize: '18px', fontWeight: 600, color: T.textPrimary, marginBottom: '8px' }}>Something went wrong</div><div style={{ fontSize: '13px', color: T.textMuted }}>{error}</div></div></div>)
  if (stage === 'loading') return (<div className="hi-room" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.base }}><div style={{ width: '36px', height: '36px', border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'hi-spin 0.8s linear infinite' }} /></div>)
  if (stage === 'consent') return <ConsentScreen jobTitle={roomData?.job_title || 'Position'} onConsent={handleConsent} />
  if (stage === 'ended') return (<div className="hi-room" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.base }}><div style={{ textAlign: 'center', maxWidth: '360px', ...glass, borderRadius: '24px', padding: '40px', boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}><div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><CheckCircle size={28} color="#4ade80" /></div><div style={{ fontSize: '20px', fontWeight: 600, color: T.textPrimary, marginBottom: '10px' }}>Interview Complete</div><div style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.7 }}>Thank you, <strong style={{ color: T.textPrimary }}>{roomData?.candidate_name}</strong>! Your responses have been submitted. The recruiter will be in touch soon.</div></div></div>)

  if (stage === 'entering') return (
    <div className="hi-room" style={{ height: '100vh', background: T.base, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <MonitoringToast visible={showToast} />
      <div style={{ position: 'relative', width: '100%', maxWidth: '720px', aspectRatio: '16/9', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <CountdownScreen videoRef={videoRef} count={countdown} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', ...glass, borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 500, color: T.textPrimary }}>{roomData?.candidate_name}</div>
      </div>
    </div>
  )

  return (
    <div className="hi-room" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: T.base, overflow: 'hidden' }}>
      <MonitoringToast visible={showToast} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', ...glass, borderBottom: T.glassBorder, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f43f5e', animation: 'hi-pulse 1.5s ease-in-out infinite', boxShadow: '0 0 6px rgba(244,63,94,0.5)' }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: T.textPrimary }}>{roomData?.job_title}</span>
          <span style={{ fontSize: '11px', color: T.textFaint, background: 'rgba(255,255,255,0.04)', border: T.glassBorder, padding: '2px 8px', borderRadius: '6px' }}>LIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {warningCount > 0 && <span style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 10px', borderRadius: '8px' }}>{warningCount} warning{warningCount > 1 ? 's' : ''}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Shield size={12} color="#4ade80" /><span style={{ fontSize: '11px', color: T.textFaint }}>Monitored</span></div>
        </div>
      </div>

      {proctorWarning && <div style={{ background: 'rgba(244,63,94,0.12)', borderBottom: '1px solid rgba(244,63,94,0.2)', color: '#fda4af', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 20px', flexShrink: 0, animation: 'hi-slide 0.2s ease-out' }}><AlertTriangle size={14} /> {proctorWarning} <span style={{ opacity: 0.6, fontSize: '11px' }}>(#{warningCount})</span></div>}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '760px', aspectRatio: '16/9', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            {!videoEnabled && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a14', gap: '12px' }}><VideoOff size={36} color="rgba(148,163,184,0.3)" /><span style={{ fontSize: '12px', color: T.textFaint }}>Camera off</span></div>}
            <div style={{ position: 'absolute', bottom: '14px', left: '14px' }}><div style={{ ...glass, padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, color: T.textPrimary }}>{roomData?.candidate_name}</div></div>
            <div style={{ position: 'absolute', bottom: '14px', right: '14px', ...glass, borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}><Mic size={12} color={!audioEnabled ? '#f43f5e' : voice.isListening ? '#818cf8' : '#4ade80'} /><canvas ref={canvasRef} width={72} height={16} style={{ display: 'block' }} /></div>
            <div style={{ position: 'absolute', top: '14px', right: '14px', width: '140px', height: '140px' }}>
              {(aiSpeaking || voice.isSpeaking) && <div style={{ position: 'absolute', bottom: '34px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}><GeplySpeakingWave visible={true} /></div>}
              <AIAvatar isSpeaking={aiSpeaking || voice.isSpeaking} name={roomData?.recruiter_name ? `${roomData.recruiter_name.split(' ')[0]}'s AI` : 'AI'} avatarUrl={roomData?.recruiter_avatar || null} />
            </div>
          </div>
        </div>

        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', ...glass, borderLeft: T.glassBorder }}>
          <div style={{ padding: '14px 16px', borderBottom: T.glassBorder, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: (aiSpeaking || voice.isSpeaking) ? '#818cf8' : voice.isListening ? '#f43f5e' : 'rgba(255,255,255,0.2)', boxShadow: (aiSpeaking || voice.isSpeaking) ? '0 0 6px rgba(129,140,248,0.6)' : voice.isListening ? '0 0 6px rgba(244,63,94,0.6)' : 'none', animation: (aiSpeaking || voice.isSpeaking || voice.isListening) ? 'hi-pulse 1.5s ease-in-out infinite' : 'none', transition: 'all 0.3s' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: T.textPrimary }}>Interview Chat</span>
              </div>
              <ModeToggle voiceEnabled={voiceEnabled} isSupported={voice.isSupported} onToggle={() => { const next = !voiceEnabled; setVoiceEnabled(next); if (!next) { voice.stopAll(); setShowCodeInput(false) } }} />
            </div>
            <p style={{ fontSize: '11px', color: T.textFaint, marginLeft: '15px' }}>{roomData?.recruiter_name?.split(' ')[0] || 'AI'}'s AI Assistant{sending ? ' — thinking' : (aiSpeaking || voice.isSpeaking) ? ' — speaking' : voice.isListening ? ' — listening' : ' — connected'}</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, i) => {
              const isLatestAgent = msg.role === 'agent' && i === messages.length - 1
              const displayText = (isLatestAgent && revealedWordCount !== null && voiceEnabled) ? msg.text.split(/\s+/).slice(0, revealedWordCount).join(' ') : msg.text
              return (
                <div key={i} className="hi-msg" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role === 'agent' && <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px', marginTop: '2px', flexShrink: 0 }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8' }} /></div>}
                  <div style={{ maxWidth: '82%', padding: '9px 13px', fontSize: '13px', lineHeight: 1.55, borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.055)', border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)', color: msg.role === 'user' ? 'white' : T.textPrimary, boxShadow: msg.role === 'user' ? '0 4px 16px rgba(99,102,241,0.25)' : 'none' }}>
                    {displayText}
                    {isLatestAgent && revealedWordCount !== null && voiceEnabled && <span style={{ display: 'inline-block', width: '2px', height: '12px', background: '#818cf8', marginLeft: '3px', verticalAlign: 'middle', animation: 'hi-pulse 0.8s infinite' }} />}
                  </div>
                </div>
              )
            })}
            {sending && <div className="hi-msg" style={{ display: 'flex', justifyContent: 'flex-start' }}><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px', marginTop: '2px', flexShrink: 0 }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', animation: 'hi-pulse 1s infinite' }} /></div><div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '5px' }}>{[0,150,300].map(d => <div key={d} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#818cf8', animation: `hi-bounce 0.9s ease-in-out ${d}ms infinite` }} />)}</div></div>}
            {voiceEnabled && <InterimTranscript text={voice.interimText} />}
            <div ref={chatEndRef} />
          </div>

          {voiceEnabled && !showCodeInput ? (
            <div style={{ padding: '16px', borderTop: T.glassBorder, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.015)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: (aiSpeaking || voice.isSpeaking) ? 'rgba(99,102,241,0.15)' : voice.isListening ? 'rgba(244,63,94,0.15)' : 'rgba(34,197,94,0.1)',
                  border: (aiSpeaking || voice.isSpeaking) ? '2px solid #6366f1' : voice.isListening ? '2px solid #f43f5e' : '2px solid rgba(34,197,94,0.3)',
                  transition: 'all 0.3s',
                  animation: voice.isListening ? 'hi-pulse 1.5s ease-in-out infinite' : 'none',
                }}>
                  <Mic size={20} color={(aiSpeaking || voice.isSpeaking) ? '#818cf8' : voice.isListening ? '#f43f5e' : '#4ade80'} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: (aiSpeaking || voice.isSpeaking) ? '#818cf8' : voice.isListening ? '#f43f5e' : '#4ade80' }}>
                  {(aiSpeaking || voice.isSpeaking) ? 'AI SPEAKING' : voice.isListening ? 'LISTENING' : sending ? 'THINKING...' : 'CONNECTED'}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(148,163,184,0.5)', marginTop: '2px' }}>
                  {(aiSpeaking || voice.isSpeaking) ? 'Speak to interrupt' : voice.isListening ? 'Speak naturally...' : 'Like a phone call'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', borderTop: T.glassBorder, flexShrink: 0 }}>
              {voiceEnabled && showCodeInput && <div style={{ fontSize: '10px', color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />Code answer detected — type your response</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={showCodeInput ? codeInputMsg : inputMsg} onChange={e => showCodeInput ? setCodeInputMsg(e.target.value) : setInputMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={showCodeInput ? 'Type your code or answer...' : 'Type your answer...'} className="hi-input" autoFocus={showCodeInput} style={{ flex: 1, padding: '9px 13px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: T.textPrimary, fontSize: '13px', fontFamily: showCodeInput ? 'DM Mono, monospace' : 'DM Sans, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s' }} />
                <button onClick={() => sendMessage()} disabled={sending || !(showCodeInput ? codeInputMsg.trim() : inputMsg.trim())} className="hi-send" style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', fontSize: '13px', fontWeight: 600, opacity: sending ? 0.4 : 1, transition: 'all 0.18s', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 12px rgba(99,102,241,0.3)' }}>Send</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 20px', ...glass, borderTop: T.glassBorder, flexShrink: 0 }}>
        {/* Camera toggle only — mic is always on (phone-call style) */}
        <button onClick={toggleVideo} title={videoEnabled ? 'Stop camera' : 'Start camera'} className="hi-ctrl" style={{ width: '44px', height: '44px', borderRadius: '12px', border: videoEnabled ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(244,63,94,0.2)', cursor: 'pointer', background: videoEnabled ? 'rgba(255,255,255,0.07)' : 'rgba(244,63,94,0.15)', color: videoEnabled ? T.textPrimary : '#fb7185', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>{videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}</button>
        <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.07)', margin: '0 4px' }} />
        <button onClick={endInterview} disabled={ending} className="hi-ctrl" title="End interview" style={{ width: '52px', height: '44px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.25)', cursor: ending ? 'not-allowed' : 'pointer', background: 'rgba(244,63,94,0.18)', color: '#fb7185', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s', boxShadow: '0 2px 12px rgba(244,63,94,0.2)' }}>{ending ? <Loader2 size={18} style={{ animation: 'hi-spin 1s linear infinite' }} /> : <PhoneOff size={18} />}</button>
      </div>
    </div>
  )
}
