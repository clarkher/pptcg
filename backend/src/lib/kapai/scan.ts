import { prisma } from '../prisma';
import { fetchLatestProducts } from './scraper';
import { isArbitrageVsHuca, HUCA_STRICT_PARAMS, buildCardKey } from './logic';

export interface ScanHit {
  listingId: number;
  cardKey: string;
  name: string;
  price: number;
  hucaLow: number;
  offerCount: number;
  profit: number;
  discount: number;
  condition: string;
}

/**
 * 即時掃描：抓卡拍拍最新商品，對 Huca 嚴格比價，回傳當前套利機會。
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
      select: { cardNumber: true, nameZh: true, lowPriceTwd: true, highPriceTwd: true, offerCount: true },
    });
    const m = cards.find((c) => parseInt(c.cardNumber, 10) === num);
    if (!m) continue;
    const price = parseInt(p.price, 10);
    if (
      isArbitrageVsHuca(
        { price, condition: p.condition, game: p.game, hucaLow: m.lowPriceTwd, hucaHigh: m.highPriceTwd, offerCount: m.offerCount },
        HUCA_STRICT_PARAMS
      )
    ) {
      const low = m.lowPriceTwd!;
      hits.push({
        listingId: p.id, cardKey, name: m.nameZh ?? p.productKey, price,
        hucaLow: low, offerCount: m.offerCount ?? 0,
        profit: low - price, discount: price / low, condition: p.condition,
      });
    }
  }
  hits.sort((a, b) => b.profit - a.profit);
  return { scanned: jpen.length, hits };
}
