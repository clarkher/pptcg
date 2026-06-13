import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPerfectListings, fetchPerfectMarket, clearMarketCache } from './market';

beforeEach(() => clearMarketCache());

function mockProducts(products: any[]) {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { products } }) });
  vi.stubGlobal('fetch', f);
  return f;
}

describe('fetchPerfectListings 快取', () => {
  it('同卡第二次走快取、不重打 API', async () => {
    const f = mockProducts([
      { id: 1, condition: 'perfect', price: '500' },
      { id: 2, condition: 'perfect', price: '600' },
    ]);
    const a = await fetchPerfectListings('pkmtw', 'M4', '114');
    const b = await fetchPerfectListings('pkmtw', 'M4', '114');
    expect(f).toHaveBeenCalledTimes(1); // 第二次命中快取
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
  });

  it('不同卡各打一次 API', async () => {
    const f = mockProducts([]);
    await fetchPerfectListings('pkmtw', 'M4', '114');
    await fetchPerfectListings('pkmtw', 'M4', '115');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('非標準卡直接回 null、不打 API', async () => {
    const f = mockProducts([]);
    expect(await fetchPerfectListings('pkmtw', 'DECK-冰岩怪', 'x')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('fetchPerfectMarket 用快取列表算行情', () => {
  it('排除自身那筆後算 median/siteMin/count', async () => {
    mockProducts([
      { id: 1, condition: 'perfect', price: '500' },
      { id: 2, condition: 'perfect', price: '700' },
      { id: 3, condition: 'perfect', price: '900' },
    ]);
    const m = await fetchPerfectMarket('pkmtw', 'M4', '114', 1); // 排除 id=1($500)
    expect(m).not.toBeNull();
    expect(m!.count).toBe(2);        // 剩 700/900
    expect(m!.siteMin).toBe(700);    // 排除自身後最低
    expect(m!.median).toBe(800);     // (700+900)/2
  });

  it('同卡多次比價共用一次 API（快取）', async () => {
    const f = mockProducts([
      { id: 1, condition: 'perfect', price: '500' },
      { id: 2, condition: 'perfect', price: '700' },
    ]);
    await fetchPerfectMarket('pkmtw', 'M4', '114', 1);
    await fetchPerfectMarket('pkmtw', 'M4', '114', 2);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
