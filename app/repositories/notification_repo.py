from __future__ import annotations

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Notification, session)

    async def get_by_recruiter(
        self,
        recruiter_id: str,
        unread_only: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[Notification], int]:
        filters: dict = {"recruiter_id": recruiter_id}
        if unread_only:
            filters["is_read"] = False
        return await self.get_many(offset=offset, limit=limit, **filters)

    async def get_unread_count(self, recruiter_id: str) -> int:
        stmt = select(func.count()).where(
            Notification.recruiter_id == recruiter_id,
            Notification.is_read.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def mark_all_read(self, recruiter_id: str) -> int:
        """Mark all unread notifications as read. Returns count of updated rows."""
        from sqlalchemy import update

        stmt = (
            update(Notification)
            .where(
                Notification.recruiter_id == recruiter_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount
