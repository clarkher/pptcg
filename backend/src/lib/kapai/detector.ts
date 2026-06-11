import { prisma } from '../prisma';
import { isArbitrageVsKapai, KAPAI_PARAMS } from './logic';
import { fetchKapaiMarket } from './market';

const PKM_GAMES = new Set(['pkmtw', 'pkmjp', 'pkmen']);

/**
 * 對「卡拍拍站內台灣行情」嚴格比價（繁中/日/英寶可夢卡）：
 * 只比 perfect 裸卡、同卡 perfect 賣家≥5、行情≥300、明顯低於台灣行情中位。
 * 只建 ArbitrageAlert（notified=false）記錄，**不即時推**——推播交給 pusher 每30分批次處理。
 */
export async function detectAndAlert(): Promise<{ detected: number }> {
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let detected = 0;
  for (const l of pending) {
    if (PKM_GAMES.has(l.game) && l.condition === 'perfect') {
      const m = await fetchKapaiMarket(l.game, l.name, l.setCode, l.cardNumber, l.rarity);
      if (m && isArbitrageVsKapai({ price: l.price, avgPrice: m.avgPrice }, KAPAI_PARAMS)) {
        const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
        if (!existing) {
          detected++;
          const baseline = m.avgPrice;
          await prisma.arbitrageAlert.create({
            data: {
              listingId: l.id, cardKey: l.cardKey, game: l.game,
              price: l.price, baseline,
              discount: l.price / baseline, profit: baseline - l.price,
              notified: false,
            },
          });
        }
      }
    }
    await prisma.kapaiListing.update({ where: { id: l.id }, data: { processed: true } });
  }
  return { detected };
}
