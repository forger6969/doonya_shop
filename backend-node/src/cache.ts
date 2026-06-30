// In-memory TTL cache — mirrors backend/cache.py (per-process, monotonic TTL).
interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function cacheGet<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value as T;
  store.delete(key);
  return null;
}

export function cacheSet(key: string, value: unknown, ttlSeconds = 30): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
