from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.core.constants import CandidateStatus
from app.core.exceptions import EntityNotFound, InviteLinkInvalid
from app.core.security import decode_token
from app.models.schedule import ScheduleSlot
from app.repositories.candidate_repo import CandidateRepository
from app.repositories.job_repo import JobRepository
from app.repositories.user_repo import UserRepository
from app.schemas.schedule import (
    AvailableSlotsResponse,
    BulkSlotCreateRequest,
    ExistingBooking,
    SelfScheduleRequest,
    SlotBookRequest,
    SlotResponse,
)
from app.services.schedule_service import ScheduleService

import structlog
from app.utils.notify import create_notification_async

logger = structlog.get_logger()

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.post("/slots", response_model=list[SlotResponse], status_code=201)
async def create_slots(
    body: BulkSlotCreateRequest,
    db: DBSession,
    user: CurrentUser,
) -> list[SlotResponse]:
    service = ScheduleService(db)
    return await service.create_slots(body)


@router.get("/available", response_model=AvailableSlotsResponse)
async def get_available_slots(
    invite_token: str = Query(...),
    db: DBSession = None,
) -> AvailableSlotsResponse:
    """Public — candidate views scheduling page with status awareness."""
    payload = decode_token(invite_token)
    if payload.get("type") != "invite":
        raise InviteLinkInvalid("Not an invite token")

    candidate_id = payload["sub"]
    job_id = payload["job_id"]

    candidate_repo = CandidateRepository(db)
    candidate = await candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise EntityNotFound("Candidate", candidate_id)

    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(job_id)
    if not job:
        raise EntityNotFound("Job", job_id)

    company = ""
    if job.recruiter_id:
        user_repo = UserRepository(db)
        recruiter = await user_repo.get_by_id(job.recruiter_id)
        if recruiter:
            company = recruiter.company or ""

    already_interviewed = candidate.status in ("interviewed", "report_ready")

    # Query DB directly for existing booking (avoids stale relationship cache)
    existing_booking = None
    result = await db.execute(
        select(ScheduleSlot)
        .where(ScheduleSlot.candidate_id == candidate_id, ScheduleSlot.is_booked == True)
        .order_by(ScheduleSlot.start_time.desc())
        .limit(1)
    )
    booked_slot = result.scalars().first()
    if booked_slot:
        existing_booking = ExistingBooking(
            slot_id=booked_slot.id,
            start_time=booked_slot.start_time,
            end_time=booked_slot.end_time,
            timezone=booked_slot.timezone,
        )

    # Get recruiter-created available slots
    slots = []
    try:
        service = ScheduleService(db)
        base_response = await service.get_available_slots(invite_token)
        slots = base_response.slots
    except Exception:
        pass

    return AvailableSlotsResponse(
        job_title=job.title,
        job_description=job.description or job.jd_raw_text or "",
        company=company,
        candidate_name=candidate.full_name,
        candidate_status=candidate.status,
        already_interviewed=already_interviewed,
        existing_booking=existing_booking,
        slots=[SlotResponse.model_validate(s) if hasattr(s, 'id') else s for s in slots],
    )


@router.post("/book", response_model=SlotResponse)
async def book_slot(body: SlotBookRequest, db: DBSession) -> SlotResponse:
    service = ScheduleService(db)
    return await service.book_slot(
        slot_id=body.slot_id,
        invite_token=body.candidate_token,
    )


@router.post("/self-schedule", response_model=SlotResponse, status_code=201)
async def self_schedule(body: SelfScheduleRequest, db: DBSession) -> SlotResponse:
    """Public — candidate picks their own date + time. Handles reschedule too."""
    payload = decode_token(body.candidate_token)
    if payload.get("type") != "invite":
        raise InviteLinkInvalid("Not an invite token")

    candidate_id = payload["sub"]
    job_id = payload["job_id"]

    candidate_repo = CandidateRepository(db)
    candidate = await candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise EntityNotFound("Candidate", candidate_id)

    if candidate.status in ("interviewed", "report_ready"):
        raise InviteLinkInvalid("Interview already completed")

    now = datetime.now(timezone.utc)
    start = body.start_time
    end = body.end_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    if start <= now:
        raise InviteLinkInvalid("Start time must be in the future")
    if end <= start:
        raise InviteLinkInvalid("End time must be after start time")

    # ── Cancel ALL existing bookings for this candidate (reschedule support) ──
    result = await db.execute(
        select(ScheduleSlot).where(
            ScheduleSlot.candidate_id == candidate_id,
            ScheduleSlot.is_booked == True,
        )
    )
    old_slots = result.scalars().all()
    for old_slot in old_slots:
        old_slot.is_booked = False
        old_slot.is_available = True
        old_slot.candidate_id = None
        logger.info("old_slot_cancelled", slot_id=old_slot.id)

    # ── Create new slot ──
    slot = ScheduleSlot(
        id=str(uuid.uuid4()),
        job_id=job_id,
        candidate_id=candidate_id,
        start_time=start,
        end_time=end,
        timezone=body.timezone,
        is_booked=True,
        is_available=False,
        booked_at=now,
    )
    db.add(slot)

    candidate.status = CandidateStatus.SCHEDULED
    await db.flush()

    # Notify recruiter
    try:
        from app.repositories.user_repo import UserRepository as _UR
        job_repo2 = JobRepository(db)
        _job = await job_repo2.get_by_id(job_id)
        if _job and _job.recruiter_id:
            await create_notification_async(
                db, _job.recruiter_id, "candidate_scheduled",
                f"{candidate.full_name} scheduled interview",
                f"Scheduled for {start.strftime('%b %d at %I:%M %p')} — {_job.title}",
                metadata={"job_id": job_id, "candidate_name": candidate.full_name},
            )
    except Exception:
        pass

    logger.info(
        "candidate_scheduled",
        candidate_id=candidate_id,
        job_id=job_id,
        start_time=start.isoformat(),
        rescheduled=len(old_slots) > 0,
    )

    return SlotResponse.model_validate(slot)


@router.post("/request-re-interview")
async def request_re_interview_public(
    db: DBSession,
    candidate_token: str = Query(...),
) -> dict:
    """Public — candidate requests re-interview. Creates notification for recruiter."""
    payload = decode_token(candidate_token)
    if payload.get("type") != "invite":
        raise InviteLinkInvalid("Not an invite token")

    candidate_id = payload["sub"]
    job_id = payload["job_id"]

    candidate_repo = CandidateRepository(db)
    candidate = await candidate_repo.get_by_id(candidate_id)
    if not candidate:
        raise EntityNotFound("Candidate", candidate_id)

    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(job_id)
    if not job:
        raise EntityNotFound("Job", job_id)

    # Create notification for recruiter
    if job.recruiter_id:
        await create_notification_async(
            db, job.recruiter_id, "re_interview_requested",
            f"Re-interview requested: {candidate.full_name}",
            f"{candidate.full_name} is requesting another interview for {job.title}",
            metadata={"job_id": job_id, "candidate_name": candidate.full_name},
        )

    logger.info("re_interview_requested_by_candidate", candidate_id=candidate_id, job_id=job_id)
    return {"requested": True, "candidate_name": candidate.full_name}



