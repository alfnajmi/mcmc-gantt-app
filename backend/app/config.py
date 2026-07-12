"""Application configuration — all values from environment variables."""

import os


DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://gantt:gantt@db:5432/gantt"
)

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "*").split(",")
    if o.strip()
]

DB_POOL_MIN: int = int(os.environ.get("DB_POOL_MIN", "1"))
DB_POOL_MAX: int = int(os.environ.get("DB_POOL_MAX", "10"))
