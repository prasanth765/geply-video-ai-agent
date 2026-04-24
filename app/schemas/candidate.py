from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CandidateCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(default="", max_length=50)


class CandidateResponse(BaseModel):
    id: str
    job_id: str
    email: str
    full_name: str
    phone: str
    status: str
    resume_parsed: bool
    invite_token: str = ""
    invite_sent_at: datetime | None = None
    invite_clicked_at: datetime | None = None
    consent_given: bool
    re_interview_count: int = 0
    re_interview_reason: str = ""
    scheduled_at: datetime | None = None  # Computed from schedule_slots, not a DB field
    # -- JD Match (pre-interview screening) --
    jd_match_score: int = 0
    jd_match_verdict: str = ""
    jd_match_breakdown: str = ""
    created_at: datetime

    model_config = {"from_attributes": True}


class CandidateListResponse(BaseModel):
    candidates: list[CandidateResponse]
    total: int


class CandidateConsentRequest(BaseModel):
    webcam_access: bool = True
    screen_monitoring: bool = True
    recording_consent: bool = True
    data_retention_acknowledged: bool = True
