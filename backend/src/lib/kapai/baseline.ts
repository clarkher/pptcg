import { prisma } from '../prisma';
import { median } from './logic';

const WINDOW_DAYS = 14;

/** 重算單一 (cardKey, condition) 的基準價，寫入 KapaiBaseline */
export async function recomputeBaseline(cardKey: string, condition: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.kapaiListing.findMany({
    where: { cardKey, condition, scrapedAt: { gte: since } },
    select: { price: true, game: true },
  });
  if (rows.length === 0) return;
  const m = median(rows.map((r) => r.price));
  await prisma.kapaiBaseline.upsert({
    where: { cardKey_condition: { cardKey, condition } },
    update: { median: m, sampleSize: rows.length, game: rows[0].game },
    create: { cardKey, condition, game: rows[0].game, median: m, sampleSize: rows.length },
  });
}

/** 重算所有「目前有未處理商品」涉及的卡的基準 */
export async function recomputePendingBaselines(): Promise<number> {
  const pairs = await prisma.kapaiListing.findMany({
    where: { processed: false },
    select: { cardKey: true, condition: true },
    distinct: ['cardKey', 'condition'],
  });
  for (const { cardKey, condition } of pairs) {
    await recomputeBaseline(cardKey, condition);
  }
  return pairs.length;
}
