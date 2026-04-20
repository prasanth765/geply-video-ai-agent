from __future__ import annotations

import json

from fastapi import APIRouter
from sqlalchemy import select, update, func

from app.api.deps import CurrentUser, DBSession
from app.models.notification import Notification

import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _parse_metadata(raw):
    """Ensure metadata is always a dict, never a string."""
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
    return raw


@router.get("")
async def list_notifications(
    db: DBSession,
    user: CurrentUser,
    unread_only: bool = False,
    limit: int = 50,
) -> dict:
    query = select(Notification).where(
        Notification.recruiter_id == user.id
    ).order_by(Notification.created_at.desc()).limit(limit)

    if unread_only:
        query = query.where(Notification.is_read == False)

    result = await db.execute(query)
    notifications = result.scalars().all()

    count_result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.recruiter_id == user.id,
            Notification.is_read == False,
        )
    )
    unread_count = count_result.scalar() or 0

    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "metadata": _parse_metadata(n.metadata_json),
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else "",
            }
            for n in notifications
        ],
        "unread_count": unread_count,
    }


@router.get("/unread-count")
async def get_unread_count(
    db: DBSession,
    user: CurrentUser,
) -> dict:
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.recruiter_id == user.id,
            Notification.is_read == False,
        )
    )
    return {"unread_count": result.scalar() or 0}


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    await db.execute(
        update(Notification).where(
            Notification.id == notification_id,
            Notification.recruiter_id == user.id,
        ).values(is_read=True)
    )
    await db.flush()
    return {"marked_read": notification_id}


@router.patch("/read-all")
async def mark_all_read(
    db: DBSession,
    user: CurrentUser,
) -> dict:
    result = await db.execute(
        update(Notification).where(
            Notification.recruiter_id == user.id,
            Notification.is_read == False,
        ).values(is_read=True)
    )
    await db.flush()
    return {"marked_read": result.rowcount}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    from sqlalchemy import delete as sql_delete
    result = await db.execute(
        sql_delete(Notification).where(
            Notification.id == notification_id,
            Notification.recruiter_id == user.id,
        )
    )
    await db.flush()
    return {"deleted": notification_id}
