from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

import structlog
from sqlalchemy import MetaData, event
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import get_settings

logger = structlog.get_logger()

# ── Naming convention for constraints (Alembic-friendly) ──
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(AsyncAttrs, DeclarativeBase):
    """Base class for all models with auto-generated id and timestamps."""

    metadata = MetaData(naming_convention=convention)

    id: Mapped[str] = mapped_column(
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


def _build_engine():
    """Build the async engine with appropriate settings for SQLite or Postgres."""
    settings = get_settings()
    db_url = settings.database_url
    is_sqlite = "sqlite" in db_url

    engine_kwargs: dict = {
        # Never use echo=True — it dumps raw SQL before structlog is configured.
        # For SQL debugging, set logging.getLogger("sqlalchemy.engine").setLevel(DEBUG)
        "echo": False,
    }

    if is_sqlite:
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        engine_kwargs["pool_size"] = settings.database_pool_size
        engine_kwargs["max_overflow"] = settings.database_max_overflow
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 300

    eng = create_async_engine(db_url, **engine_kwargs)

    # Enable WAL mode and foreign keys for SQLite
    if is_sqlite:
        @event.listens_for(eng.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return eng


engine = _build_engine()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a DB session with auto-commit on success.

    NOTE: This auto-commits when the route handler completes without error.
    Services that need explicit transaction control should call session.commit()
    themselves and catch exceptions appropriately.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all tables that don't exist yet. Dev/test only — use Alembic in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables() -> None:
    """Drop all tables. Use with extreme caution — data loss is permanent."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
