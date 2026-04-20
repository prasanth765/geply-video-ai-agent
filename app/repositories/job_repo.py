from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.job import Job
from app.repositories.base import BaseRepository


class JobRepository(BaseRepository[Job]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Job, session)

    async def get_by_recruiter(
        self, recruiter_id: str, offset: int = 0, limit: int = 50
    ) -> tuple[list[Job], int]:
        return await self.get_many(
            offset=offset, limit=limit, recruiter_id=recruiter_id
        )

    async def get_candidate_count(self, job_id: str) -> int:
        stmt = select(func.count()).where(Candidate.job_id == job_id)
        result = await self.session.execute(stmt)
        return result.scalar_one()
