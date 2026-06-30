import { HttpError } from './http';

// Sliding-window in-memory rate limiter — mirrors backend/ratelimit.py.
const buckets = new Map<string, number[]>();

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
