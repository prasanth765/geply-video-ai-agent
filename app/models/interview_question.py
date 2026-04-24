"""
Candidate Interview Question model.

Stores the AI-generated + recruiter-curated interview questions for
each candidate. Populated after resume parse. Editable via CRUD API.
Consumed by the interview runtime as the authoritative question set.

Design notes:
- Keyed on candidate_id (not interview_id) because questions exist
  before any interview starts.
- job_id denormalized for fast lookup in JobDetail (avoids join through
  candidates).
- `is_custom` distinguishes recruiter-added/edited questions from
  LLM-generated ones (useful for analytics + regenerate logic).
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class InterviewQuestion(Base):
    """AI-generated or recruiter-curated question for a specific candidate."""

    __tablename__ = "candidate_interview_questions"

    candidate_id: Mapped[str] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"),
        index=True,
    )
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"),
        index=True,
    )

    # Category enum (stored as string for SQLite simplicity):
    #   hygiene, jd_fit, resume_verify, ctc, recruiter_custom
    category: Mapped[str] = mapped_column(String(32), index=True)

    # Order within the category (0-based). Frontend displays + interview
    # runtime asks in ascending position.
    position: Mapped[int] = mapped_column(Integer, default=0)

    question_text: Mapped[str] = mapped_column(Text)

    # True = recruiter added or edited this question.
    # False = LLM-generated, untouched.
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationship (no back_populates yet — candidate model unchanged)
    # Use lazy="selectin" for eager loading in list queries.
    candidate = relationship(
        "Candidate",
        foreign_keys=[candidate_id],
        lazy="selectin",
    )

    __table_args__ = (
        # Composite index for the primary lookup pattern:
        # "show me this candidate's questions, ordered by category + position"
        Index(
            "ix_candidate_interview_questions_cand_cat_pos",
            "candidate_id",
            "category",
            "position",
        ),
    )