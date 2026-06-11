import { describe, it, expect } from 'vitest';
import { median, buildCardKey, isArbitrage, matchesPreference, DEFAULT_PARAMS } from './logic';

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
