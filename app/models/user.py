from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    """Recruiter / admin user account."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # LEGACY: KB moved to app_settings table (key='company_kb') in Session 5.
    company_kb: Mapped[str] = mapped_column(Text, default="")

    # Relationships
    jobs: Mapped[list["Job"]] = relationship(back_populates="recruiter", lazy="selectin")
