import logging
import time
from collections import defaultdict, deque
from typing import Dict, Optional, Tuple
from fastapi import Request
from gateway.config import settings
from gateway.errors import RateLimitedException, ServiceUnavailableException

logger = logging.getLogger("gateway.rate_limiter")


class InMemorySlidingWindowStore:
    """Sliding-window rate limiter in memory with automatic timestamp eviction."""

    def __init__(self):
        # key -> deque of timestamps
        self.windows: Dict[str, deque] = defaultdict(deque)

    def check_and_increment(
        self, key: str, limit: int, window_seconds: int
    ) -> Tuple[bool, int, int]:
        now = time.time()
        boundary = now - window_seconds
        timestamps = self.windows[key]

        # Purge timestamps outside the current sliding window
        while timestamps and timestamps[0] <= boundary:
            timestamps.popleft()

        current_count = len(timestamps)
        if current_count >= limit:
            oldest = timestamps[0] if timestamps else now
            reset_seconds = max(1, int(oldest + window_seconds - now))
            return False, 0, reset_seconds

        timestamps.append(now)
        remaining = max(0, limit - (current_count + 1))
        reset_seconds = window_seconds
        return True, remaining, reset_seconds


class RedisSlidingWindowStore:
    """Sliding-window rate limiter using Redis sorted sets for multi-instance gateway deployments."""

    def __init__(self, redis_url: str):
        import redis.asyncio as aioredis
        self.redis = aioredis.from_url(redis_url, decode_responses=True)

    async def check_and_increment(
        self, key: str, limit: int, window_seconds: int
    ) -> Tuple[bool, int, int]:
        now = time.time()
        boundary = now - window_seconds
        redis_key = f"dakini:ratelimit:{key}"

        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(redis_key, 0, boundary)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, window_seconds + 5)
        results = await pipe.execute()

        current_count = results[1]
        if current_count >= limit:
            return False, 0, window_seconds

        remaining = max(0, limit - (current_count + 1))
        return True, remaining, window_seconds


# Global store instance
memory_store = InMemorySlidingWindowStore()
redis_store: Optional[RedisSlidingWindowStore] = None
if settings.REDIS_URL:
    try:
        redis_store = RedisSlidingWindowStore(settings.REDIS_URL)
        logger.info(f"Initialized Redis rate limiter store: {settings.REDIS_URL}")
    except Exception as exc:
        logger.warning(f"Could not connect to Redis, defaulting to in-memory: {exc}")


def get_endpoint_policy(request: Request) -> Tuple[str, int, int, bool]:
    """
    Returns (endpoint_class, limit, window_seconds, fail_closed).
    Based on the Layer 2 Rate-Limit Policy specification.
    """
    path = request.url.path.lower()
    method = request.method.upper()

    if "auth/login" in path or "auth/token" in path:
        return "login", settings.RATE_LIMIT_LOGIN, 60, True
    elif "agent" in path or "ai" in path:
        return "ai", settings.RATE_LIMIT_AI, 60, True
    elif "export" in path or "import" in path or "bulk" in path:
        return "bulk", settings.RATE_LIMIT_BULK, 3600, True
    elif "webhook" in path:
        return "webhooks", settings.RATE_LIMIT_WEBHOOKS, 60, False
    elif method in ("POST", "PUT", "PATCH", "DELETE"):
        return "writes", settings.RATE_LIMIT_WRITES, 60, False
    else:
        return "reads", settings.RATE_LIMIT_READS, 60, False


async def apply_rate_limit(request: Request) -> Dict[str, str]:
    """
    E5: Evaluates rate limits per endpoint class, tenant, and identity.
    Returns dictionary of rate limit headers to attach to response.
    Raises RateLimitedException (429) if limit exceeded.
    """
    if not settings.RATE_LIMIT_ENABLED:
        return {}

    endpoint_class, limit, window_seconds, fail_closed = get_endpoint_policy(request)
    client_ip = getattr(request.state, "client_ip", "127.0.0.1")
    user_id = getattr(request.state, "user_id", None)
    tenant_id = getattr(request.state, "tenant_id", None)

    # 1. Primary endpoint key
    if endpoint_class == "login":
        # Key on IP + account identifier
        key = f"login:{client_ip}"
    elif endpoint_class == "bulk":
        key = f"bulk:{tenant_id or 'anon'}:{user_id or client_ip}"
    elif user_id:
        key = f"{endpoint_class}:usr:{user_id}"
    else:
        key = f"{endpoint_class}:ip:{client_ip}"

    correlation_id = getattr(request.state, "correlation_id", "req_unknown")

    # 2. Check primary limit
    allowed = True
    remaining = limit
    reset_seconds = window_seconds

    try:
        if redis_store:
            allowed, remaining, reset_seconds = await redis_store.check_and_increment(
                key, limit, window_seconds
            )
        else:
            allowed, remaining, reset_seconds = memory_store.check_and_increment(
                key, limit, window_seconds
            )
    except Exception as exc:
        logger.error(
            f"Rate limiter store error on key {key}: {exc}",
            extra={"correlation_id": correlation_id},
        )
        if fail_closed:
            # Login and export fail-closed to protect security and database
            raise ServiceUnavailableException(
                message="Rate limit validation service temporarily unavailable"
            )
        else:
            # Reads and writes fail-open to preserve client availability
            allowed = True

    if not allowed:
        logger.warning(
            f"Rate limit exceeded for {key} on {request.url.path} (limit={limit}/{window_seconds}s)",
            extra={"correlation_id": correlation_id},
        )
        raise RateLimitedException(
            retry_after=reset_seconds,
            message=f"Rate limit exceeded for endpoint class '{endpoint_class}'. Limit is {limit} req/{window_seconds}s. Retry after {reset_seconds}s.",
        )

    # 3. Whole tenant fair share check (if authenticated)
    if tenant_id:
        tenant_key = f"tenant:{tenant_id}"
        tenant_limit = settings.RATE_LIMIT_TENANT
        try:
            if redis_store:
                t_allowed, _, t_reset = await redis_store.check_and_increment(
                    tenant_key, tenant_limit, 60
                )
            else:
                t_allowed, _, t_reset = memory_store.check_and_increment(
                    tenant_key, tenant_limit, 60
                )

            if not t_allowed:
                logger.warning(
                    f"Tenant fair-share quota exceeded for tenant={tenant_id}",
                    extra={"correlation_id": correlation_id},
                )
                raise RateLimitedException(
                    retry_after=t_reset,
                    message=f"Tenant rate quota exceeded ({tenant_limit}/min). Please retry in {t_reset}s.",
                )
        except RateLimitedException:
            raise
        except Exception as exc:
            logger.warning(f"Tenant rate limit check skipped on error: {exc}")

    # Return headers to attach to response
    return {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(reset_seconds),
    }
