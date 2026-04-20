from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.constants import ShiftOption

MAX_RECRUITER_QUESTIONS = 5
MAX_RECRUITER_QUESTION_LENGTH = 500


def _validate_recruiter_questions(v):
    """Validate recruiter questions: max count, length, non-empty after strip."""
    if v is None:
        return v
    if not isinstance(v, list):
        raise ValueError("recruiter_questions must be a list")
    cleaned = [str(q).strip() for q in v if str(q).strip()]
    if len(cleaned) > MAX_RECRUITER_QUESTIONS:
        raise ValueError(f"Maximum {MAX_RECRUITER_QUESTIONS} recruiter questions allowed")
    for q in cleaned:
        if len(q) > MAX_RECRUITER_QUESTION_LENGTH:
            raise ValueError(f"Each question must be under {MAX_RECRUITER_QUESTION_LENGTH} characters")
    return cleaned


class JobCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(default="")
    requirements: str = Field(default="")
    interview_duration_minutes: int = Field(default=30, ge=10, le=60)
    max_questions: int = Field(default=10, ge=3, le=25)
    difficulty_level: str = Field(default="medium")
    office_locations: str = Field(default="")
    shift_flexible: bool = Field(default=True)
    shift_info: str = Field(default=ShiftOption.ANY)
    ask_ctc: bool = Field(default=False)
    recruiter_questions: list[str] | None = Field(default=None)

    @field_validator("recruiter_questions")
    @classmethod
    def _check_recruiter_qs(cls, v):
        return _validate_recruiter_questions(v)


class JobUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None
    status: str | None = None
    interview_duration_minutes: int | None = None
    max_questions: int | None = None
    office_locations: str | None = None
    shift_flexible: bool | None = None
    shift_info: str | None = None
    ask_ctc: bool | None = None
    recruiter_questions: list[str] | None = None

    @field_validator("recruiter_questions")
    @classmethod
    def _check_recruiter_qs(cls, v):
        return _validate_recruiter_questions(v)


class JobResponse(BaseModel):
    id: str
    recruiter_id: str
    title: str
    description: str
    requirements: str
    status: str
    interview_duration_minutes: int
    max_questions: int
    difficulty_level: str
    jd_file_path: str
    office_locations: str
    shift_flexible: bool
    shift_info: str = ShiftOption.ANY
    ask_ctc: bool = False
    recruiter_questions: list[str] | None = None
    candidate_count: int = 0  # Computed, not a DB field
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int


class BulkInviteResponse(BaseModel):
    job_id: str
    total_candidates: int
    invites_generated: int
    invites_sent: int
    failed: list[str]
