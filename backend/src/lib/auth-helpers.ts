import crypto from 'crypto';

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const RESET_TTL_MS = 60 * 60 * 1000;        // 1h

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function createTokenPair(
  ttlMs: number,
  now: Date = new Date(),
): { raw: string; tokenHash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + ttlMs) };
}

export function isTokenUsable(
  token: { usedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}

export function buildAuthLink(frontendUrl: string, path: string, rawToken: string): string {
  return `${frontendUrl.replace(/\/$/, '')}${path}?token=${rawToken}`;
}

// 純 Google 帳號（password 為 null）不發重設信
export function canIssueReset(user: { password: string | null } | null): boolean {
  return !!user && !!user.password;
}
