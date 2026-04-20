from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.repositories.base import BaseRepository


class CandidateRepository(BaseRepository[Candidate]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Candidate, session)

    async def get_by_job(
        self, job_id: str, offset: int = 0, limit: int = 100
    ) -> tuple[Sequence[Candidate], int]:
        return await self.get_many(offset=offset, limit=limit, job_id=job_id)

    async def get_by_email_and_job(self, email: str, job_id: str) -> Candidate | None:
        stmt = select(Candidate).where(
            Candidate.email == email,
            Candidate.job_id == job_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_uninvited(self, job_id: str) -> Sequence[Candidate]:
        stmt = select(Candidate).where(
            Candidate.job_id == job_id,
            Candidate.invite_sent_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
