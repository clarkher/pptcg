// 卡拍拍站內「台灣行情」：用官方 getAvgPriceBySku（站內均價），比自算掛單中位數準
// sku 格式（破解自前端 getSkuProduct）= game:productKey:packId:packCardId:rare
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

export interface KapaiMarket {
  avgPrice: number; // 卡拍拍站內官方均價
  lowPrice: number; // 站內最低
}

/**
 * 查某張卡的台灣站內官方均價（getAvgPriceBySku）。
 * 回 null 表非標準卡或無均價資料。
 */
export async function fetchKapaiMarket(
  game: string,
  productKey: string,
  packId: string,
  packCardId: string,
  rare: string
): Promise<KapaiMarket | null> {
  if (!isStandardCard(packId, packCardId)) return null;
  const sku = `${game}:${productKey}:${packId}:${packCardId}:${rare}`;
  const res = await fetch(`${BASE}/card/getAvgPriceBySku?sku=${encodeURIComponent(sku)}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const json: any = await res.json();
  const avg = json?.data?.avgPrice;
  const low = json?.data?.lowPrice;
  if (typeof avg !== 'number' || avg <= 0) return null;
  return { avgPrice: avg, lowPrice: typeof low === 'number' ? low : avg };
}
