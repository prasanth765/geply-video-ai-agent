// services/voice/stt.js
const SILENCE_MS = 5000
const SETTLE_MS  = 800
const MIN_WORDS  = 2

export function createSTT({ onInterim, onFinal, onError, onEnd }) {
  let recognition = null
  let silenceTimer = null
  let settleTimer = null
  let accumulatedText = ''
  let finalFired = false
  let speechDetected = false

  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  function _clearTimers() {
    clearTimeout(silenceTimer); clearTimeout(settleTimer)
    silenceTimer = null; settleTimer = null
  }

  function _isSubstantial(text) {
    const words = text.trim().split(/\s+/).filter(w => w.length >= 2)
    return words.length >= MIN_WORDS
  }

  function _fireFinal(text) {
    if (finalFired) return
    const trimmed = text.trim()
    if (!trimmed) { onEnd?.(); return }
    const words = trimmed.split(/\s+/)
    const isShortResponse = words.length === 1 && trimmed.length >= 2
    if (!isShortResponse && !_isSubstantial(trimmed)) {
      onEnd?.(); return
    }
    finalFired = true; _stop(); onFinal?.(trimmed)
  }

  function _resetSilenceTimer(text) {
    _clearTimers()
    silenceTimer = setTimeout(() => {
      settleTimer = setTimeout(() => {
        if (!finalFired && text.trim()) _fireFinal(text)
      }, SETTLE_MS)
    }, SILENCE_MS)
  }

  function _stop() {
    _clearTimers()
    try { recognition?.stop() } catch (_) {}
  }

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { onError?.('not_supported'); return }
    _clearTimers()
    try { recognition?.abort() } catch (_) {}
    accumulatedText = ''; finalFired = false; speechDetected = false
    recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t; else interim += t
      }
      const latest = final || interim
      if (latest) {
        accumulatedText = latest; speechDetected = true
        onInterim?.(latest); _resetSilenceTimer(latest)
      }
      if (final.trim() && !finalFired) { _clearTimers(); _fireFinal(final.trim()) }
    }

    recognition.onerror = (event) => {
      _clearTimers()
      if (event.error === 'no-speech') { onEnd?.(); return }
      if (event.error === 'aborted') return
      console.error('[STT] error:', event.error); onError?.(event.error)
    }

    recognition.onend = () => {
      _clearTimers()
      if (!finalFired) {
        const trimmed = accumulatedText.trim()
        if (trimmed) _fireFinal(trimmed); else onEnd?.()
      }
    }

    try { recognition.start() } catch (e) { console.error('[STT] start error:', e); onError?.('start_failed') }
  }

  function stop() { _clearTimers(); try { recognition?.stop() } catch (_) {} }
  function abort() { _clearTimers(); try { recognition?.abort() } catch (_) {}; recognition = null }

  return { start, stop, abort, isSupported }
}
