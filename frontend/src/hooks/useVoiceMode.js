import { useState, useRef, useCallback, useEffect } from "react";
import { VOICE_STATE } from "../services/voice/voiceState";
import { createSTT } from "../services/voice/stt";
import { createTTS } from "../services/voice/tts";

export { VOICE_STATE };

const AUTO_LISTEN_DELAY = 150;
const ERROR_RESTART_DELAY = 600;
const EMPTY_RESTART_DELAY = 300;

export function useVoiceMode({ enabled = true, alwaysOn = false, onTranscript }) {
  const [voiceState, setVoiceState] = useState(VOICE_STATE.IDLE);
  const [interimText, setInterimText] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const stateRef = useRef(VOICE_STATE.IDLE);
  const sttRef = useRef(null);
  const ttsRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);
  const alwaysOnRef = useRef(alwaysOn);
  const enabledRef = useRef(enabled);
  const autoListenTimer = useRef(null);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { alwaysOnRef.current = alwaysOn; }, [alwaysOn]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const setState = useCallback((s) => { stateRef.current = s; setVoiceState(s); }, []);

  useEffect(() => {
    setIsSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition) && !!window.speechSynthesis);
  }, []);

  useEffect(() => {
    sttRef.current = createSTT({
      onInterim: (text) => setInterimText(text),
      onFinal: (text) => { setInterimText(""); setState(VOICE_STATE.PROCESSING); onTranscriptRef.current?.(text); },
      onError: (err) => {
        if (err !== "not_supported" && err !== "aborted") console.warn("[Voice] STT error:", err);
        if (stateRef.current === VOICE_STATE.LISTENING) {
          setState(VOICE_STATE.IDLE); setInterimText("");
          if (alwaysOnRef.current && enabledRef.current) { clearTimeout(autoListenTimer.current); autoListenTimer.current = setTimeout(_startListening, ERROR_RESTART_DELAY); }
        }
      },
      onEnd: () => {
        if (stateRef.current === VOICE_STATE.LISTENING) {
          setState(VOICE_STATE.IDLE); setInterimText("");
          if (alwaysOnRef.current && enabledRef.current) { clearTimeout(autoListenTimer.current); autoListenTimer.current = setTimeout(_startListening, EMPTY_RESTART_DELAY); }
        }
      },
    });
    ttsRef.current = createTTS({
      onStart: () => setState(VOICE_STATE.SPEAKING),
      onEnd: () => { setState(VOICE_STATE.IDLE); if (alwaysOnRef.current && enabledRef.current) { clearTimeout(autoListenTimer.current); autoListenTimer.current = setTimeout(_startListening, AUTO_LISTEN_DELAY); } },
      onError: (err) => { console.warn("[Voice] TTS error:", err); setState(VOICE_STATE.IDLE); if (alwaysOnRef.current && enabledRef.current) { clearTimeout(autoListenTimer.current); autoListenTimer.current = setTimeout(_startListening, AUTO_LISTEN_DELAY); } },
    });
    return () => { clearTimeout(autoListenTimer.current); sttRef.current?.abort(); ttsRef.current?.stop(); };
  }, [setState]);

  function _startListening() {
    if (!enabledRef.current) return;
    if (stateRef.current === VOICE_STATE.SPEAKING) return;
    if (stateRef.current === VOICE_STATE.PROCESSING) return;
    setState(VOICE_STATE.LISTENING); sttRef.current?.start();
  }

  const startListening = useCallback(() => { ttsRef.current?.stop(); _startListening(); }, []);
  const stopListening = useCallback(() => { clearTimeout(autoListenTimer.current); sttRef.current?.stop(); setInterimText(""); if (stateRef.current === VOICE_STATE.LISTENING) setState(VOICE_STATE.IDLE); }, [setState]);
  const speak = useCallback((text) => { if (!enabled || !text?.trim()) return; sttRef.current?.abort(); setInterimText(""); ttsRef.current?.speak(text); }, [enabled]);
  const stopSpeaking = useCallback(() => { clearTimeout(autoListenTimer.current); ttsRef.current?.stop(); if (stateRef.current === VOICE_STATE.SPEAKING) setState(VOICE_STATE.IDLE); }, [setState]);
  const stopAll = useCallback(() => { clearTimeout(autoListenTimer.current); sttRef.current?.abort(); ttsRef.current?.stop(); setInterimText(""); setState(VOICE_STATE.IDLE); }, [setState]);

  useEffect(() => { if (!enabled) { clearTimeout(autoListenTimer.current); sttRef.current?.abort(); ttsRef.current?.stop(); setInterimText(""); setState(VOICE_STATE.IDLE); } }, [enabled, setState]);

  return { voiceState, interimText, isSupported, isIdle: voiceState === VOICE_STATE.IDLE, isListening: voiceState === VOICE_STATE.LISTENING, isProcessing: voiceState === VOICE_STATE.PROCESSING, isSpeaking: voiceState === VOICE_STATE.SPEAKING, startListening, stopListening, speak, stopSpeaking, stopAll };
}
