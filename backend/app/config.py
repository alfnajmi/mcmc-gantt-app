"""Application configuration — all values from environment variables."""

import logging
import os
import sys

from pythonjsonlogger import jsonlogger

# Plane.so integration (required)
PLANE_BASE_URL: str = os.environ.get("PLANE_BASE_URL", "").rstrip("/")
PLANE_API_TOKEN: str = os.environ.get("PLANE_API_TOKEN", "")
PLANE_WORKSPACE_SLUG: str = os.environ.get("PLANE_WORKSPACE_SLUG", "")

if not PLANE_BASE_URL or not PLANE_API_TOKEN or not PLANE_WORKSPACE_SLUG:
    print(
        "WARNING: Plane credentials not fully configured. "
        "Set PLANE_BASE_URL, PLANE_API_TOKEN, and PLANE_WORKSPACE_SLUG.",
        file=sys.stderr,
    )

# CORS
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]

# Redis cache (optional — degrades gracefully if not configured)
REDIS_URL: str = os.environ.get("REDIS_URL", "")
CACHE_TTL_SECONDS: int = int(os.environ.get("CACHE_TTL_SECONDS", "300"))

# Configure structured JSON logging
handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter(
    fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
))
logging.root.handlers = [handler]
logging.root.setLevel(os.environ.get("LOG_LEVEL", "INFO"))
