from __future__ import annotations

from datetime import datetime, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import CandidateStatus
from app.core.exceptions import (
    EntityNotFound,
    InterviewSlotUnavailable,
    InviteLinkInvalid,
)
from app.core.security import decode_token
from app.repositories.candidate_repo import CandidateRepository
from app.repositories.job_repo import JobRepository
from app.repositories.schedule_repo import ScheduleRepository
from app.schemas.schedule import (
    AvailableSlotsResponse,
    BulkSlotCreateRequest,
    SlotResponse,
)

logger = structlog.get_logger()


class ScheduleService:
    def __init__(self, session: AsyncSession) -> None:
        self.schedule_repo = ScheduleRepository(session)
        self.job_repo = JobRepository(session)
        self.candidate_repo = CandidateRepository(session)
        self.session = session

    async def create_slots(self, data: BulkSlotCreateRequest) -> list[SlotResponse]:
        job = await self.job_repo.get_by_id(data.job_id)
        if not job:
            raise EntityNotFound("Job", data.job_id)

        created = []
        for slot_data in data.slots:
            slot = await self.schedule_repo.create(
                job_id=data.job_id,
                start_time=slot_data.start_time,
                end_time=slot_data.end_time,
                timezone=slot_data.timezone,
            )
            created.append(SlotResponse.model_validate(slot))

        logger.info("slots_created", job_id=data.job_id, count=len(created))
        return created

    async def get_available_slots(self, invite_token: str) -> AvailableSlotsResponse:
        """Public endpoint: candidate uses invite token to see available slots."""
        payload = decode_token(invite_token)
        if payload.get("type") != "invite":
            raise InviteLinkInvalid("Not an invite token")

        job_id = payload["job_id"]
        job = await self.job_repo.get_by_id(job_id)
        if not job:
            raise EntityNotFound("Job", job_id)

        slots = await self.schedule_repo.get_available_for_job(job_id)
        recruiter = await job.awaitable_attrs.recruiter

        return AvailableSlotsResponse(
            job_title=job.title,
            job_description=job.description,
            company=recruiter.company if recruiter else "",
            slots=[SlotResponse.model_validate(s) for s in slots],
        )

    async def book_slot(
        self,
        slot_id: str,
        invite_token: str,
    ) -> SlotResponse:
        """Candidate books a slot using their invite token."""
        payload = decode_token(invite_token)
        if payload.get("type") != "invite":
            raise InviteLinkInvalid()

        candidate_id = payload["sub"]
        candidate = await self.candidate_repo.get_by_id(candidate_id)
        if not candidate:
            raise EntityNotFound("Candidate", candidate_id)

        slot = await self.schedule_repo.book_slot(slot_id, candidate_id)
        if not slot:
            raise InterviewSlotUnavailable(slot_id)

        # Update candidate status
        candidate.status = CandidateStatus.SCHEDULED
        if not candidate.invite_clicked_at:
            candidate.invite_clicked_at = datetime.now(timezone.utc)
        await self.session.flush()

        logger.info(
            "slot_booked",
            slot_id=slot_id,
            candidate_id=candidate_id,
            start_time=slot.start_time.isoformat(),
        )
        return SlotResponse.model_validate(slot)
