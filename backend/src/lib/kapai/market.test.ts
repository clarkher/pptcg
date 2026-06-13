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

  it('帶 rare 時只比同稀有度（不混一般版本/球閃，修皮卡丘假訊號）', async () => {
    // SV2a-025 皮卡丘：一般版本 $45/$60 + 球閃 $800/$1000 混在同番號
    mockProducts([
      { id: 1, condition: 'perfect', price: '45', rare: '一般版本' },
      { id: 2, condition: 'perfect', price: '60', rare: '一般版本' },
      { id: 3, condition: 'perfect', price: '800', rare: '球閃' },
      { id: 4, condition: 'perfect', price: '1000', rare: '球閃' },
    ]);
    // 評估 $45 一般版本（排除自身）只能跟「一般版本」比，不能混球閃
    const m = await fetchPerfectMarket('pkmjp', 'SV2a', '025', 1, '一般版本');
    expect(m!.count).toBe(1);     // 只剩 $60 一般版本
    expect(m!.siteMin).toBe(60);
    expect(m!.median).toBe(60);   // 不會被球閃 $800/$1000 拉高
  });

  it('不帶 rare 時算全部（向後相容）', async () => {
    mockProducts([
      { id: 1, condition: 'perfect', price: '45', rare: '一般版本' },
      { id: 2, condition: 'perfect', price: '800', rare: '球閃' },
    ]);
    const m = await fetchPerfectMarket('pkmjp', 'SV2a', '025', 99);
    expect(m!.count).toBe(2);
  });
});
