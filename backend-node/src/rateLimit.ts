import { HttpError } from './http';

// Sliding-window in-memory rate limiter — mirrors backend/ratelimit.py.
// NOTE: per-process only. It resets on restart and is not shared across Render
// instances, so it's a soft abuse guard, not a hard security control. Move to
// Redis if the money endpoints need a real cross-instance limit.
const buckets = new Map<string, number[]>();

// Periodically drop empty buckets so the Map doesn't grow unboundedly with one
// entry per unique key (user id) forever.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    // Longest window in use is ~60s; anything older than 5min is dead.
    if (!hits.some((t) => t > now - CLEANUP_INTERVAL_MS)) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref?.();

export function checkRateLimit(key: string, maxCalls: number, windowSeconds: number): void {
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const bucket = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= maxCalls) {
    throw new HttpError(429, 'Too many requests, please try again later.');
  }
  bucket.push(now);
  buckets.set(key, bucket);
}
