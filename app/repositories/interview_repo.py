from __future__ import annotations

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import InterviewStatus
from app.models.interview import Interview
from app.repositories.base import BaseRepository


class InterviewRepository(BaseRepository[Interview]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Interview, session)

    async def get_by_room(self, room_name: str) -> Interview | None:
        return await self.get_one(room_name=room_name)

    async def get_by_candidate(self, candidate_id: str) -> Sequence[Interview]:
        stmt = (
            select(Interview)
            .where(Interview.candidate_id == candidate_id)
            .order_by(Interview.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_active_count(self) -> int:
        stmt = select(func.count()).where(
            Interview.status == InterviewStatus.IN_PROGRESS
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_by_job(
        self, job_id: str, offset: int = 0, limit: int = 100
    ) -> tuple[Sequence[Interview], int]:
        return await self.get_many(offset=offset, limit=limit, job_id=job_id)
