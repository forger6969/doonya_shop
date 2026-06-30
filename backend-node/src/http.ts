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

// Central error handler — matches FastAPI's { "detail": ... } body shape.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ detail: err.detail });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ detail: 'Internal server error' });
}
