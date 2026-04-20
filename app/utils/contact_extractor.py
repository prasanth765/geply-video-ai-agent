"""Extract contact information (name, email, phone) from resume text.

Uses regex patterns to find email addresses, phone numbers (multiple formats),
and the candidate's name (typically the first meaningful line of a resume).
"""
from __future__ import annotations

import re

import structlog

logger = structlog.get_logger()

# Email: standard pattern, excludes common non-personal emails
_EMAIL_RE = re.compile(
    r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE,
)

# Phone: covers US, Indian, international formats
_PHONE_PATTERNS = [
    re.compile(r'\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}'),
    re.compile(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'),
    re.compile(r'\+\d{10,13}'),
]

# Words to skip when looking for a name (common resume headers)
_SKIP_WORDS = {
    'resume', 'cv', 'curriculum', 'vitae', 'objective', 'summary',
    'experience', 'education', 'skills', 'contact', 'address',
    'phone', 'email', 'linkedin', 'github', 'portfolio', 'http',
    'www', 'page', 'references',
}

# Domains to skip when extracting emails
_SKIP_EMAIL_DOMAINS = {'pending.geply', 'example.com', 'test.com'}


def extract_contact_info(text: str) -> dict:
    """Extract name, email, and phone from resume text.

    Returns:
        {"name": str, "email": str, "phone": str}
        Any field may be empty if not found.
    """
    if not text or not text.strip():
        return {"name": "", "email": "", "phone": ""}

    email = _extract_email(text)
    phone = _extract_phone(text)
    name = _extract_name(text, email)

    logger.debug(
        "contact_extracted",
        name=name,
        email=email,
        phone=phone,
    )
    return {"name": name, "email": email, "phone": phone}


def _extract_email(text: str) -> str:
    """Find the first personal email in the text."""
    for match in _EMAIL_RE.finditer(text):
        addr = match.group(0).strip().rstrip('.')
        domain = addr.split('@')[-1].lower()
        if domain not in _SKIP_EMAIL_DOMAINS:
            return addr
    return ""


def _extract_phone(text: str) -> str:
    """Find the first phone number in the text."""
    for pattern in _PHONE_PATTERNS:
        match = pattern.search(text)
        if match:
            phone = match.group(0).strip()
            digits = re.sub(r'\D', '', phone)
            if 7 <= len(digits) <= 15:
                return phone
    return ""


def _extract_name(text: str, email: str) -> str:
    """Extract candidate name from the first meaningful line of a resume."""
    lines = text.split('\n')
    email_user = email.split('@')[0].lower() if email else ""

    for idx, raw_line in enumerate(lines[:15]):
        line = raw_line.strip()
        if not line or len(line) < 3 or len(line) > 60:
            continue

        if '@' in line or 'http' in line or 'www.' in line:
            continue

        lower = line.lower()
        if any(skip in lower for skip in _SKIP_WORDS):
            continue

        words = line.split()
        if 1 <= len(words) <= 5:
            alpha_words = [w for w in words if re.match(r'^[A-Za-z.\-\']+$', w)]
            if len(alpha_words) >= len(words) * 0.7:
                name_candidate = ' '.join(words)
                name_lower = name_candidate.lower().replace(' ', '')
                if email_user and (
                    any(part in email_user for part in name_lower.split() if len(part) > 2)
                    or any(part in name_lower for part in email_user.split('.') if len(part) > 2)
                ):
                    return name_candidate
                if idx < 5:
                    return name_candidate

    return ""
