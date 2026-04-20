"""
Email service with two modes:
- Dev  (no RESEND_API_KEY): logs link to console.
- Prod (RESEND_API_KEY set): sends via Resend API (resend.com).
"""
from __future__ import annotations

import httpx
import structlog

from app.core.config import get_settings

logger = structlog.get_logger()


class EmailService:
    async def send_reset_link(self, to_email: str, user_name: str, reset_link: str) -> bool:
        settings = get_settings()

        if not settings.resend_api_key:
            logger.info(
                "email_dev_mode_reset_link",
                to=to_email,
                link=reset_link,
                note="RESEND_API_KEY not set -- link logged instead of emailed",
            )
            return True

        subject = "Reset your Geply password"
        html = _render_reset_html(user_name, reset_link)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": settings.email_from,
                        "to": [to_email],
                        "subject": subject,
                        "html": html,
                    },
                )
            if resp.status_code >= 400:
                logger.error("email_send_failed", status=resp.status_code, body=resp.text)
                return False
            logger.info("email_sent", to=to_email, provider="resend")
            return True
        except Exception as exc:
            logger.error("email_send_exception", error=str(exc))
            return False


def _render_reset_html(user_name: str, reset_link: str) -> str:
    safe_name = user_name or "there"
    return f"""
<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;line-height:1.6;color:#333;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#3b82f6;margin:0 0 4px;">Geply</h2>
  <p style="color:#666;font-size:13px;margin:0 0 32px;">AI-Powered Interview Platform</p>
  <p>Hi {safe_name},</p>
  <p>We received a request to reset your password. Click the button below to choose a new one:</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="{reset_link}" style="background:#3b82f6;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">Reset password</a>
  </p>
  <p style="color:#666;font-size:13px;">Or paste this link in your browser:</p>
  <p style="background:#f5f5f5;padding:10px;border-radius:4px;word-break:break-all;font-size:12px;">{reset_link}</p>
  <p style="color:#999;font-size:13px;margin-top:28px;"><strong>This link expires in 15 minutes.</strong> If you didn't request this, ignore this email.</p>
</body></html>
"""


email_service = EmailService()
