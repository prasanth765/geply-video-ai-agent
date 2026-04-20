from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ScheduleSlot(Base):
    """An available time slot for an interview.

    System generates 24/7 availability — candidate picks a slot — slot gets locked.
    """

    __tablename__ = "schedule_slots"

    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)
    candidate_id: Mapped[str | None] = mapped_column(
        ForeignKey("candidates.id"),
        nullable=True,
        index=True,
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    is_booked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    candidate: Mapped["Candidate | None"] = relationship(
        back_populates="schedule_slots",
        lazy="selectin",
    )
