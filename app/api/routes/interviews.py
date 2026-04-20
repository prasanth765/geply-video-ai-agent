from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, verify_job_owner
from app.schemas.interview import (
    InterviewListResponse,
    InterviewResponse,
    InterviewRoomTokenResponse,
    ProctorEventRequest,
)
from app.services.interview_service import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.get("/job/{job_id}", response_model=InterviewListResponse)
async def list_interviews(
    job_id: str,
    db: DBSession,
    user: CurrentUser,
    offset: int = 0,
    limit: int = 100,
) -> InterviewListResponse:
    await verify_job_owner(job_id, user, db)
    service = InterviewService(db)
    interviews, total = await service.get_interviews_for_job(job_id, offset, limit)
    return InterviewListResponse(
        interviews=[InterviewResponse.model_validate(i) for i in interviews],
        total=total,
    )


@router.post("/room-token", response_model=InterviewRoomTokenResponse)
async def get_room_token(
    invite_token: str = Query(..., description="JWT invite token from the invite link"),
    db: DBSession = None,
) -> InterviewRoomTokenResponse:
    """Public endpoint — candidate exchanges invite token for a LiveKit room token."""
    service = InterviewService(db)
    return await service.get_room_token_for_candidate(invite_token)


@router.post("/proctor-event")
async def record_proctor_event(body: ProctorEventRequest, db: DBSession) -> dict:
    """Public endpoint — candidate's browser SDK sends proctoring events."""
    service = InterviewService(db)
    await service.add_proctor_event(
        interview_id=body.interview_id,
        event_type=body.event_type,
        timestamp=body.timestamp,
        metadata=body.metadata,
    )
    return {"status": "ok"}