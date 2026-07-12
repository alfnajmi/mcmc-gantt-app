"""Application configuration — all values from environment variables."""

import os
import sys


DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("FATAL: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]

DB_POOL_MIN: int = int(os.environ.get("DB_POOL_MIN", "1"))
DB_POOL_MAX: int = int(os.environ.get("DB_POOL_MAX", "10"))
