"""
Redis cache layer for Plane API responses.

Caches expensive Plane API calls (project lists, issues, relations) to avoid
hammering the Plane instance on every page load. Cache is invalidated:
  - Automatically via TTL (default 5 minutes)
  - Manually via the /api/plane/cache/invalidate endpoint
  - On write operations (PATCH dates)

If Redis is unavailable, the service degrades gracefully — all operations
fall through to Plane directly (no errors raised).
"""

import json
import logging
from typing import Any

from app.config import REDIS_URL, CACHE_TTL_SECONDS

logger = logging.getLogger(__name__)

_redis = None
_available = False


async def connect():
    """Initialize the Redis connection pool. Silently skips if not configured."""
    global _redis, _available

    if not REDIS_URL:
        logger.info("REDIS_URL not set — caching disabled")
        return

    try:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        # Test connectivity
        await _redis.ping()
        _available = True
        logger.info("Redis cache connected: %s", REDIS_URL)
    except Exception as e:
        logger.warning("Redis unavailable (caching disabled): %s", e)
        _redis = None
        _available = False


async def disconnect():
    """Close the Redis connection."""
    global _redis, _available
    if _redis:
        await _redis.aclose()
        _redis = None
        _available = False


def is_available() -> bool:
    """Check if Redis caching is active."""
    return _available


def _make_key(namespace: str, *parts: str) -> str:
    """Build a cache key from namespace and parts."""
    return f"gantt:plane:{namespace}:{':'.join(parts)}"


async def get(namespace: str, *parts: str) -> Any | None:
    """
    Get a cached value. Returns None on miss or if Redis is unavailable.
    """
    if not _available:
        return None

    key = _make_key(namespace, *parts)
    try:
        raw = await _redis.get(key)
        if raw is not None:
            logger.debug("Cache HIT: %s", key)
            return json.loads(raw)
        logger.debug("Cache MISS: %s", key)
        return None
    except Exception as e:
        logger.warning("Cache get error: %s", e)
        return None


async def set(namespace: str, *parts: str, value: Any, ttl: int | None = None):
    """
    Store a value in cache with TTL.
    """
    if not _available:
        return

    key = _make_key(namespace, *parts)
    ttl = ttl or CACHE_TTL_SECONDS
    try:
        await _redis.set(key, json.dumps(value, default=str), ex=ttl)
        logger.debug("Cache SET: %s (ttl=%ds)", key, ttl)
    except Exception as e:
        logger.warning("Cache set error: %s", e)


async def invalidate(namespace: str, *parts: str):
    """
    Invalidate a specific cache key.
    """
    if not _available:
        return

    key = _make_key(namespace, *parts)
    try:
        await _redis.delete(key)
        logger.debug("Cache INVALIDATED: %s", key)
    except Exception as e:
        logger.warning("Cache invalidate error: %s", e)


async def invalidate_project(project_id: str):
    """
    Invalidate all cached data for a specific project.
    Uses pattern-based deletion.
    """
    if not _available:
        return

    pattern = f"gantt:plane:*:{project_id}*"
    try:
        cursor = 0
        while True:
            cursor, keys = await _redis.scan(cursor, match=pattern, count=100)
            if keys:
                await _redis.delete(*keys)
                logger.debug("Cache INVALIDATED %d keys for project %s", len(keys), project_id)
            if cursor == 0:
                break
    except Exception as e:
        logger.warning("Cache invalidate_project error: %s", e)


async def invalidate_all():
    """
    Invalidate all Plane Gantt cache entries.
    """
    if not _available:
        return

    pattern = "gantt:plane:*"
    try:
        cursor = 0
        total = 0
        while True:
            cursor, keys = await _redis.scan(cursor, match=pattern, count=100)
            if keys:
                await _redis.delete(*keys)
                total += len(keys)
            if cursor == 0:
                break
        logger.info("Cache FLUSH: removed %d keys", total)
    except Exception as e:
        logger.warning("Cache invalidate_all error: %s", e)
