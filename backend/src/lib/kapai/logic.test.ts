import { describe, it, expect } from 'vitest';
import { median, buildCardKey, isArbitrage, matchesPreference, isArbitrageVsHuca, isArbitrageVsRaw, isArbitrageVsKapai, HUCA_STRICT_PARAMS, RAW_PARAMS, KAPAI_PARAMS, DEFAULT_PARAMS } from './logic';

describe('median', () => {
  it('空陣列回 0', () => expect(median([])).toBe(0));
  it('單筆', () => expect(median([50])).toBe(50));
  it('奇數筆取中間', () => expect(median([10, 30, 20])).toBe(20));
  it('偶數筆取中間兩數平均（四捨五入）', () => expect(median([10, 20, 30, 50])).toBe(25));
});

describe('buildCardKey', () => {
  it('正常組合', () => expect(buildCardKey('M5', '065')).toBe('M5-065'));
  it('空 packId 回 null', () => expect(buildCardKey('', '065')).toBeNull());
  it('空 packCardId 回 null', () => expect(buildCardKey('M5', '')).toBeNull());
  it('去除前後空白', () => expect(buildCardKey(' M5 ', ' 065 ')).toBe('M5-065'));
});

describe('isArbitrage', () => {
  const p = DEFAULT_PARAMS;
  it('樣本不足回 false', () => expect(isArbitrage({ price: 10, baseline: 1000, sampleSize: 4 }, p)).toBe(false));
  it('baseline 0 回 false', () => expect(isArbitrage({ price: 10, baseline: 0, sampleSize: 9 }, p)).toBe(false));
  it('價格高於門檻回 false', () => expect(isArbitrage({ price: 800, baseline: 1000, sampleSize: 9 }, p)).toBe(false));
  it('價差不足回 false', () => expect(isArbitrage({ price: 650, baseline: 700, sampleSize: 9 }, p)).toBe(false));
  it('命中回 true', () => expect(isArbitrage({ price: 500, baseline: 1000, sampleSize: 9 }, p)).toBe(true));
});

describe('matchesPreference', () => {
  const base = { game: 'pkmtw', price: 500, baseline: 1000 };
  const allOpen = { games: [] as string[], minSavingPct: null, minPrice: null, maxPrice: null, enabled: true };
  it('總開關關閉回 false', () => expect(matchesPreference(base, { ...allOpen, enabled: false })).toBe(false));
  it('不限任何條件回 true', () => expect(matchesPreference(base, allOpen)).toBe(true));
  it('games 不含該卡種回 false', () => expect(matchesPreference(base, { ...allOpen, games: ['pkmjp'] })).toBe(false));
  it('games 含該卡種回 true', () => expect(matchesPreference(base, { ...allOpen, games: ['pkmtw', 'pkmjp'] })).toBe(true));
  it('售價低於 minPrice 回 false', () => expect(matchesPreference(base, { ...allOpen, minPrice: 600 })).toBe(false));
  it('售價高於 maxPrice 回 false', () => expect(matchesPreference(base, { ...allOpen, maxPrice: 400 })).toBe(false));
  it('省下比例不足 minSavingPct 回 false', () => expect(matchesPreference(base, { ...allOpen, minSavingPct: 0.6 })).toBe(false));
  it('省下比例達標回 true', () => expect(matchesPreference(base, { ...allOpen, minSavingPct: 0.4 })).toBe(true));
});

describe('isArbitrageVsHuca（日英卡嚴格比價）', () => {
  const p = HUCA_STRICT_PARAMS; // 0.7 / 100 / offer10 / spread3
  const ok = { price: 500, condition: 'perfect', game: 'pkmjp', hucaLow: 1000, hucaHigh: 1200, offerCount: 30 };
  it('命中回 true', () => expect(isArbitrageVsHuca(ok, p)).toBe(true));
  it('繁中卡(pkmtw)回 false', () => expect(isArbitrageVsHuca({ ...ok, game: 'pkmtw' }, p)).toBe(false));
  it('非 perfect(rated)回 false', () => expect(isArbitrageVsHuca({ ...ok, condition: 'rated' }, p)).toBe(false));
  it('成交數不足回 false', () => expect(isArbitrageVsHuca({ ...ok, offerCount: 2 }, p)).toBe(false));
  it('Huca 無低價回 false', () => expect(isArbitrageVsHuca({ ...ok, hucaLow: null }, p)).toBe(false));
  it('行情不穩(high/low 過大)回 false', () => expect(isArbitrageVsHuca({ ...ok, hucaHigh: 5000 }, p)).toBe(false));
  it('售價高於門檻回 false', () => expect(isArbitrageVsHuca({ ...ok, price: 800 }, p)).toBe(false));
  it('價差不足回 false', () => expect(isArbitrageVsHuca({ ...ok, price: 950, hucaLow: 1000, hucaHigh: 1000 }, p)).toBe(false));
});

describe('isArbitrageVsRaw（對純裸卡市價比價）', () => {
  const p = RAW_PARAMS; // 0.7 / 100 / 裸卡樣本3
  const ok = { price: 500, condition: 'perfect', game: 'pkmjp', rawPriceTwd: 1000, rawSampleCount: 6 };
  it('命中回 true', () => expect(isArbitrageVsRaw(ok, p)).toBe(true));
  it('繁中卡回 false', () => expect(isArbitrageVsRaw({ ...ok, game: 'pkmtw' }, p)).toBe(false));
  it('非 perfect 回 false', () => expect(isArbitrageVsRaw({ ...ok, condition: 'rated' }, p)).toBe(false));
  it('裸卡樣本不足回 false', () => expect(isArbitrageVsRaw({ ...ok, rawSampleCount: 2 }, p)).toBe(false));
  it('無裸卡價回 false', () => expect(isArbitrageVsRaw({ ...ok, rawPriceTwd: null }, p)).toBe(false));
  it('售價高於門檻回 false', () => expect(isArbitrageVsRaw({ ...ok, price: 800 }, p)).toBe(false));
  it('價差不足回 false', () => expect(isArbitrageVsRaw({ ...ok, price: 950, rawPriceTwd: 1000 }, p)).toBe(false));
});

describe('isArbitrageVsKapai（對卡拍拍台灣站內行情）', () => {
  const p = KAPAI_PARAMS; // 0.7 / 100 / 賣家5 / 行情下限300
  const ok = { price: 500, marketMedian: 1000, sampleCount: 8 };
  it('命中回 true', () => expect(isArbitrageVsKapai(ok, p)).toBe(true));
  it('賣家數不足回 false', () => expect(isArbitrageVsKapai({ ...ok, sampleCount: 4 }, p)).toBe(false));
  it('行情低於下限(聖灰$10/DIY)回 false', () => expect(isArbitrageVsKapai({ price: 10, marketMedian: 134, sampleCount: 50 }, p)).toBe(false));
  it('售價高於門檻回 false', () => expect(isArbitrageVsKapai({ ...ok, price: 800 }, p)).toBe(false));
  it('價差不足回 false', () => expect(isArbitrageVsKapai({ price: 950, marketMedian: 1000, sampleCount: 8 }, p)).toBe(false));
});
