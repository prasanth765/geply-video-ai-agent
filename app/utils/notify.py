"""Utility to create notifications from anywhere in the app.

Usage (async context — routes):
    from app.utils.notify import create_notification_async
    await create_notification_async(db, recruiter_id, "interview_completed", "Interview done", "John scored 85%")

Usage (sync context — report_worker thread):
    from app.utils.notify import create_notification_sync
    create_notification_sync(recruiter_id, "report_ready", "Report ready", "John's report is ready")
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

# Notification types
INTERVIEW_COMPLETED = "interview_completed"
REPORT_READY = "report_ready"
CANDIDATE_SCHEDULED = "candidate_scheduled"
RE_INTERVIEW_REQUESTED = "re_interview_requested"
CANDIDATE_UPLOADED = "candidate_uploaded"


async def create_notification_async(
    db: AsyncSession,
    recruiter_id: str,
    type: str,
    title: str,
    message: str = "",
    metadata: dict | None = None,
) -> None:
    """Create a notification in async context (FastAPI routes)."""
    try:
        from app.models.notification import Notification
        notif = Notification(
            id=str(uuid.uuid4()),
            recruiter_id=recruiter_id,
            type=type,
            title=title,
            message=message,
            metadata_json=metadata,
            is_read=False,
        )
        db.add(notif)
        await db.flush()
        logger.info("notification_created", type=type, recruiter_id=recruiter_id)
    except Exception as exc:
        logger.warning("notification_create_failed", error=str(exc))


def create_notification_sync(
    recruiter_id: str,
    type: str,
    title: str,
    message: str = "",
    metadata: dict | None = None,
) -> None:
    """Create a notification in sync context (background threads like report_worker)."""
    try:
        from sqlalchemy import create_engine, text as sql_text
        from app.core.config import get_settings

        settings = get_settings()
        sync_url = settings.database_url.replace("+aiosqlite", "")
        engine = create_engine(sync_url)

        notif_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        with engine.connect() as conn:
            conn.execute(
                sql_text("""
                    INSERT INTO notifications (id, recruiter_id, type, title, message, metadata, is_read, created_at, updated_at)
                    VALUES (:id, :recruiter_id, :type, :title, :message, :metadata, 0, :now, :now)
                """),
                {
                    "id": notif_id,
                    "recruiter_id": recruiter_id,
                    "type": type,
                    "title": title,
                    "message": message,
                    "metadata": json.dumps(metadata or {}),
                    "now": now,
                },
            )
            conn.commit()
        engine.dispose()
        logger.info("notification_created_sync", type=type, recruiter_id=recruiter_id)
    except Exception as exc:
        logger.warning("notification_sync_failed", error=str(exc))
