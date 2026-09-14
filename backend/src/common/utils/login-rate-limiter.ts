import { AppError } from '../middleware/error.middleware';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

class LoginRateLimiter {
  private attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
  }

  check(key: string) {
    const record = this.attempts.get(key.toLowerCase().trim());
    if (!record) return;

    const now = Date.now();

    // If currently locked out
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingMin = Math.ceil((record.lockedUntil - now) / 60000);
      throw new AppError(
        429,
        'TOO_MANY_ATTEMPTS',
        `Account access temporarily restricted due to 5 consecutive failed login attempts. Please try again after ${remainingMin} minute(s).`
      );
    }

    // Reset if window expired
    if (now - record.firstAttemptAt > this.windowMs) {
      this.attempts.delete(key.toLowerCase().trim());
    }
  }

  recordFailure(key: string) {
    const cleanKey = key.toLowerCase().trim();
    const now = Date.now();
    const record = this.attempts.get(cleanKey);

    if (!record || now - record.firstAttemptAt > this.windowMs) {
      this.attempts.set(cleanKey, { count: 1, firstAttemptAt: now });
      return;
    }

    record.count += 1;
    if (record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
    }
  }

  recordSuccess(key: string) {
    this.attempts.delete(key.toLowerCase().trim());
  }

  reset(key?: string) {
    if (key) {
      this.attempts.delete(key.toLowerCase().trim());
    } else {
      this.attempts.clear();
    }
  }
}

// Independent rate limiters for tenant and super-admin realms
export const tenantLoginLimiter = new LoginRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
export const superAdminLoginLimiter = new LoginRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
