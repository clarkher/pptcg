// 卡拍拍站內「台灣行情」：查某張卡所有賣家，算 perfect 裸卡中位數
// 取代 Huca/Snkrdunk（日本價）——同平台、同市場、同品相，最對齊
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const BASE = 'https://trade.kapaipai.tw/api';

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// 非標準卡（客製/套牌/原盒等）的 packId 前綴，排除不比價
const NON_CARD = /^(DIY|DECK|SET|BOX|PACK)/i;

export function isStandardCard(packId: string, packCardId: string): boolean {
  if (!packId || !packCardId) return false;
  if (NON_CARD.test(packId)) return false;
  if (Number.isNaN(parseInt(packCardId, 10))) return false; // 卡號要是數字
  return true;
}

export interface KapaiMarket {
  median: number;      // 台灣同卡 perfect 中位數
  min: number;         // 最低價
  sampleCount: number; // perfect 賣家數
}

/**
 * 查某張卡的台灣站內行情（同卡所有賣家的 perfect 裸卡中位數）。
 * 回 null 表樣本不足（< minSamples）或非標準卡。
 */
export async function fetchKapaiMarket(
  game: string,
  packId: string,
  packCardId: string,
  minSamples = 5
): Promise<KapaiMarket | null> {
  if (!isStandardCard(packId, packCardId)) return null;
  const url = `${BASE}/product/listProduct?game=${encodeURIComponent(game)}&packId=${encodeURIComponent(packId)}&packCardId=${encodeURIComponent(packCardId)}&page=1&pageSize=50`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const json: any = await res.json();
  const products: any[] = json?.data?.products ?? [];
  const prices = products
    .filter((p) => p?.condition === 'perfect')
    .map((p) => parseInt(p?.price, 10))
    .filter((p) => !Number.isNaN(p) && p > 0)
    .sort((a, b) => a - b);
  if (prices.length < minSamples) return null;
  return { median: median(prices), min: prices[0], sampleCount: prices.length };
}
