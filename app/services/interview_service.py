from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import (
    INTERVIEW_ROOM_PREFIX,
    CandidateStatus,
    InterviewStatus,
    ProctorEventType,
)
from app.core.exceptions import (
    EntityNotFound,
    InterviewAlreadyCompleted,
    InviteLinkInvalid,
)
from app.core.security import create_livekit_room_token, decode_token
from app.models.interview import Interview
from app.repositories.candidate_repo import CandidateRepository
from app.repositories.interview_repo import InterviewRepository
from app.repositories.job_repo import JobRepository
from app.repositories.user_repo import UserRepository
from app.schemas.interview import InterviewRoomTokenResponse

logger = structlog.get_logger()

# Extension priority: check PNG first — JPG may be a ghost file from a failed
# earlier upload (small/empty). Upload endpoint now cleans up old files, but
# this order protects against any legacy ghost files still on disk.
_AVATAR_EXTS = (".png", ".webp", ".jpg", ".jpeg")

# Proctor penalty per event type — uses enum values as keys (single source of truth)
_PROCTOR_PENALTIES: dict[str, float] = {
    ProctorEventType.TAB_SWITCH: 5.0,
    ProctorEventType.COPY_PASTE: 3.0,
    ProctorEventType.RIGHT_CLICK: 2.0,
    ProctorEventType.DEVTOOLS_OPEN: 10.0,
    ProctorEventType.VIEW_SOURCE: 8.0,
    ProctorEventType.WINDOW_BLUR: 3.0,
    ProctorEventType.FULLSCREEN_EXIT: 4.0,
    ProctorEventType.WINDOW_RESIZE: 2.0,
    ProctorEventType.FACE_NOT_DETECTED: 10.0,
    ProctorEventType.MULTIPLE_FACES: 15.0,
    ProctorEventType.AUDIO_ANOMALY: 5.0,
}


def _find_avatar_url(user_id: str, storage_path: str) -> str:
    """Return the serving URL for a recruiter's avatar, or empty string if not found."""
    avatar_dir = Path(storage_path) / "avatars"
    for ext in _AVATAR_EXTS:
        path = avatar_dir / f"{user_id}{ext}"
        if path.exists() and path.stat().st_size > 1024:  # skip ghost files < 1 KB
            return f"/api/v1/auth/avatar/{user_id}{ext}"
    return ""


class InterviewService:
    def __init__(self, session: AsyncSession) -> None:
        self.interview_repo = InterviewRepository(session)
        self.candidate_repo = CandidateRepository(session)
        self.job_repo = JobRepository(session)
        self.user_repo = UserRepository(session)
        self.session = session
        self.settings = get_settings()

    async def create_interview(
        self,
        candidate_id: str,
        job_id: str,
        scheduled_at: datetime | None = None,
    ) -> Interview:
        room_name = f"{INTERVIEW_ROOM_PREFIX}-{uuid.uuid4().hex[:12]}"

        interview = await self.interview_repo.create(
            candidate_id=candidate_id,
            job_id=job_id,
            room_name=room_name,
            status=InterviewStatus.SCHEDULED if scheduled_at else InterviewStatus.PENDING,
            scheduled_at=scheduled_at,
        )

        logger.info(
            "interview_created",
            interview_id=interview.id,
            room=room_name,
            candidate_id=candidate_id,
        )
        return interview

    async def get_room_token_for_candidate(
        self,
        invite_token: str,
    ) -> InterviewRoomTokenResponse:
        payload = decode_token(invite_token)
        if payload.get("type") != "invite":
            raise InviteLinkInvalid("Not an invite token")

        candidate_id = payload["sub"]
        job_id = payload["job_id"]

        candidate = await self.candidate_repo.get_by_id(candidate_id)
        if not candidate:
            raise EntityNotFound("Candidate", candidate_id)

        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)

        # Find or create the interview
        interviews = await self.interview_repo.get_by_candidate(candidate_id)
        active = next(
            (
                i
                for i in interviews
                if i.status in (InterviewStatus.PENDING, InterviewStatus.SCHEDULED)
            ),
            None,
        )

        if not active:
            active = await self.create_interview(candidate_id, job_id)

        if active.status == InterviewStatus.COMPLETED:
            raise InterviewAlreadyCompleted(active.id)

        # Generate LiveKit room token for the candidate
        token = create_livekit_room_token(
            room_name=active.room_name,
            participant_identity=f"candidate-{candidate_id}",
            participant_name=candidate.full_name or candidate.email,
            is_agent=False,
        )

        # Mark candidate as having clicked the invite
        if not candidate.invite_clicked_at:
            candidate.invite_clicked_at = datetime.now(timezone.utc)
            await self.session.flush()

        # ── Recruiter info for the interview room avatar pip ──
        recruiter_name = "AI Interviewer"
        recruiter_avatar = ""
        if job.recruiter_id:
            recruiter_user = await self.user_repo.get_by_id(job.recruiter_id)
            if recruiter_user:
                recruiter_name = recruiter_user.full_name or "AI Interviewer"
                recruiter_avatar = _find_avatar_url(
                    recruiter_user.id, self.settings.storage_local_path
                )
                logger.info(
                    "recruiter_avatar_resolved",
                    user_id=recruiter_user.id,
                    avatar=recruiter_avatar or "none",
                )

        return InterviewRoomTokenResponse(
            room_name=active.room_name,
            token=token,
            livekit_url=self.settings.livekit_url,
            candidate_name=candidate.full_name,
            job_title=job.title,
            interview_id=active.id,
            recruiter_name=recruiter_name,
            recruiter_avatar=recruiter_avatar,
        )

    async def start_interview(self, interview_id: str) -> Interview:
        interview = await self.interview_repo.get_by_id(interview_id)
        if not interview:
            raise EntityNotFound("Interview", interview_id)

        interview.status = InterviewStatus.IN_PROGRESS
        interview.started_at = datetime.now(timezone.utc)
        await self.session.flush()

        candidate = await self.candidate_repo.get_by_id(interview.candidate_id)
        if candidate:
            candidate.status = CandidateStatus.INTERVIEWED

        active_count = await self.interview_repo.get_active_count()
        logger.info(
            "interview_started",
            interview_id=interview_id,
            room=interview.room_name,
            active_interviews=active_count,
        )
        return interview

    async def end_interview(
        self,
        interview_id: str,
        transcript: str = "",
        questions: dict | None = None,
        answers: dict | None = None,
        scores: dict | None = None,
    ) -> Interview:
        interview = await self.interview_repo.get_by_id(interview_id)
        if not interview:
            raise EntityNotFound("Interview", interview_id)

        now = datetime.now(timezone.utc)
        duration = 0
        if interview.started_at:
            duration = int((now - interview.started_at).total_seconds())

        interview.status = InterviewStatus.COMPLETED
        interview.ended_at = now
        interview.duration_seconds = duration
        interview.transcript = transcript
        interview.questions_asked = questions
        interview.answers_received = answers

        if scores:
            interview.overall_score = scores.get("overall", 0.0)
            interview.technical_score = scores.get("technical", 0.0)
            interview.communication_score = scores.get("communication", 0.0)
            interview.problem_solving_score = scores.get("problem_solving", 0.0)

        await self.session.flush()

        logger.info(
            "interview_ended",
            interview_id=interview_id,
            duration_seconds=duration,
            overall_score=interview.overall_score,
        )
        return interview

    async def add_proctor_event(
        self,
        interview_id: str,
        event_type: str,
        timestamp: datetime,
        metadata: dict | None = None,
    ) -> None:
        interview = await self.interview_repo.get_by_id(interview_id)
        if not interview:
            return

        events = interview.proctor_events or []
        events.append(
            {
                "type": event_type,
                "timestamp": timestamp.isoformat(),
                "metadata": metadata or {},
            }
        )
        interview.proctor_events = events

        penalty = _PROCTOR_PENALTIES.get(event_type, 1.0)
        interview.proctor_score = max(0.0, interview.proctor_score - penalty)
        await self.session.flush()

    async def get_interviews_for_job(
        self,
        job_id: str,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Interview], int]:
        interviews, total = await self.interview_repo.get_by_job(job_id, offset, limit)
        return list(interviews), total
