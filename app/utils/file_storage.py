from __future__ import annotations

import uuid
from pathlib import Path

import aiofiles

from app.core.config import get_settings


async def save_upload(
    content: bytes,
    filename: str,
    subfolder: str = "",
) -> str:
    """Save uploaded file to local disk. Returns the file path.

    For production with MinIO, swap the implementation here —
    the rest of the app doesn't care where files live.
    """
    settings = get_settings()
    base = Path(settings.storage_local_path)
    target_dir = base / subfolder if subfolder else base
    target_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(filename).suffix
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = target_dir / safe_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return str(file_path)


async def read_file(file_path: str) -> bytes:
    """Read file content from storage."""
    async with aiofiles.open(file_path, "rb") as f:
        return await f.read()


async def delete_file(file_path: str) -> bool:
    """Delete a file from storage."""
    path = Path(file_path)
    if path.exists():
        path.unlink()
        return True
    return False


def get_file_url(file_path: str) -> str:
    """Get a URL for accessing a stored file.

    In local mode, this returns an API path.
    In MinIO mode, this would return a presigned URL.
    """
    settings = get_settings()
    return f"{settings.api_url}/api/v1/files/{Path(file_path).name}"
