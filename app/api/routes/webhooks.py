from __future__ import annotations

import structlog
from fastapi import APIRouter, Request

from app.api.deps import DBSession
from app.core.constants import InterviewStatus
from app.repositories.interview_repo import InterviewRepository

logger = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/livekit")
async def livekit_webhook(request: Request, db: DBSession) -> dict:
    """Handle LiveKit server webhooks.

    Events we care about:
    - room_started: interview room is ready
    - participant_joined: candidate or agent joined
    - participant_left: someone left
    - room_finished: room closed, interview ended
    - egress_ended: recording is ready
    """
    body = await request.json()
    event = body.get("event", "")
    room_info = body.get("room", {})
    room_name = room_info.get("name", "")

    logger.info("livekit_webhook", event=event, room=room_name)

    repo = InterviewRepository(db)

    if event == "room_started" and room_name:
        interview = await repo.get_by_room(room_name)
        if interview:
            interview.livekit_room_sid = room_info.get("sid", "")
            await db.flush()

    elif event == "room_finished" and room_name:
        interview = await repo.get_by_room(room_name)
        if interview and interview.status == InterviewStatus.IN_PROGRESS:
            from datetime import datetime, timezone

            interview.status = InterviewStatus.COMPLETED
            interview.ended_at = datetime.now(timezone.utc)
            if interview.started_at:
                interview.duration_seconds = int(
                    (interview.ended_at - interview.started_at).total_seconds()
                )
            await db.flush()
            logger.info("interview_auto_ended", interview_id=interview.id, room=room_name)

    elif event == "egress_ended":
        egress_info = body.get("egressInfo", {})
        egress_room = egress_info.get("roomName", "")
        if egress_room:
            interview = await repo.get_by_room(egress_room)
            if interview:
                file_results = egress_info.get("fileResults", [])
                if file_results:
                    interview.recording_path = file_results[0].get("filename", "")
                interview.egress_id = egress_info.get("egressId", "")
                await db.flush()
                logger.info(
                    "recording_ready",
                    interview_id=interview.id,
                    path=interview.recording_path,
                )

    return {"status": "ok"}


@router.post("/n8n/interview-complete")
async def n8n_interview_complete(request: Request, db: DBSession) -> dict:
    """Callback from n8n when post-interview processing is done."""
    body = await request.json()
    interview_id = body.get("interview_id", "")
    logger.info("n8n_callback", interview_id=interview_id, payload=body)
    return {"status": "received"}
