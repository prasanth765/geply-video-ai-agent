// services/voice/tts.js
function cleanForSpeech(text) {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\u2500+/g, '')
    .replace(/>\s+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/G-E-P/g, 'GEP')
    .replace(/C-T-C/g, 'CTC')
    .replace(/  +/g, ' ')
    .trim()
}

function pickBestVoice() {
  const voices = window.speechSynthesis?.getVoices() || []
  if (!voices.length) return null
  return (
    voices.find(v => v.name.includes('Aria') && v.lang.startsWith('en')) ||
    voices.find(v => v.name.includes('Jenny') && v.lang.startsWith('en')) ||
    voices.find(v => v.name.includes('Natasha') && v.lang.startsWith('en')) ||
    voices.find(v => v.name.includes('Samantha')) ||
    voices.find(v => v.name === 'Google UK English Female') ||
    voices.find(v => v.name === 'Google US English Female') ||
    voices.find(v => v.name.includes('Zira')) ||
    voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0] || null
  )
}

function getVoiceSettings(voice) {
  const name = voice?.name || ''
  if (name.includes('Aria') || name.includes('Jenny') || name.includes('Natasha')) return { rate: 0.97, pitch: 1.0 }
  if (name.includes('Zira')) return { rate: 0.90, pitch: 1.0 }
  if (name.includes('Google')) return { rate: 0.88, pitch: 1.05 }
  return { rate: 0.88, pitch: 1.0 }
}

export function createTTS({ onStart, onEnd, onError } = {}) {
  const synth = window.speechSynthesis
  let keepAliveTimer = null

  function isSupported() { return !!window.speechSynthesis }

  function stop() {
    clearInterval(keepAliveTimer); keepAliveTimer = null
    try { synth?.cancel() } catch (_) {}
  }

  function _doSpeak(text) {
    const clean = cleanForSpeech(text)
    if (!clean) { onEnd?.(); return }
    const voice = pickBestVoice()
    const settings = getVoiceSettings(voice)
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.voice = voice
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch
    utterance.volume = 1.0

    utterance.onstart = () => {
      onStart?.()
      clearInterval(keepAliveTimer)
      keepAliveTimer = setInterval(() => {
        if (synth.speaking && !synth.paused) { synth.pause(); synth.resume() }
      }, 10000)
    }
    utterance.onend = () => { clearInterval(keepAliveTimer); keepAliveTimer = null; onEnd?.() }
    utterance.onerror = (e) => {
      clearInterval(keepAliveTimer); keepAliveTimer = null
      if (e.error !== 'interrupted') { console.warn('[TTS] error:', e.error); onError?.(e.error) }
      else onEnd?.()
    }
    synth.speak(utterance)
  }

  function speak(text) {
    if (!synth || !text?.trim()) return
    stop()
    if (synth.getVoices().length > 0) { _doSpeak(text) }
    else {
      const onReady = () => { synth.removeEventListener('voiceschanged', onReady); _doSpeak(text) }
      synth.addEventListener('voiceschanged', onReady)
      setTimeout(() => { synth.removeEventListener('voiceschanged', onReady); if (!synth.speaking) _doSpeak(text) }, 400)
    }
  }

  return { speak, stop, isSupported }
}
