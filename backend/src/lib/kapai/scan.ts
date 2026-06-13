import { prisma } from '../prisma';
import { fetchLatestProducts } from './scraper';
import { isDeal, isHucaBaselineReliable, buildCardKey } from './logic';
import { fetchPerfectMarket } from './market';
import { getRawPrice } from './huca-raw';
import { loadConfig } from './config';

export interface ScanHit {
  listingId: number;
  sellerId: number;
  cardKey: string;
  game: string;
  name: string;
  price: number;
  baseline: number;
  baselineSource: string; // 'Huca成交' | '站內中位'
  siteMin: number | null;
  profit: number;
  discount: number;
  condition: string;
}

const PKM_GAMES = new Set(['pkmtw', 'pkmjp', 'pkmen']);

async function findHucaCardId(setCode: string, cardNumber: string): Promise<number | null> {
  const num = parseInt(cardNumber, 10);
  if (Number.isNaN(num)) return null;
  const cards = await prisma.hucaCard.findMany({ where: { setCode }, select: { id: true, cardNumber: true } });
  return cards.find((c) => parseInt(c.cardNumber, 10) === num)?.id ?? null;
}

/**
 * 即時掃描（雙軌規則，與 detector 一致）：
 * 日英=Huca裸卡成交基準、繁中=站內perfect中位基準、共同=必須站內最低。
 * 純讀取 — 不建 alert、不推播。供後台檢視用。
 */
export async function scanArbitrage(): Promise<{ scanned: number; hits: ScanHit[] }> {
  const { params } = await loadConfig();
  const products = await fetchLatestProducts();
  const cands = products.filter((p) => PKM_GAMES.has(p.game) && p.condition === 'perfect');
  const hits: ScanHit[] = [];
  for (const p of cands) {
    const cardKey = buildCardKey(p.packId, p.packCardId);
    if (!cardKey) continue;
    const price = parseInt(p.price, 10);
    if (Number.isNaN(price)) continue;

    const market = await fetchPerfectMarket(p.game, p.packId, p.packCardId, p.id, p.rare);

    let baseline: number | null = null;
    let baselineSource = '';
    if (p.game === 'pkmjp' || p.game === 'pkmen') {
      const hucaId = await findHucaCardId(p.packId, p.packCardId);
      if (hucaId) {
        const raw = await getRawPrice(hucaId);
        // 防呆：Huca 對齊不分稀有度，用站內同 rare 中位佐證
        if (raw && isHucaBaselineReliable(raw.rawPriceTwd, market?.median ?? null, market?.count ?? 0, params.minSamples)) {
          baseline = raw.rawPriceTwd; baselineSource = 'Huca成交';
        }
      }
    } else if (market && market.count >= params.minSamples) {
      baseline = market.median;
      baselineSource = '站內中位';
    }

    if (baseline != null && isDeal({ price, baseline, siteMin: market?.siteMin ?? null }, params)) {
      hits.push({
        listingId: p.id, sellerId: p.sellerId, cardKey, game: p.game,
        name: p.productKey, price,
        baseline, baselineSource, siteMin: market?.siteMin ?? null,
        profit: baseline - price, discount: price / baseline, condition: p.condition,
      });
    }
  }
  hits.sort((a, b) => b.profit - a.profit);
  return { scanned: cands.length, hits };
}
