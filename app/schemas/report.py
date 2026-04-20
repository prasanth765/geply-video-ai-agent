from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ReportResponse(BaseModel):
    id: str
    interview_id: str
    candidate_id: str
    job_id: str
    overall_score: float
    verdict: str
    score_breakdown: dict[str, Any] | None
    summary: str
    strengths: list[str] | None
    weaknesses: list[str] | None
    key_qa_pairs: list[dict[str, Any]] | None
    qa_by_category: dict[str, Any] | None = None
    recommendations: str
    integrity_score: float
    proctor_flags: list[dict[str, Any]] | None
    recording_url: str
    highlight_reel_url: str
    pdf_report_path: str
    sent_to_recruiter: bool
    sent_at: datetime | None
    created_at: datetime
    screenshots: list | None = None
    transcript: str = ""

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    reports: list[ReportResponse]
    total: int
