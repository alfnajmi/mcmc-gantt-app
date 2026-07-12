"""Database connection pool management."""

import asyncpg

from app.config import DATABASE_URL, DB_POOL_MIN, DB_POOL_MAX

pool: asyncpg.Pool | None = None


async def connect():
    """Create the connection pool."""
    global pool
    pool = await asyncpg.create_pool(
        DATABASE_URL, min_size=DB_POOL_MIN, max_size=DB_POOL_MAX
    )


async def disconnect():
    """Close the connection pool."""
    global pool
    if pool:
        await pool.close()
        pool = None


def get_pool() -> asyncpg.Pool:
    """Return the active pool. Raises if not connected."""
    if pool is None:
        raise RuntimeError("Database pool not initialized")
    return pool
