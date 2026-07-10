// 卡拍拍站內行情：同卡 perfect-only 賣家列表（condition=perfect 伺服器端過濾，排除 rated/flawed/other）
// 官方 getAvgPriceBySku 棄用——實測會混到 rated 評級卡（火伊布官方均1300 vs perfect-only均1191/混合1454）
import { kapaiBase, kapaiHeaders } from './kapai-http';

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

export interface PerfectListing {
  id: number;
  price: number;
  rare: string;
  game: string;
  condition: string;
  sellerId: number;
  sellerNickname: string;
  sellerArea: string;
  productKey: string;
  packName: string;
  packId: string;
  packCardId: string;
  stock: number;
  createdTime: string;
  description: string;
}

/** 純解析 listProduct 回應 → perfect 完整 listing 陣列（濾非 perfect / 壞價）。 */
export function parsePerfectProducts(json: any): PerfectListing[] {
  const products: any[] = json?.data?.products ?? [];
  return products
    .filter((p) => p?.condition === 'perfect')
    .map((p) => ({
      id: p?.id,
      price: parseInt(p?.price, 10),
      rare: p?.rare ?? '',
      game: p?.game ?? '',
      condition: p?.condition ?? '',
      sellerId: p?.sellerId ?? 0,
      sellerNickname: p?.sellerNickname ?? '',
      sellerArea: p?.sellerArea ?? '',
      productKey: p?.productKey ?? '',
      packName: p?.packName ?? '',
      packId: p?.packId ?? '',
      packCardId: p?.packCardId ?? '',
      stock: p?.stock ?? 0,
      createdTime: p?.createdTime ?? '',
      description: p?.description ?? '',
    }))
    .filter((l) => typeof l.id === 'number' && !Number.isNaN(l.price) && l.price > 0);
}

export interface PerfectMarket {
  median: number;   // 同卡 perfect 賣價中位數
  siteMin: number;  // 站內現有 perfect 最低價（排除被評估的那筆本身）
  count: number;    // perfect 賣家筆數（排除自身）
}

// ── 同卡 perfect 列表 30 分快取（全量重偵測時同卡多 listing/跨輪共用一次 API）──
const cache = new Map<string, { value: PerfectListing[]; at: number }>();
const TTL_MS = 30 * 60 * 1000;

export function clearMarketCache(): void { cache.clear(); }

/**
 * 抓某卡「站內 perfect 裸卡」在售列表（id+price），非標準卡回 null。
 * 不含 excludeId 邏輯 → 可安全快取（同卡 30 分內共用）。
 */
export async function fetchPerfectListings(
  game: string,
  packId: string,
  packCardId: string
): Promise<PerfectListing[] | null> {
  if (!isStandardCard(packId, packCardId)) return null;
  const key = `${game}:${packId}:${packCardId}`;
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL_MS) return c.value;

  const url =
    `${kapaiBase()}/product/listProduct?game=${encodeURIComponent(game)}` +
    `&packId=${encodeURIComponent(packId)}&packCardId=${encodeURIComponent(packCardId)}` +
    `&condition=perfect&page=1&pageSize=50`;
  const res = await fetch(url, { headers: kapaiHeaders() });
  if (!res.ok) return null; // 失敗不快取，下輪重試
  const value = parsePerfectProducts(await res.json());
  cache.set(key, { value, at: Date.now() });
  return value;
}

/**
 * 查某卡 perfect 行情，排除被評估的那筆自身（excludeId）算 median/siteMin/count。
 * rare：只比同稀有度（同番號常混「一般版本」與「球閃」大師球版，價差數十倍，混算會誤判套利）。
 * 底層走 fetchPerfectListings 快取。回 null 表非標準卡或站內沒有其他同稀有度 perfect 在售。
 */
export async function fetchPerfectMarket(
  game: string,
  packId: string,
  packCardId: string,
  excludeId?: number,
  rare?: string
): Promise<PerfectMarket | null> {
  const listings = await fetchPerfectListings(game, packId, packCardId);
  if (!listings) return null;
  const prices = listings
    .filter((l) => l.id !== excludeId)
    .filter((l) => rare == null || l.rare === rare) // 只比同稀有度
    .map((l) => l.price)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  return { median: median(prices), siteMin: prices[0], count: prices.length };
}

/**
 * 抓某卡「站內 perfect」在售完整快照（不吃快取）。供 surge 軌即時取最低掛單與賣家資訊。
 * 非標準卡回 null、API 失敗回 null。
 */
export async function fetchPerfectSnapshot(
  game: string,
  packId: string,
  packCardId: string
): Promise<PerfectListing[] | null> {
  if (!isStandardCard(packId, packCardId)) return null;
  const url =
    `${kapaiBase()}/product/listProduct?game=${encodeURIComponent(game)}` +
    `&packId=${encodeURIComponent(packId)}&packCardId=${encodeURIComponent(packCardId)}` +
    `&condition=perfect&page=1&pageSize=50`;
  const res = await fetch(url, { headers: kapaiHeaders() });
  if (!res.ok) return null;
  return parsePerfectProducts(await res.json());
}
