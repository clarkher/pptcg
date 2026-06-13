import { describe, it, expect } from 'vitest';
import {
  hashToken, createTokenPair, isTokenUsable, buildAuthLink, canIssueReset,
  VERIFY_TTL_MS, RESET_TTL_MS,
} from './auth-helpers';

describe('hashToken', () => {
  it('是 deterministic 的 64 字元 hex sha256', () => {
    const a = hashToken('abc');
    expect(a).toBe(hashToken('abc'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(hashToken('abd'));
  });
});

describe('createTokenPair', () => {
  it('回傳 raw(64 hex)、其 sha256、now+ttl 的 expiresAt', () => {
    const now = new Date('2026-06-13T00:00:00Z');
    const { raw, tokenHash, expiresAt } = createTokenPair(VERIFY_TTL_MS, now);
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(raw));
    expect(expiresAt.getTime()).toBe(now.getTime() + VERIFY_TTL_MS);
  });
  it('每次 raw 不同', () => {
    expect(createTokenPair(RESET_TTL_MS).raw).not.toBe(createTokenPair(RESET_TTL_MS).raw);
  });
});

describe('isTokenUsable', () => {
  const now = new Date('2026-06-13T00:00:00Z');
  it('未使用且未過期 → true', () => {
    expect(isTokenUsable({ usedAt: null, expiresAt: new Date(now.getTime() + 1000) }, now)).toBe(true);
  });
  it('已使用 → false', () => {
    expect(isTokenUsable({ usedAt: now, expiresAt: new Date(now.getTime() + 1000) }, now)).toBe(false);
  });
  it('已過期 → false', () => {
    expect(isTokenUsable({ usedAt: null, expiresAt: new Date(now.getTime() - 1000) }, now)).toBe(false);
  });
  it('剛好到期(expiresAt === now) → false（嚴格大於，防 >= 回歸）', () => {
    expect(isTokenUsable({ usedAt: null, expiresAt: now }, now)).toBe(false);
  });
});

describe('buildAuthLink', () => {
  it('組出連結並去掉結尾斜線', () => {
    expect(buildAuthLink('https://x.com/', '/verify-email', 'tok')).toBe('https://x.com/verify-email?token=tok');
    expect(buildAuthLink('https://x.com', '/reset-password', 'tok')).toBe('https://x.com/reset-password?token=tok');
  });
});

describe('canIssueReset', () => {
  it('有密碼 → true', () => expect(canIssueReset({ password: 'h' })).toBe(true));
  it('純 Google 帳號(password null) → false', () => expect(canIssueReset({ password: null })).toBe(false));
  it('查無使用者 → false', () => expect(canIssueReset(null)).toBe(false));
});
