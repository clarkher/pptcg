import { prisma } from '../prisma';
import { fetchLatestProducts } from './scraper';
import { isArbitrageVsRaw, RAW_PARAMS, buildCardKey } from './logic';
import { getRawPrice } from './huca-raw';

export interface ScanHit {
  listingId: number;
  sellerId: number;
  cardKey: string;
  game: string;
  name: string;
  price: number;
  rawPriceTwd: number;
  rawSamples: number;
  profit: number;
  discount: number;
  condition: string;
}

/**
 * 即時掃描：抓卡拍拍最新商品，對「純裸卡市價」嚴格比價，回當前套利機會。
 * 純讀取 — 不建 alert、不推播。供後台檢視用。
 */
export async function scanArbitrage(): Promise<{ scanned: number; hits: ScanHit[] }> {
  const products = await fetchLatestProducts();
  const jpen = products.filter(
    (p) => (p.game === 'pkmjp' || p.game === 'pkmen') && p.condition === 'perfect'
  );
  const hits: ScanHit[] = [];
  for (const p of jpen) {
    const cardKey = buildCardKey(p.packId, p.packCardId);
    if (!cardKey) continue;
    const num = parseInt(p.packCardId, 10);
    if (Number.isNaN(num)) continue;
    const cards = await prisma.hucaCard.findMany({
      where: { setCode: p.packId },
      select: { id: true, cardNumber: true, nameZh: true },
    });
    const m = cards.find((c) => parseInt(c.cardNumber, 10) === num);
    if (!m) continue;
    const raw = await getRawPrice(m.id);
    if (!raw) continue;
    const price = parseInt(p.price, 10);
    if (
      isArbitrageVsRaw(
        { price, condition: p.condition, game: p.game, rawPriceTwd: raw.rawPriceTwd, rawSampleCount: raw.sampleCount },
        RAW_PARAMS
      )
    ) {
      hits.push({
        listingId: p.id, sellerId: p.sellerId, cardKey, game: p.game,
        name: m.nameZh ?? p.productKey, price,
        rawPriceTwd: raw.rawPriceTwd, rawSamples: raw.sampleCount,
        profit: raw.rawPriceTwd - price, discount: price / raw.rawPriceTwd, condition: p.condition,
      });
    }
  }
  hits.sort((a, b) => b.profit - a.profit);
  return { scanned: jpen.length, hits };
}
