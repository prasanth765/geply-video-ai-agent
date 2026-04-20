"""
Geply Interview Agent
======================
A LiveKit agent that joins interview rooms and conducts AI-powered
technical interviews. Each interview runs in its own room — the agent
auto-scales to handle 100+ concurrent interviews.

Run with:
    python -m agent.interview_agent

The agent listens for new rooms matching the prefix "geply-interview-*"
and dispatches a worker per room.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone

import httpx
import structlog

logger = structlog.get_logger()

# ── Constants ──
ROOM_PREFIX = "geply-interview-"
AGENT_IDENTITY = "geply-agent"


class InterviewSession:
    """Manages state for a single interview session within a LiveKit room."""

    def __init__(
        self,
        room_name: str,
        interview_id: str,
        job_title: str,
        jd_text: str,
        requirements: str,
        resume_text: str,
        max_questions: int,
        duration_minutes: int,
        api_base_url: str,
    ) -> None:
        self.room_name = room_name
        self.interview_id = interview_id
        self.job_title = job_title
        self.jd_text = jd_text
        self.requirements = requirements
        self.resume_text = resume_text
        self.max_questions = max_questions
        self.duration_minutes = duration_minutes
        self.api_base_url = api_base_url

        # State
        self.started_at: float = time.time()
        self.questions_asked: list[dict] = []
        self.answers_received: list[dict] = []
        self.current_question_idx: int = 0
        self.transcript_lines: list[str] = []
        self.is_finished: bool = False
        self.conversation_history: list[dict] = []

    @property
    def elapsed_minutes(self) -> float:
        return (time.time() - self.started_at) / 60.0

    @property
    def should_wrap_up(self) -> bool:
        return (
            self.elapsed_minutes >= self.duration_minutes - 2
            or self.current_question_idx >= self.max_questions
        )

    def add_to_transcript(self, speaker: str, text: str) -> None:
        timestamp = datetime.now(timezone.utc).isoformat()
        self.transcript_lines.append(f"[{timestamp}] {speaker}: {text}")
        self.conversation_history.append({"role": speaker, "content": text})

    def get_full_transcript(self) -> str:
        return "\n".join(self.transcript_lines)


async def fetch_interview_context(
    api_base_url: str,
    room_name: str,
) -> dict | None:
    """Fetch interview + job + candidate data from the API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # We need a custom internal endpoint for this
            resp = await client.get(
                f"{api_base_url}/api/v1/internal/interview-context/{room_name}"
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning("context_fetch_failed", room=room_name, status=resp.status_code)
            return None
    except Exception as exc:
        logger.error("context_fetch_error", room=room_name, error=str(exc))
        return None


async def notify_interview_started(api_base_url: str, interview_id: str) -> None:
    """Tell the API that the interview has started."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{api_base_url}/api/v1/internal/interview/{interview_id}/start"
            )
    except Exception as exc:
        logger.error("start_notification_failed", interview_id=interview_id, error=str(exc))


async def notify_interview_ended(
    api_base_url: str,
    interview_id: str,
    transcript: str,
    questions: list[dict],
    answers: list[dict],
    scores: dict,
) -> None:
    """Tell the API that the interview has ended with results."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(
                f"{api_base_url}/api/v1/internal/interview/{interview_id}/end",
                json={
                    "transcript": transcript,
                    "questions": questions,
                    "answers": answers,
                    "scores": scores,
                },
            )
    except Exception as exc:
        logger.error("end_notification_failed", interview_id=interview_id, error=str(exc))


async def get_ai_response(
    system_prompt: str,
    conversation_history: list[dict],
    llm_base_url: str,
    llm_api_key: str,
    llm_model: str,
) -> str:
    """Get the next response from the LLM for the interview conversation."""
    messages = [{"role": "system", "content": system_prompt}]

    for entry in conversation_history:
        role = "assistant" if entry["role"] == "agent" else "user"
        messages.append({"role": role, "content": entry["content"]})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{llm_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {llm_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": llm_model,
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.error("llm_response_failed", error=str(exc))
        return "I apologize, I had a brief technical issue. Could you please repeat that?"


# ──────────────────────────────────────────────────────────────
# LiveKit Agent Entry Point
# ──────────────────────────────────────────────────────────────

def create_agent_entrypoint():
    """Create the agent entrypoint for livekit-agents framework.

    This function is called by the LiveKit agents framework.
    If you're NOT using livekit-agents SDK (e.g., using raw WebSocket),
    use the standalone_agent() function below instead.
    """
    try:
        from livekit.agents import (
            AutoSubscribe,
            JobContext,
            WorkerOptions,
            cli,
            llm,
        )
        from livekit.agents.voice_assistant import VoiceAssistant
        from livekit.plugins import deepgram, openai, silero

        async def entrypoint(ctx: JobContext):
            room_name = ctx.room.name
            logger.info("agent_joining_room", room=room_name)

            # Fetch context from API
            from app.core.config import get_settings
            settings = get_settings()
            context = await fetch_interview_context(settings.api_url, room_name)

            if not context:
                logger.error("no_context_for_room", room=room_name)
                return

            from agent.question_engine import build_interview_system_prompt
            system_prompt = build_interview_system_prompt(
                job_title=context["job_title"],
                jd_text=context["jd_text"],
                requirements=context["requirements"],
                resume_text=context["resume_text"],
                max_questions=context.get("max_questions", 10),
                duration=context.get("duration_minutes", 30),
            )

            assistant = VoiceAssistant(
                vad=silero.VAD.load(),
                stt=deepgram.STT(),
                llm=openai.LLM(
                    model=settings.llm_model,
                    base_url=settings.llm_base_url,
                    api_key=settings.llm_api_key,
                ),
                tts=openai.TTS(),
                chat_ctx=llm.ChatContext().append(
                    role="system",
                    text=system_prompt,
                ),
            )

            assistant.start(ctx.room)
            await notify_interview_started(settings.api_url, context["interview_id"])

            # Wait for the assistant to finish
            await assistant.say(
                f"Hello! Welcome to your interview for the {context['job_title']} position. "
                "I'll be conducting this interview today. Let's get started. "
                "First, could you tell me a little about yourself and your relevant experience?",
                allow_interruptions=True,
            )

        return entrypoint, WorkerOptions(
            entrypoint_fnc=entrypoint,
            auto_subscribe=AutoSubscribe.AUDIO_ONLY,
        )

    except ImportError:
        logger.warning(
            "livekit-agents SDK not installed. "
            "Install with: pip install livekit-agents livekit-plugins-deepgram "
            "livekit-plugins-openai livekit-plugins-silero"
        )
        return None, None


# ──────────────────────────────────────────────────────────────
# Standalone Agent (no livekit-agents SDK required)
# ──────────────────────────────────────────────────────────────

async def standalone_agent(room_name: str) -> None:
    """Minimal agent that works without the full livekit-agents SDK.

    Uses the LiveKit Server API to:
    1. Join the room as a participant
    2. Send/receive data messages for text-based interview
    3. Monitor participant events

    This is a fallback for when you don't have STT/TTS set up yet.
    The interview happens via text chat in the video room.
    """
    from app.core.config import get_settings
    settings = get_settings()

    context = await fetch_interview_context(settings.api_url, room_name)
    if not context:
        logger.error("no_context", room=room_name)
        return

    from agent.question_engine import build_interview_system_prompt, generate_initial_questions

    system_prompt = build_interview_system_prompt(
        job_title=context["job_title"],
        jd_text=context["jd_text"],
        requirements=context["requirements"],
        resume_text=context["resume_text"],
    )

    questions = generate_initial_questions(
        job_title=context["job_title"],
        jd_text=context["jd_text"],
        requirements=context["requirements"],
        resume_text=context["resume_text"],
    )

    session = InterviewSession(
        room_name=room_name,
        interview_id=context["interview_id"],
        job_title=context["job_title"],
        jd_text=context["jd_text"],
        requirements=context["requirements"],
        resume_text=context["resume_text"],
        max_questions=context.get("max_questions", 10),
        duration_minutes=context.get("duration_minutes", 30),
        api_base_url=settings.api_url,
    )

    await notify_interview_started(settings.api_url, context["interview_id"])
    logger.info("standalone_agent_started", room=room_name, interview_id=context["interview_id"])

    # The actual conversation loop would be driven by LiveKit data channel
    # or by the frontend polling. For the MVP, the frontend sends candidate
    # messages via WebSocket and receives agent responses.

    # Generate greeting
    greeting = await get_ai_response(
        system_prompt=system_prompt,
        conversation_history=[],
        llm_base_url=settings.llm_base_url,
        llm_api_key=settings.llm_api_key,
        llm_model=settings.llm_model,
    )
    session.add_to_transcript("agent", greeting)

    logger.info("interview_greeting_sent", room=room_name, greeting=greeting[:100])
    return session


if __name__ == "__main__":
    entrypoint, worker_options = create_agent_entrypoint()
    if entrypoint and worker_options:
        from livekit.agents import cli
        cli.run_app(worker_options)
    else:
        print(
            "LiveKit agents SDK not available.\n"
            "Install: pip install livekit-agents livekit-plugins-deepgram "
            "livekit-plugins-openai livekit-plugins-silero\n\n"
            "Or use the standalone text-based agent via the API."
        )
