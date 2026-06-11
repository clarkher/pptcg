import { describe, it, expect } from 'vitest';
import { inPushWindow } from './pusher';

// 建構一個「台灣為 hour 點」的 UTC Date（台灣 = UTC+8）
function twTime(hour: number): Date {
  const utcHour = (hour - 8 + 24) % 24;
  return new Date(Date.UTC(2026, 5, 11, utcHour, 0, 0));
}

describe('inPushWindow（台灣 09:00-23:00 才推）', () => {
  it('台灣 09:00 → true', () => expect(inPushWindow(twTime(9))).toBe(true));
  it('台灣 14:00 → true', () => expect(inPushWindow(twTime(14))).toBe(true));
  it('台灣 22:00 → true', () => expect(inPushWindow(twTime(22))).toBe(true));
  it('台灣 23:00 → false（晚上11點後不推）', () => expect(inPushWindow(twTime(23))).toBe(false));
  it('台灣 08:00 → false（早上9點前不推）', () => expect(inPushWindow(twTime(8))).toBe(false));
  it('台灣 03:00 → false（半夜不推）', () => expect(inPushWindow(twTime(3))).toBe(false));
});
