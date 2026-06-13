import { describe, it, expect } from 'vitest';
import { inPushWindow } from './pusher';
import { DEFAULT_CONFIG } from './config';

const DEF = DEFAULT_CONFIG.push; // 不推時段 04–08

// 建構一個「台灣為 hour 點」的 UTC Date（台灣 = UTC+8）
function twTime(hour: number): Date {
  const utcHour = (hour - 8 + 24) % 24;
  return new Date(Date.UTC(2026, 5, 11, utcHour, 0, 0));
}

describe('inPushWindow（依 config 不推時段，預設凌晨 04:00-08:00 不推）', () => {
  it('台灣 08:00 → true（8點起恢復推）', () => expect(inPushWindow(twTime(8), DEF)).toBe(true));
  it('台灣 14:00 → true', () => expect(inPushWindow(twTime(14), DEF)).toBe(true));
  it('台灣 23:00 → true（晚上也推）', () => expect(inPushWindow(twTime(23), DEF)).toBe(true));
  it('台灣 02:00 → true（凌晨2點仍推）', () => expect(inPushWindow(twTime(2), DEF)).toBe(true));
  it('台灣 04:00 → false（4點不推）', () => expect(inPushWindow(twTime(4), DEF)).toBe(false));
  it('台灣 07:00 → false（7點不推）', () => expect(inPushWindow(twTime(7), DEF)).toBe(false));

  it('自訂不推時段 03:00–09:00 生效', () => {
    const custom = { noPushStartHour: 3, noPushEndHour: 9, lineBatchTopN: 5 };
    expect(inPushWindow(twTime(3), custom)).toBe(false); // 3點不推
    expect(inPushWindow(twTime(8), custom)).toBe(false); // 8點還在不推區間
    expect(inPushWindow(twTime(9), custom)).toBe(true);  // 9點恢復
    expect(inPushWindow(twTime(2), custom)).toBe(true);  // 2點仍推
  });
});
