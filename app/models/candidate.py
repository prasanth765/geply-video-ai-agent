from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CandidateStatus
from app.models.base import Base


class Candidate(Base):
    """A candidate applying for a specific job. Created when resume is uploaded."""

    __tablename__ = "candidates"

    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    resume_file_path: Mapped[str] = mapped_column(String(1000), default="")
    resume_raw_text: Mapped[str] = mapped_column(Text, default="")
    resume_parsed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default=CandidateStatus.INVITED,
        index=True,
    )
    invite_token: Mapped[str] = mapped_column(String(2000), default="")
    invite_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invite_clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # -- JD Match (pre-interview resume screening) --
    # Computed after resume parse. Zero until scoring completes.
    jd_match_score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    # "go" | "no_go" | "" (empty while pending)
    jd_match_verdict: Mapped[str] = mapped_column(String(16), default="", index=True)
    # Full LLM breakdown stored as JSON text: sub_scores, skills_matched, skills_missing, rationale
    jd_match_breakdown: Mapped[str] = mapped_column(Text, default="")

    # Re-interview tracking
    re_interview_count: Mapped[int] = mapped_column(Integer, default=0)
    re_interview_reason: Mapped[str] = mapped_column(Text, default="")

    # Relationships
    job: Mapped["Job"] = relationship(back_populates="candidates", lazy="selectin")
    interviews: Mapped[list["Interview"]] = relationship(
        back_populates="candidate",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    schedule_slots: Mapped[list["ScheduleSlot"]] = relationship(
        back_populates="candidate",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
