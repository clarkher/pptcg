import { describe, it, expect } from 'vitest';
import { pickScrapeWindow, parseConfig, getTaiwanHour, DEFAULT_CONFIG } from './config';

describe('getTaiwanHour', () => {
  it('把 UTC 時間 +8 換成台灣小時', () => {
    expect(getTaiwanHour(new Date('2026-06-13T00:00:00Z'))).toBe(8);
    expect(getTaiwanHour(new Date('2026-06-13T12:00:00Z'))).toBe(20);
  });

  it('跨日繞回 0–23', () => {
    expect(getTaiwanHour(new Date('2026-06-13T18:00:00Z'))).toBe(2); // 次日 02:00
  });
});

describe('pickScrapeWindow', () => {
  const windows = [
    { startHour: 0, pkmtw: 1500, pkmjp: 1500, pkmen: 350 },
    { startHour: 18, pkmtw: 3000, pkmjp: 2500, pkmen: 500 },
  ];

  it('落在後段區間', () => {
    expect(pickScrapeWindow(windows, 20).pkmtw).toBe(3000);
  });

  it('落在前段區間', () => {
    expect(pickScrapeWindow(windows, 10).pkmtw).toBe(1500);
  });

  it('剛好等於起始時用該區間', () => {
    expect(pickScrapeWindow(windows, 18).pkmtw).toBe(3000);
  });

  it('未排序輸入也能正確挑選', () => {
    const unsorted = [windows[1], windows[0]];
    expect(pickScrapeWindow(unsorted, 20).pkmtw).toBe(3000);
    expect(pickScrapeWindow(unsorted, 10).pkmtw).toBe(1500);
  });

  it('沒有 0 點起始的清單，凌晨繞回最後一個區間（跨午夜）', () => {
    const noMidnight = [
      { startHour: 8, pkmtw: 1500, pkmjp: 1500, pkmen: 350 },
      { startHour: 20, pkmtw: 3000, pkmjp: 2500, pkmen: 500 },
    ];
    expect(pickScrapeWindow(noMidnight, 2).pkmtw).toBe(3000); // 02:00 屬於 20:00→次日08:00
  });

  it('空清單回退到預設區間', () => {
    expect(pickScrapeWindow([], 10).pkmtw).toBe(DEFAULT_CONFIG.scrapeWindows[0].pkmtw);
  });
});

describe('parseConfig', () => {
  it('null 回完整預設', () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  it('壞掉的 JSON 回預設', () => {
    expect(parseConfig('{not json')).toEqual(DEFAULT_CONFIG);
  });

  it('缺漏的欄位補預設', () => {
    const cfg = parseConfig(JSON.stringify({ params: { discountThreshold: 0.6 } }));
    expect(cfg.params.discountThreshold).toBe(0.6);          // 保留有給的
    expect(cfg.params.minProfit).toBe(DEFAULT_CONFIG.params.minProfit); // 補預設
    expect(cfg.scrapeWindows).toEqual(DEFAULT_CONFIG.scrapeWindows);    // 整段缺→預設
    expect(cfg.push).toEqual(DEFAULT_CONFIG.push);
  });

  it('完整自訂值原樣保留', () => {
    const custom = {
      scrapeWindows: [{ startHour: 0, pkmtw: 2000, pkmjp: 2000, pkmen: 400 }],
      params: { discountThreshold: 0.75, minProfit: 150, minMarketValue: 500, minSamples: 8 },
      push: { noPushStartHour: 3, noPushEndHour: 9, lineBatchTopN: 10 },
    };
    expect(parseConfig(JSON.stringify(custom))).toEqual(custom);
  });
});
