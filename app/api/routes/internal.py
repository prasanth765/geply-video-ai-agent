"""
internal.py — Interview AI route handlers.

Clean separation of concerns:
  - Route handlers: thin, delegate to services
  - Prompt building: prompt_builder.py (single source of truth)
  - TTS: tts_service.py

Architecture note on TTS:
  /chat returns only the LLM reply (text). No audio.
  Frontend fetches /tts separately in background after reply appears.
  This decouples LLM latency (~0.5s) from TTS latency (~2-3s on proxy).
  Result: text bubble appears immediately, Aria audio arrives ~2s later.
"""
from __future__ import annotations

import base64
import threading
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse
from sqlalchemy import text

import httpx
import structlog

from app.api.deps import DBSession
from app.core.config import get_settings
from app.core.constants import CHAT_MAX_TOKENS, CHAT_TEMPERATURE, CHAT_HISTORY_WINDOW
from app.core.exceptions import EntityNotFound
from app.repositories.candidate_repo import CandidateRepository
from app.repositories.interview_repo import InterviewRepository
from app.repositories.job_repo import JobRepository
from app.repositories.user_repo import UserRepository
from app.services.interview_service import InterviewService
from app.services.prompt_builder import build_interview_prompt

logger = structlog.get_logger()
router = APIRouter(prefix="/internal", tags=["internal"])


# ── Interview context (used by frontend to load room) ──────────────────────────
@router.get("/interview-context/{room_name}")
async def get_interview_context(room_name: str, db: DBSession) -> dict:
    interview_repo = InterviewRepository(db)
    interview = await interview_repo.get_by_room(room_name)
    if not interview:
        raise EntityNotFound("Interview", room_name)

    candidate_repo = CandidateRepository(db)
    candidate = await candidate_repo.get_by_id(interview.candidate_id)
    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(interview.job_id)
    if not candidate or not job:
        raise EntityNotFound("Context", room_name)

    recruiter_name   = "Your"
    recruiter_avatar = None
    if job.recruiter_id:
        user_repo = UserRepository(db)
        rec = await user_repo.get_by_id(job.recruiter_id)
        if rec:
            recruiter_name = (rec.full_name or "").split()[0] or "Your"
            settings = get_settings()
            avatar_dir = Path(settings.storage_local_path) / "avatars"
            for ext in (".png", ".webp", ".jpg", ".jpeg"):
                p = avatar_dir / f"{rec.id}{ext}"
                if p.exists() and p.stat().st_size > 1024:
                    recruiter_avatar = f"/api/v1/auth/avatar/{rec.id}{ext}"
                    break

    return {
        "interview_id":         interview.id,
        "candidate_id":         candidate.id,
        "candidate_name":       candidate.full_name,
        "candidate_email":      candidate.email,
        "resume_text":          candidate.resume_raw_text,
        "job_id":               job.id,
        "job_title":            job.title,
        "jd_text":              job.jd_raw_text or job.description,
        "requirements":         job.requirements,
        "max_questions":        job.max_questions,
        "duration_minutes":     job.interview_duration_minutes,
        "difficulty_level":     job.difficulty_level,
        "recruiter_first_name": recruiter_name,
        "recruiter_avatar":     recruiter_avatar,   # key must match frontend roomData
    }


# ── Interview lifecycle ────────────────────────────────────────────────────────
@router.post("/interview/{interview_id}/start")
async def mark_interview_started(interview_id: str, db: DBSession) -> dict:
    service = InterviewService(db)
    interview = await service.start_interview(interview_id)
    return {"status": "started", "interview_id": interview.id}


@router.post("/interview/{interview_id}/end")
async def mark_interview_ended(interview_id: str, request: Request, db: DBSession) -> dict:
    body = await request.json()
    raw  = body.get("transcript", "")
    transcript = (
        _format_transcript(raw) if isinstance(raw, list) else str(raw)
    )

    service   = InterviewService(db)
    interview = await service.end_interview(
        interview_id = interview_id,
        transcript   = transcript,
        questions    = body.get("questions"),
        answers      = body.get("answers"),
        scores       = body.get("scores"),
    )

    screenshots = body.get("screenshots", [])
    if screenshots:
        _save_screenshots(interview_id, screenshots)

    await db.commit()

    from app.workers.report_worker import generate_report_sync
    threading.Thread(
        target=generate_report_sync, args=(interview_id,), daemon=True
    ).start()

    logger.info("interview_ended",
                interview_id=interview.id,
                transcript_length=len(transcript),
                screenshots_count=len(screenshots),
                duration_seconds=interview.duration_seconds)

    return {
        "status":           "ended",
        "interview_id":     interview.id,
        "duration_seconds": interview.duration_seconds,
    }


# ── Chat — LLM only, no TTS (TTS fetched separately by frontend) ──────────────
@router.post("/chat")
async def chat_with_ai(request: Request, db: DBSession) -> dict:
    """
    Returns: {"reply": str}  — text only, no audio field.

    Frontend calls /tts separately in background after receiving reply.
    This means: text bubble appears in ~0.5s (LLM only).
    Audio arrives ~2-3s later from the parallel /tts call.
    """
    body           = await request.json()
    interview_id   = body.get("interview_id", "")
    history        = body.get("history", [])
    job_title      = body.get("job_title", "")
    candidate_name = body.get("candidate_name", "")

    settings = get_settings()

    # ── Fetch all context from DB ──────────────────────────────────────────
    jd_text          = ""
    requirements     = ""
    resume_text      = ""
    office_locations = ""
    shift_info       = "Any shift"
    recruiter_first  = "Your"
    company_kb       = ""

    if interview_id:
        try:
            interview_repo = InterviewRepository(db)
            interview      = await interview_repo.get_by_id(interview_id)

            if interview:
                job_repo = JobRepository(db)
                job      = await job_repo.get_by_id(interview.job_id)

                if job:
                    jd_text          = job.jd_raw_text or job.description or ""
                    requirements     = job.requirements or ""
                    office_locations = (
                        getattr(job, "office_locations", None)
                        or ""
                    )
                    shift_info = (
                        getattr(job, "shift_info", None)
                        or "Any shift"
                    )

                    # Recruiter first name only (company is always G-E-P)
                    try:
                        user_repo = UserRepository(db)
                        recruiter = await user_repo.get_by_id(job.recruiter_id)
                        if recruiter:
                            recruiter_first = (
                                (recruiter.full_name or "").split()[0] or "Your"
                            )
                    except Exception as exc:
                        logger.warning("recruiter_fetch_failed", error=str(exc))

                candidate_repo = CandidateRepository(db)
                candidate      = await candidate_repo.get_by_id(interview.candidate_id)
                if candidate:
                    resume_text = candidate.resume_raw_text or ""

            # ── Fetch KB from app_settings (NOT from users.company_kb legacy field) ──
            # The KB saved on the Profile page is stored in app_settings table.
            # users.company_kb is a legacy field that is no longer used.
            try:
                kb_row = await db.execute(
                    text("SELECT value FROM app_settings WHERE key = 'company_kb'")
                )
                kb_row = kb_row.fetchone()
                company_kb = kb_row[0] if kb_row else ""
            except Exception as exc:
                logger.warning("kb_fetch_failed", error=str(exc))

        except Exception as exc:
            logger.warning("context_fetch_failed", error=str(exc))

    # ── Build prompt (single source of truth in prompt_builder.py) ────────
    system_prompt = build_interview_prompt(
        job_title            = job_title,
        candidate_name       = candidate_name,
        recruiter_first_name = recruiter_first,
        jd_text              = jd_text,
        requirements         = requirements,
        resume_text          = resume_text,
        office_locations     = office_locations,
        shift_info           = shift_info,
        company_kb           = company_kb,
    )

    # ── Guard: reject empty/noise input ──
    last_user_msg = ""
    if history:
        last_entry = history[-1] if history else {}
        if last_entry.get("role") == "user":
            last_user_msg = last_entry.get("content", "").strip()
    
    if last_user_msg and len(last_user_msg) < 2:
        return {"reply": "Sorry, I didn't catch that. Could you say that again?"}
    
    # Short input guard removed - let LLM handle intent

    # ── Build messages — 14 entries = 7 full exchanges ─────────────────────
    messages = [{"role": "system", "content": system_prompt}]
    for entry in history[-CHAT_HISTORY_WINDOW:]:
        role = "assistant" if entry.get("role") == "assistant" else "user"
        messages.append({"role": role, "content": entry.get("content", "")})

    # ── LLM call ──────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.post(
                f"{settings.llm_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       settings.llm_model,
                    "messages":    messages,
                    "max_tokens":  CHAT_MAX_TOKENS,
                    "temperature": CHAT_TEMPERATURE,
                },
            )
            if not resp.is_success:
                logger.error("llm_error",
                             status=resp.status_code, body=resp.text[:300])
                return {"reply": "Could you please repeat that?"}

            reply = resp.json()["choices"][0]["message"]["content"].strip()
            logger.info("llm_ok",
                        words=len(reply.split()), preview=reply[:80])
            return {"reply": reply}

    except Exception as exc:
        logger.error("llm_failed", error=str(exc))
        return {"reply": "Could you please repeat that?"}


# ── TTS — called by frontend after /chat returns ───────────────────────────────
@router.post("/tts")
async def text_to_speech(request: Request) -> dict:
    """
    Generates Aria (edge-tts) audio for any text.
    Called by frontend independently of /chat so latencies don't stack.
    Returns: {"audio": base64_mp3_string} or {"audio": null} on failure.
    Frontend plays audio when it arrives; falls back to browser TTS on timeout.
    """
    body = await request.json()
    tts_text = body.get("text", "")
    if not tts_text:
        return {"audio": None}

    from app.services.tts_service import generate_audio
    audio_b64 = await generate_audio(tts_text)
    return {"audio": audio_b64}


# ── Screenshot serving ────────────────────────────────────────────────────────
@router.get("/screenshot/{interview_id}/{filename}")
async def serve_screenshot(interview_id: str, filename: str) -> FileResponse:
    settings = get_settings()
    filepath = (
        Path(settings.storage_local_path) / "screenshots" / interview_id / filename
    )
    if not filepath.exists():
        raise EntityNotFound("Screenshot", filename)
    return FileResponse(str(filepath), media_type="image/jpeg")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _format_transcript(messages: list[dict]) -> str:
    lines = []
    for msg in messages:
        role    = msg.get("role", "unknown")
        content = msg.get("content", "").strip()
        if not content:
            continue
        if role in ("assistant", "agent"):
            lines.append(f"Interviewer: {content}")
        elif role == "user":
            lines.append(f"Candidate: {content}")
        else:
            lines.append(f"{role}: {content}")
    return "\n\n".join(lines)


def _save_screenshots(interview_id: str, screenshots: list[dict]) -> None:
    settings       = get_settings()
    screenshot_dir = (
        Path(settings.storage_local_path) / "screenshots" / interview_id
    )
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    for i, ss in enumerate(screenshots[:15]):
        try:
            image_data = ss.get("image", "")
            if not image_data:
                continue
            if "base64," in image_data:
                image_data = image_data.split("base64,", 1)[1]
            event_type = ss.get("event_type", "unknown").replace("/", "_")
            (screenshot_dir / f"{i:02d}_{event_type}.jpg").write_bytes(
                base64.b64decode(image_data)
            )
        except Exception as exc:
            logger.warning("screenshot_save_failed", index=i, error=str(exc))
