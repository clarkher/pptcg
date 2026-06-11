import { fetchLatestProducts } from './scraper';
import { isArbitrageVsKapai, KAPAI_PARAMS, buildCardKey } from './logic';
import { fetchKapaiMarket } from './market';

export interface ScanHit {
  listingId: number;
  sellerId: number;
  cardKey: string;
  game: string;
  name: string;
  price: number;
  marketMedian: number;
  sampleCount: number;
  profit: number;
  discount: number;
  condition: string;
}

const PKM_GAMES = new Set(['pkmtw', 'pkmjp', 'pkmen']);

/**
 * 即時掃描：抓卡拍拍最新商品，對「台灣站內行情」嚴格比價，回當前套利機會。
 * 純讀取 — 不建 alert、不推播。供後台檢視用。
 */
export async function scanArbitrage(): Promise<{ scanned: number; hits: ScanHit[] }> {
  const products = await fetchLatestProducts();
  const cands = products.filter((p) => PKM_GAMES.has(p.game) && p.condition === 'perfect');
  const hits: ScanHit[] = [];
  for (const p of cands) {
    const cardKey = buildCardKey(p.packId, p.packCardId);
    if (!cardKey) continue;
    const m = await fetchKapaiMarket(p.game, p.packId, p.packCardId, KAPAI_PARAMS.minSamples);
    if (!m) continue;
    const price = parseInt(p.price, 10);
    if (Number.isNaN(price)) continue;
    if (isArbitrageVsKapai({ price, marketMedian: m.median, sampleCount: m.sampleCount }, KAPAI_PARAMS)) {
      hits.push({
        listingId: p.id, sellerId: p.sellerId, cardKey, game: p.game,
        name: p.productKey, price,
        marketMedian: m.median, sampleCount: m.sampleCount,
        profit: m.median - price, discount: price / m.median, condition: p.condition,
      });
    }
  }
  hits.sort((a, b) => b.profit - a.profit);
  return { scanned: cands.length, hits };
}
