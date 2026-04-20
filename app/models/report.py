from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ReportVerdict
from app.models.base import Base


class Report(Base):
    """Final interview report generated after AI interview completes.

    Contains scores, transcript highlights, proctoring summary,
    and the AI's verdict on the candidate.
    """

    __tablename__ = "reports"

    interview_id: Mapped[str] = mapped_column(
        ForeignKey("interviews.id"),
        unique=True,
        index=True,
    )
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)

    # Scores
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    verdict: Mapped[str] = mapped_column(String(50), default=ReportVerdict.MAYBE)
    score_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Content
    summary: Mapped[str] = mapped_column(Text, default="")
    strengths: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    weaknesses: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    key_qa_pairs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recommendations: Mapped[str] = mapped_column(Text, default="")

    # Categorized Q&A — structured by block (hygiene, jd_fit, resume, ctc, recruiter_custom)
    # Populated by report_worker during LLM-based extraction
    qa_by_category: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Proctoring summary
    integrity_score: Mapped[float] = mapped_column(Float, default=100.0)
    proctor_flags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    screenshots: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Artifacts
    recording_url: Mapped[str] = mapped_column(String(1000), default="")
    highlight_reel_url: Mapped[str] = mapped_column(String(1000), default="")
    pdf_report_path: Mapped[str] = mapped_column(String(1000), default="")

    # Delivery
    sent_to_recruiter: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    interview: Mapped["Interview"] = relationship(back_populates="report", lazy="selectin")
