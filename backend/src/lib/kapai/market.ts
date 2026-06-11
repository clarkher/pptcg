// 卡拍拍站內行情：同卡 perfect-only 賣家列表（condition=perfect 伺服器端過濾，排除 rated/flawed/other）
// 官方 getAvgPriceBySku 棄用——實測會混到 rated 評級卡（火伊布官方均1300 vs perfect-only均1191/混合1454）
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const BASE = 'https://trade.kapaipai.tw/api';

// 非標準卡（客製/套牌/原盒等）的 packId 前綴，排除不比價
const NON_CARD = /^(DIY|DECK|SET|BOX|PACK)/i;

export function isStandardCard(packId: string, packCardId: string): boolean {
  if (!packId || !packCardId) return false;
  if (NON_CARD.test(packId)) return false;
  if (Number.isNaN(parseInt(packCardId, 10))) return false;
  return true;
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export interface PerfectMarket {
  median: number;   // 同卡 perfect 賣價中位數
  siteMin: number;  // 站內現有 perfect 最低價（排除被評估的那筆本身）
  count: number;    // perfect 賣家筆數（排除自身）
}

/**
 * 查某卡「站內 perfect 裸卡」行情（condition=perfect 伺服器過濾，純裸卡不混 PSA）。
 * excludeId：被評估的商品自身 id（避免它出現在列表裡影響 siteMin）。
 * 回 null 表非標準卡或站內沒有其他 perfect 在售。
 */
export async function fetchPerfectMarket(
  game: string,
  packId: string,
  packCardId: string,
  excludeId?: number
): Promise<PerfectMarket | null> {
  if (!isStandardCard(packId, packCardId)) return null;
  const url =
    `${BASE}/product/listProduct?game=${encodeURIComponent(game)}` +
    `&packId=${encodeURIComponent(packId)}&packCardId=${encodeURIComponent(packCardId)}` +
    `&condition=perfect&page=1&pageSize=50`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const json: any = await res.json();
  const products: any[] = json?.data?.products ?? [];
  const prices = products
    .filter((p) => p?.condition === 'perfect' && p?.id !== excludeId) // 雙保險再過濾一次
    .map((p) => parseInt(p?.price, 10))
    .filter((p) => !Number.isNaN(p) && p > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  return { median: median(prices), siteMin: prices[0], count: prices.length };
}
