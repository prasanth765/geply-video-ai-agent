from __future__ import annotations

import structlog
import httpx

from app.core.config import get_settings
from app.workers.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="send_invite_email", bind=True, max_retries=3)
def send_invite_email(
    self,
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company: str,
    invite_url: str,
) -> dict:
    """Send interview invite via n8n webhook.

    n8n handles the actual email/WhatsApp delivery —
    we just trigger the workflow with the right payload.
    """
    settings = get_settings()
    webhook_url = f"{settings.n8n_base_url}{settings.n8n_webhook_email_invite}"

    payload = {
        "to_email": candidate_email,
        "to_name": candidate_name,
        "job_title": job_title,
        "company": company,
        "invite_url": invite_url,
        "subject": f"Interview Invitation: {job_title} at {company}",
    }

    try:
        response = httpx.post(webhook_url, json=payload, timeout=15.0)
        response.raise_for_status()
        logger.info(
            "invite_email_sent",
            email=candidate_email,
            job=job_title,
        )
        return {"status": "sent", "email": candidate_email}
    except httpx.HTTPStatusError as exc:
        logger.error(
            "invite_email_failed",
            email=candidate_email,
            status=exc.response.status_code,
        )
        raise self.retry(exc=exc, countdown=60)
    except Exception as exc:
        logger.error("invite_email_error", email=candidate_email, error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="send_bulk_invites")
def send_bulk_invites(invites: list[dict]) -> dict:
    """Queue individual invite emails for a batch of candidates.

    Each dict: {candidate_email, candidate_name, job_title, company, invite_url}
    """
    queued = 0
    for inv in invites:
        send_invite_email.delay(
            candidate_email=inv["candidate_email"],
            candidate_name=inv["candidate_name"],
            job_title=inv["job_title"],
            company=inv["company"],
            invite_url=inv["invite_url"],
        )
        queued += 1

    logger.info("bulk_invites_queued", count=queued)
    return {"queued": queued}
