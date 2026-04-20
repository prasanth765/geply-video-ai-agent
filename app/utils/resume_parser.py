from __future__ import annotations

from pathlib import Path

import structlog

logger = structlog.get_logger()


async def extract_text_from_file(file_path: str) -> str:
    """Extract plain text from PDF or DOCX resume files.

    Runs synchronously but is called from async context.
    For heavy loads (100+ resumes), push to Celery worker instead.
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    try:
        if ext == ".pdf":
            return _extract_pdf(path)
        elif ext in (".docx", ".doc"):
            return _extract_docx(path)
        elif ext == ".txt":
            return path.read_text(encoding="utf-8", errors="ignore")
        else:
            logger.warning("unsupported_file_type", ext=ext, path=str(path))
            return ""
    except Exception as exc:
        logger.error("text_extraction_failed", path=str(path), error=str(exc))
        return ""


def _extract_pdf(path: Path) -> str:
    """Extract text from PDF using pypdf (replaces deprecated PyPDF2)."""
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def _extract_docx(path: Path) -> str:
    """Extract text from DOCX using python-docx."""
    from docx import Document

    doc = Document(str(path))
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)
