import { describe, it, expect } from 'vitest';
import { parseEcpayExpireDate } from './reservation';

describe('parseEcpayExpireDate', () => {
  const now = new Date('2026-06-10T00:00:00Z');

  it('parses ECPay "yyyy/MM/dd HH:mm:ss" format', () => {
    const d = parseEcpayExpireDate('2026/06/13 23:59:59', now);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(13);
  });

  it('parses dash format too', () => {
    const d = parseEcpayExpireDate('2026-06-13 23:59:59', now);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getDate()).toBe(13);
  });

  it('falls back to now + 3 days when missing', () => {
    const d = parseEcpayExpireDate(null, now);
    expect(d.getTime()).toBe(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  });

  it('falls back when unparseable', () => {
    const d = parseEcpayExpireDate('not-a-date', now);
    expect(d.getTime()).toBe(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  });
});
