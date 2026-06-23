import time
from collections import defaultdict
from fastapi import HTTPException

_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_calls: int, window_seconds: float) -> None:
    """Sliding-window in-memory rate limiter. Raises HTTP 429 if limit exceeded."""
    now = time.monotonic()
    cutoff = now - window_seconds
    bucket = _buckets[key]
    _buckets[key] = [t for t in bucket if t > cutoff]
    if len(_buckets[key]) >= max_calls:
        raise HTTPException(status_code=429, detail="Too many requests, please try again later.")
    _buckets[key].append(now)
