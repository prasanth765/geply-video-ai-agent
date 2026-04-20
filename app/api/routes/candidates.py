from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, verify_job_owner, verify_candidate_owner
from app.core.constants import CandidateStatus
from app.core.exceptions import EntityNotFound
from app.core.security import create_invite_token
from app.models.schedule import ScheduleSlot
from app.repositories.candidate_repo import CandidateRepository
from app.schemas.candidate import CandidateConsentRequest, CandidateListResponse, CandidateResponse
from app.services.job_service import JobService

import structlog
from app.utils.notify import create_notification_async

logger = structlog.get_logger()

router = APIRouter(prefix="/candidates", tags=["candidates"])


def _to_response(candidate) -> CandidateResponse:
    resp = CandidateResponse.model_validate(candidate)
    if hasattr(candidate, 'schedule_slots') and candidate.schedule_slots:
        booked = [s for s in candidate.schedule_slots if s.is_booked]
        if booked:
            latest = max(booked, key=lambda s: s.start_time)
            resp.scheduled_at = latest.start_time
    return resp


class ReInterviewRequest(BaseModel):
    reason: str = ""


class CandidateUpdateRequest(BaseModel):
    email: str | None = None
    full_name: str | None = None
    phone: str | None = None


class BulkInviteRequest(BaseModel):
    job_id: str
    candidate_ids: list[str]


@router.get("/job/{job_id}", response_model=CandidateListResponse)
async def list_candidates(
    job_id: str, db: DBSession, user: CurrentUser,
    offset: int = 0, limit: int = 100,
) -> CandidateListResponse:
    await verify_job_owner(job_id, user, db)
    repo = CandidateRepository(db)
    candidates, total = await repo.get_by_job(job_id, offset, limit)
    return CandidateListResponse(candidates=[_to_response(c) for c in candidates], total=total)


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(candidate_id: str, db: DBSession, user: CurrentUser) -> CandidateResponse:
    candidate, _ = await verify_candidate_owner(candidate_id, user, db)
    return _to_response(candidate)


@router.patch("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: str, body: CandidateUpdateRequest, db: DBSession, user: CurrentUser,
) -> CandidateResponse:
    candidate, _ = await verify_candidate_owner(candidate_id, user, db)
    if body.email is not None:
        candidate.email = body.email
    if body.full_name is not None:
        candidate.full_name = body.full_name
    if body.phone is not None:
        candidate.phone = body.phone
    await db.flush()
    logger.info("candidate_updated", candidate_id=candidate_id)
    return _to_response(candidate)


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: str, status: CandidateStatus, db: DBSession, user: CurrentUser,
) -> CandidateResponse:
    repo = CandidateRepository(db)
    candidate = await repo.update(candidate_id, status=status)
    if not candidate:
        raise EntityNotFound("Candidate", candidate_id)
    return _to_response(candidate)


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: str, db: DBSession, user: CurrentUser) -> dict:
    candidate, _ = await verify_candidate_owner(candidate_id, user, db)
    candidate_name = candidate.full_name or candidate.email
    await db.delete(candidate)
    await db.flush()
    logger.info("candidate_deleted", candidate_id=candidate_id)
    return {"deleted": True, "candidate_id": candidate_id, "name": candidate_name}


@router.post("/bulk-invite")
async def bulk_invite_candidates(body: BulkInviteRequest, db: DBSession, user: CurrentUser) -> dict:
    service = JobService(db)
    result = await service.generate_bulk_invites(job_id=body.job_id, candidate_ids=body.candidate_ids)
    return {
        "job_id": body.job_id,
        "invites_generated": result.invites_generated,
        "total_selected": len(body.candidate_ids),
        "failed": result.failed,
    }


@router.post("/{candidate_id}/re-interview")
async def request_re_interview(
    candidate_id: str, body: ReInterviewRequest, db: DBSession, user: CurrentUser,
) -> dict:
    candidate, _ = await verify_candidate_owner(candidate_id, user, db)

    # ── Clear ALL existing schedule slots so candidate sees fresh scheduling page ──
    old_slots_result = await db.execute(
        select(ScheduleSlot).where(
            ScheduleSlot.candidate_id == candidate_id,
            ScheduleSlot.is_booked == True,
        )
    )
    cleared = 0
    for old_slot in old_slots_result.scalars().all():
        old_slot.is_booked = False
        old_slot.is_available = True
        old_slot.candidate_id = None
        cleared += 1
    if cleared:
        logger.info("re_interview_slots_cleared", candidate_id=candidate_id, count=cleared)
    # ─────────────────────────────────────────────────────────────────────────────

    new_token = create_invite_token(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        candidate_email=candidate.email,
    )

    candidate.invite_token = new_token
    candidate.status = CandidateStatus.INVITED
    candidate.invite_sent_at = datetime.now(timezone.utc)
    candidate.consent_given = False
    candidate.consent_given_at = None
    candidate.re_interview_count = (candidate.re_interview_count or 0) + 1
    candidate.re_interview_reason = body.reason

    await db.flush()

    try:
        await create_notification_async(
            db, user.id, "re_interview_requested",
            f"Re-interview: {candidate.full_name}",
            f"Reason: {body.reason}",
            metadata={"job_id": candidate.job_id, "candidate_name": candidate.full_name},
        )
    except Exception:
        pass

    logger.info(
        "re_interview_requested",
        candidate_id=candidate_id,
        reason=body.reason,
        re_interview_count=candidate.re_interview_count,
        slots_cleared=cleared,
    )

    return {
        "candidate_id": candidate.id,
        "status": "invited",
        "invite_token": new_token,
        "reason": body.reason,
        "re_interview_count": candidate.re_interview_count,
    }


@router.post("/{candidate_id}/consent")
async def record_consent(candidate_id: str, body: CandidateConsentRequest, db: DBSession) -> dict:
    repo = CandidateRepository(db)
    candidate = await repo.get_by_id(candidate_id)
    if not candidate:
        raise EntityNotFound("Candidate", candidate_id)
    all_consented = (
        body.webcam_access and body.screen_monitoring
        and body.recording_consent and body.data_retention_acknowledged
    )
    candidate.consent_given = all_consented
    candidate.consent_given_at = datetime.now(timezone.utc) if all_consented else None
    await db.flush()
    return {"candidate_id": candidate_id, "consent_given": all_consented}
