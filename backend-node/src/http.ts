import { Request, Response, NextFunction, RequestHandler } from 'express';

// Mirrors FastAPI's HTTPException(status_code, detail).
export class HttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

// Wraps an async route so thrown errors reach the error middleware.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// Bounds a promise that could otherwise hang forever (e.g. a stalled upstream
// HTTP call with no timeout of its own), turning a frozen request into a clean
// rejection so the client doesn't spin indefinitely on "Отправка...".
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// Central error handler — matches FastAPI's { "detail": ... } body shape.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ detail: err.detail });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ detail: 'Internal server error' });
}
