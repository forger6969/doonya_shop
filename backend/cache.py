import time
from typing import Any

_store: dict[str, tuple[Any, float]] = {}


def cache_get(key: str) -> Any | None:
    entry = _store.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    _store.pop(key, None)
    return None


def cache_set(key: str, value: Any, ttl: int = 30) -> None:
    _store[key] = (value, time.monotonic() + ttl)


def cache_invalidate(prefix: str) -> None:
    keys = [k for k in _store if k.startswith(prefix)]
    for k in keys:
        _store.pop(k, None)
