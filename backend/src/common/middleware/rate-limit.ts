import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired buckets every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetTime <= now) {
        store.delete(key);
      }
    }
  }, 60000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const key = options.keyGenerator ? options.keyGenerator(req) : ip;

    const now = Date.now();
    let record = store.get(key);

    if (!record || record.resetTime <= now) {
      record = { count: 1, resetTime: now + options.windowMs };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, options.max - record.count)
    );
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(record.resetTime / 1000).toString()
    );

    if (record.count > options.max) {
      return sendError(
        res,
        429,
        'TOO_MANY_REQUESTS',
        options.message || 'Too many requests, please try again later.'
      );
    }

    next();
  };
}

// Compound limiter: 5 attempts per 60 seconds per IP + Email
// Prevents brute force while protecting legitimate users from Account Lockout DoS attacks
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts for this account from your IP. Please try again in 1 minute.',
  keyGenerator: (req) => {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'unknown-ip';
    const email = (req.body?.email || '').trim().toLowerCase();
    return `${ip}:${email}`;
  },
});
