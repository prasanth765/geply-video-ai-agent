from __future__ import annotations

import asyncio

import structlog

from app.workers.celery_app import celery_app
from app.utils.resume_parser import extract_text_from_file

logger = structlog.get_logger()


@celery_app.task(name="parse_resume", bind=True, max_retries=3)
def parse_resume(self, candidate_id: str, file_path: str) -> dict:
    """Parse a single resume and update the candidate record."""
    try:
        text = asyncio.get_event_loop().run_until_complete(
            extract_text_from_file(file_path)
        )
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            text = loop.run_until_complete(extract_text_from_file(file_path))
        finally:
            loop.close()

    if not text:
        logger.warning("resume_parse_empty", candidate_id=candidate_id, path=file_path)
        return {"candidate_id": candidate_id, "parsed": False, "chars": 0}

    _update_candidate_resume(candidate_id, text)

    logger.info("resume_parsed", candidate_id=candidate_id, chars=len(text))
    return {"candidate_id": candidate_id, "parsed": True, "chars": len(text)}


@celery_app.task(name="parse_resumes_bulk")
def parse_resumes_bulk(candidates: list[dict]) -> dict:
    """Parse multiple resumes in parallel."""
    results = []
    for c in candidates:
        result = parse_resume.delay(c["candidate_id"], c["file_path"])
        results.append(result.id)
    return {"queued": len(results), "task_ids": results}


def _update_candidate_resume(candidate_id: str, text: str) -> None:
    """Synchronous DB update for Celery worker context."""
    from sqlalchemy import create_engine, text as sql_text
    from app.core.config import get_settings

    settings = get_settings()
    sync_url = settings.database_url.replace("+aiosqlite", "")
    engine = create_engine(sync_url)

    with engine.connect() as conn:
        conn.execute(
            sql_text(
                "UPDATE candidates SET resume_raw_text = :text, resume_parsed = true "
                "WHERE id = :id"
            ),
            {"text": text, "id": candidate_id},
        )
        conn.commit()

    engine.dispose()
