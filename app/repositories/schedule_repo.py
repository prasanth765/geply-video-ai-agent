from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schedule import ScheduleSlot
from app.repositories.base import BaseRepository


class ScheduleRepository(BaseRepository[ScheduleSlot]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ScheduleSlot, session)

    async def get_available_for_job(self, job_id: str) -> Sequence[ScheduleSlot]:
        stmt = (
            select(ScheduleSlot)
            .where(
                ScheduleSlot.job_id == job_id,
                ScheduleSlot.is_available.is_(True),
                ScheduleSlot.is_booked.is_(False),
            )
            .order_by(ScheduleSlot.start_time.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def book_slot(self, slot_id: str, candidate_id: str) -> ScheduleSlot | None:
        slot = await self.get_by_id(slot_id)
        if not slot or slot.is_booked or not slot.is_available:
            return None
        slot.is_booked = True
        slot.candidate_id = candidate_id
        slot.booked_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(slot)
        return slot
