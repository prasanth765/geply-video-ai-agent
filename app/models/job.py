from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import JobStatus, ShiftOption
from app.models.base import Base


class Job(Base):
    """A job posting with its description. One job has many candidates."""

    __tablename__ = "jobs"

    recruiter_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    requirements: Mapped[str] = mapped_column(Text, default="")
    jd_file_path: Mapped[str] = mapped_column(String(1000), default="")
    jd_raw_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default=JobStatus.ACTIVE, index=True)

    interview_duration_minutes: Mapped[int] = mapped_column(default=30)
    max_questions: Mapped[int] = mapped_column(default=10)
    difficulty_level: Mapped[str] = mapped_column(String(50), default="medium")

    # Hygiene check fields Ã¢â‚¬â€ passed to AI interview prompt
    office_locations: Mapped[str] = mapped_column(Text, default="")
    shift_flexible: Mapped[bool] = mapped_column(Boolean, default=True)
    # Human-readable shift description used in Q2 of the AI interview
    shift_info: Mapped[str] = mapped_column(Text, default=ShiftOption.ANY)

    # CTC feature — when True, interview asks for current + expected CTC
    ask_ctc: Mapped[bool] = mapped_column(Boolean, default=False)

    # Recruiter custom questions — list of strings (max 5), asked near end of interview
    recruiter_questions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Relationships
    recruiter: Mapped["User"] = relationship(back_populates="jobs", lazy="selectin")
    candidates: Mapped[list["Candidate"]] = relationship(
        back_populates="job",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
