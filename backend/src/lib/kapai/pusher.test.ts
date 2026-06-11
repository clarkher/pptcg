import { describe, it, expect } from 'vitest';
import { inPushWindow } from './pusher';

// 建構一個「台灣為 hour 點」的 UTC Date（台灣 = UTC+8）
function twTime(hour: number): Date {
  const utcHour = (hour - 8 + 24) % 24;
  return new Date(Date.UTC(2026, 5, 11, utcHour, 0, 0));
}

describe('inPushWindow（只有凌晨 04:00-08:00 不推）', () => {
  it('台灣 08:00 → true（8點起恢復推）', () => expect(inPushWindow(twTime(8))).toBe(true));
  it('台灣 14:00 → true', () => expect(inPushWindow(twTime(14))).toBe(true));
  it('台灣 23:00 → true（晚上也推）', () => expect(inPushWindow(twTime(23))).toBe(true));
  it('台灣 02:00 → true（凌晨2點仍推）', () => expect(inPushWindow(twTime(2))).toBe(true));
  it('台灣 04:00 → false（4點不推）', () => expect(inPushWindow(twTime(4))).toBe(false));
  it('台灣 07:00 → false（7點不推）', () => expect(inPushWindow(twTime(7))).toBe(false));
});
