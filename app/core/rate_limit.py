from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

import structlog
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

# ── Per-path rate limits (requests per minute) ──
_PATH_LIMITS: dict[str, int] = {
    "/api/v1/auth/login": 10,
    "/api/v1/auth/register": 5,
    "/api/v1/internal/chat": 30,
    "/api/v1/internal/tts": 30,
}
_DEFAULT_LIMIT = 120  # requests per minute for all other endpoints


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter per IP.

    For single-server deployment (SQLite). For multi-server,
    replace with Redis-backed rate limiting (e.g. slowapi + Redis).
    """

    def __init__(self, app):
        super().__init__(app)
        # {ip: {path: [(timestamp, ...)]}}
        self._requests: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and static files
        path = request.url.path
        if path in ("/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        limit = _PATH_LIMITS.get(path, _DEFAULT_LIMIT)
        now = time.time()
        window = 60.0  # 1 minute window

        # Clean old entries and check limit
        bucket = self._requests[ip][path]
        bucket[:] = [t for t in bucket if now - t < window]

        if len(bucket) >= limit:
            logger.warning("rate_limit_hit", ip=ip, path=path, limit=limit)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests, please try again later",
                        "context": {},
                    }
                },
            )

        bucket.append(now)
        return await call_next(request)
