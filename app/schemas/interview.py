from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class InterviewResponse(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    room_name: str
    status: str
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    duration_seconds: int
    overall_score: float
    technical_score: float
    communication_score: float
    proctor_score: float
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewListResponse(BaseModel):
    interviews: list[InterviewResponse]
    total: int


class InterviewRoomTokenResponse(BaseModel):
    room_name: str
    token: str
    livekit_url: str
    candidate_name: str
    job_title: str
    interview_id: str
    recruiter_name: str = "AI Interviewer"
    recruiter_avatar: str = ""


class ProctorEventRequest(BaseModel):
    interview_id: str
    event_type: str
    timestamp: datetime
    metadata: dict = Field(default_factory=dict)


class InterviewWebhookPayload(BaseModel):
    """Payload from LiveKit webhook when room events occur."""
    event: str
    room: dict | None = None
    participant: dict | None = None
    egress_info: dict | None = None
