import crypto from 'crypto';

describe('Authentication & Refresh Token Rotation Invariants', () => {
  interface StoredRefreshToken {
    tokenHash: string;
    userId: string;
    isRevoked: boolean;
    expiresAt: Date;
  }

  const tokenStore: Map<string, StoredRefreshToken> = new Map();

  function hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  function issueRefreshToken(userId: string): string {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = hashToken(raw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    tokenStore.set(hash, {
      tokenHash: hash,
      userId,
      isRevoked: false,
      expiresAt,
    });

    return raw;
  }

  function rotateRefreshToken(rawToken: string): {
    success: boolean;
    newRefreshToken?: string;
    error?: string;
  } {
    const hash = hashToken(rawToken);
    const record = tokenStore.get(hash);

    if (!record) {
      return { success: false, error: 'INVALID_TOKEN' };
    }

    if (record.isRevoked) {
      return { success: false, error: 'TOKEN_ALREADY_REVOKED' };
    }

    if (record.expiresAt < new Date()) {
      return { success: false, error: 'TOKEN_EXPIRED' };
    }

    // Revoke old token
    record.isRevoked = true;

    // Issue new token
    const newRaw = issueRefreshToken(record.userId);

    return {
      success: true,
      newRefreshToken: newRaw,
    };
  }

  it('issues and successfully rotates a refresh token', () => {
    const userId = 'usr-test-123';
    const initialToken = issueRefreshToken(userId);

    const rotationResult = rotateRefreshToken(initialToken);
    expect(rotationResult.success).toBe(true);
    expect(rotationResult.newRefreshToken).toBeDefined();
    expect(rotationResult.newRefreshToken).not.toBe(initialToken);

    // Old token should now be marked as revoked
    const oldHash = hashToken(initialToken);
    expect(tokenStore.get(oldHash)?.isRevoked).toBe(true);
  });

  it('rejects attempt to reuse a revoked refresh token', () => {
    const userId = 'usr-test-456';
    const token = issueRefreshToken(userId);

    // First rotation succeeds
    const firstRotation = rotateRefreshToken(token);
    expect(firstRotation.success).toBe(true);

    // Replay attack: Attacker tries to use the old token again
    const replayAttempt = rotateRefreshToken(token);
    expect(replayAttempt.success).toBe(false);
    expect(replayAttempt.error).toBe('TOKEN_ALREADY_REVOKED');
  });

  it('rejects expired refresh tokens', () => {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = hashToken(raw);
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

    tokenStore.set(hash, {
      tokenHash: hash,
      userId: 'usr-expired',
      isRevoked: false,
      expiresAt: expiredDate,
    });

    const result = rotateRefreshToken(raw);
    expect(result.success).toBe(false);
    expect(result.error).toBe('TOKEN_EXPIRED');
  });
});
