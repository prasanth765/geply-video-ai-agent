from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import InterviewStatus
from app.models.base import Base


class Interview(Base):
    """A single interview session between the AI agent and a candidate."""

    __tablename__ = "interviews"

    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    room_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default=InterviewStatus.PENDING,
        index=True,
    )

    # Scheduling
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)

    # Recording & Transcript
    recording_path: Mapped[str] = mapped_column(String(1000), default="")
    transcript: Mapped[str] = mapped_column(Text, default="")
    questions_asked: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    answers_received: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Scoring
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    technical_score: Mapped[float] = mapped_column(Float, default=0.0)
    communication_score: Mapped[float] = mapped_column(Float, default=0.0)
    problem_solving_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Proctoring
    proctor_events: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    proctor_score: Mapped[float] = mapped_column(Float, default=100.0)

    # LiveKit metadata
    livekit_room_sid: Mapped[str] = mapped_column(String(255), default="")
    egress_id: Mapped[str] = mapped_column(String(255), default="")

    # Relationships
    candidate: Mapped["Candidate"] = relationship(back_populates="interviews", lazy="selectin")
    report: Mapped["Report | None"] = relationship(
        back_populates="interview",
        lazy="selectin",
        uselist=False,
        cascade="all, delete-orphan",
    )
