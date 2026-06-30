import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { HttpError, asyncHandler } from './http';

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tgUser: TgUser;
    }
  }
}

const INIT_DATA_MAX_AGE = 86400; // 24h — replay protection

// Validate Telegram Mini App initData and return the parsed user.
export function verifyTelegramInitData(initData: string): TgUser {
  if (!initData) throw new HttpError(401, 'Missing initData');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new HttpError(401, 'No hash in initData');
  params.delete('hash');

  const authDate = params.get('auth_date');
  if (authDate) {
    const age = Math.floor(Date.now() / 1000) - parseInt(authDate, 10);
    if (!Number.isFinite(age)) throw new HttpError(401, 'Invalid auth_date');
    if (age > INIT_DATA_MAX_AGE) throw new HttpError(401, 'initData expired');
  }

  const dataCheckString = [...params.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(receivedHash);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Invalid initData signature');
  }

  try {
    return JSON.parse(params.get('user') ?? '{}') as TgUser;
  } catch {
    throw new HttpError(401, 'Invalid user payload in initData');
  }
}

// Express middleware — reads X-Init-Data header, attaches req.tgUser.
export const requireUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const initData = req.header('X-Init-Data') ?? '';
  req.tgUser = verifyTelegramInitData(initData);
  next();
});
