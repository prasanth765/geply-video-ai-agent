from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report
from app.repositories.base import BaseRepository


class ReportRepository(BaseRepository[Report]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Report, session)

    async def get_by_interview(self, interview_id: str) -> Report | None:
        return await self.get_one(interview_id=interview_id)

    async def get_by_job(
        self, job_id: str, offset: int = 0, limit: int = 100
    ) -> tuple[Sequence[Report], int]:
        return await self.get_many(offset=offset, limit=limit, job_id=job_id)

    async def get_unsent(self) -> Sequence[Report]:
        stmt = select(Report).where(Report.sent_to_recruiter.is_(False))
        result = await self.session.execute(stmt)
        return result.scalars().all()
