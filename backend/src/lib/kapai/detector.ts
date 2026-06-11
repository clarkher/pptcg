import { prisma } from '../prisma';
import { isDeal, KAPAI_PARAMS } from './logic';
import { fetchPerfectMarket } from './market';
import { getRawPrice } from './huca-raw';

const PKM_GAMES = new Set(['pkmtw', 'pkmjp', 'pkmen']);

/** 找對應 Huca 卡 id：setCode 相同 + cardNumber 數字對齊（去前導零） */
async function findHucaCardId(setCode: string, cardNumber: string): Promise<number | null> {
  const num = parseInt(cardNumber, 10);
  if (Number.isNaN(num)) return null;
  const cards = await prisma.hucaCard.findMany({ where: { setCode }, select: { id: true, cardNumber: true } });
  return cards.find((c) => parseInt(c.cardNumber, 10) === num)?.id ?? null;
}

/**
 * 雙軌套利偵測（只比 perfect 裸卡）：
 * - 日英(pkmjp/pkmen)：基準 = Huca 裸卡「成交」價（Snkrdunk chart key18 近30天中位）
 * - 繁中(pkmtw)：基準 = 卡拍拍站內同卡 perfect 中位（condition=perfect 伺服器過濾，賣家≥5）
 * - 共同：必須比站內現有 perfect 最低價更便宜（不然站上有更便宜的，不算機會）
 * 只建 ArbitrageAlert（notified=false），推播交給 pusher 每30分批次。
 */
export async function detectAndAlert(): Promise<{ detected: number }> {
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let detected = 0;
  for (const l of pending) {
    if (PKM_GAMES.has(l.game) && l.condition === 'perfect') {
      // 站內 perfect 行情（排除這筆自身）—— siteMin 是共同硬條件
      const market = await fetchPerfectMarket(l.game, l.setCode, l.cardNumber, l.id);

      // 行情基準：日英走 Huca 成交、繁中走站內中位
      let baseline: number | null = null;
      if (l.game === 'pkmjp' || l.game === 'pkmen') {
        const hucaId = await findHucaCardId(l.setCode, l.cardNumber);
        if (hucaId) {
          const raw = await getRawPrice(hucaId);
          if (raw) baseline = raw.rawPriceTwd;
        }
      } else if (market && market.count >= KAPAI_PARAMS.minSamples) {
        baseline = market.median;
      }

      if (
        baseline != null &&
        isDeal({ price: l.price, baseline, siteMin: market?.siteMin ?? null }, KAPAI_PARAMS)
      ) {
        const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
        if (!existing) {
          detected++;
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
