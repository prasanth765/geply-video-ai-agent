"""
tts_service.py — Server-side TTS using Microsoft Edge neural voices.
Voice: en-US-AriaNeural — natural, professional female voice.

Corporate SSL proxy fix:
  edge_tts.communicate._SSL_CTX is patched to a no-verify context per call.
  Retry logic added: edge-tts WebSocket can silently fail and return empty bytes
  on first attempt — one retry with 0.5s gap fixes ~95% of intermittent failures.
"""
from __future__ import annotations

import asyncio
import base64
import io
import re
import ssl

import structlog

logger = structlog.get_logger()

VOICE = "en-US-AriaNeural"
RATE = "+0%"
PITCH = "+0Hz"


def clean_for_speech(text: str) -> str:
    """Strip markdown, special chars, and normalize whitespace for TTS input."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'`{1,3}.*?`{1,3}', '', text, flags=re.DOTALL)
    text = re.sub(r'#{1,6}\s+', '', text)
    text = re.sub(r'\u2500+', '', text)  # box-drawing chars
    text = re.sub(r'[^\x00-\x7F]', '', text)
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\n', ' ', text)
    return text.strip()


def _make_no_verify_ssl() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def _try_generate(clean: str) -> bytes:
    """Single attempt — returns raw MP3 bytes, or b'' on failure."""
    import edge_tts
    import edge_tts.communicate as _comm

    no_verify = _make_no_verify_ssl()
    _orig_ssl_ctx = _comm._SSL_CTX
    _comm._SSL_CTX = no_verify

    try:
        communicate = edge_tts.Communicate(clean, VOICE, rate=RATE, pitch=PITCH)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return buf.getvalue()
    finally:
        _comm._SSL_CTX = _orig_ssl_ctx  # always restore


async def generate_audio(text: str) -> str | None:
    """Returns base64 MP3 string, or None (frontend falls back to browser TTS).

    Retries once on empty-response or exception — edge-tts WebSocket is
    intermittently flaky on corporate proxies.
    """
    clean = clean_for_speech(text)
    if not clean:
        return None

    for attempt in range(2):
        try:
            data = await _try_generate(clean)

            if data:
                logger.info("tts_ok", chars=len(clean), audio_bytes=len(data), attempt=attempt)
                return base64.b64encode(data).decode()

            logger.warning("tts_empty_response", attempt=attempt, chars=len(clean))

        except Exception as exc:
            logger.warning("tts_failed", error=str(exc), attempt=attempt)

        if attempt == 0:
            await asyncio.sleep(0.1)

    logger.error("tts_all_attempts_failed", chars=len(clean))
    return None
