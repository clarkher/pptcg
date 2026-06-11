import { prisma } from '../prisma';
import { isArbitrageVsHuca, HUCA_STRICT_PARAMS } from './logic';
import { pushArbitrage } from './notifier';

// 全域推播限速：一分鐘最多推一筆（用 Setting 持久化上次推播時間）
const PUSH_INTERVAL_MS = 60_000;
const LAST_PUSH_KEY = 'KAPAI_LAST_PUSH_AT';

async function canPushNow(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: LAST_PUSH_KEY } });
  if (!s?.value) return true;
  return Date.now() - parseInt(s.value, 10) >= PUSH_INTERVAL_MS;
}

async function markPushed(): Promise<void> {
  const now = String(Date.now());
  await prisma.setting.upsert({
    where: { key: LAST_PUSH_KEY },
    update: { value: now },
    create: { key: LAST_PUSH_KEY, value: now },
  });
}

/** 找對應的 Huca 卡：setCode 相同 + cardNumber 數字對齊（去前導零） */
async function findHucaCard(setCode: string, cardNumber: string) {
  const num = parseInt(cardNumber, 10);
  if (Number.isNaN(num)) return null;
  const cards = await prisma.hucaCard.findMany({
    where: { setCode },
    select: { cardNumber: true, nameZh: true, lowPriceTwd: true, highPriceTwd: true, offerCount: true },
  });
  return cards.find((c) => parseInt(c.cardNumber, 10) === num) ?? null;
}

/**
 * 日英卡（pkmjp/pkmen）對 Huca 行情嚴格比價：
 * 只比 perfect 裸卡、Huca 成交數≥10、行情穩定、明顯低於市價。
 * 建 ArbitrageAlert（記錄所有命中），推播限速一分鐘一筆。
 */
export async function detectAndAlert(): Promise<{ detected: number; pushed: number }> {
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let detected = 0, pushed = 0;
  for (const l of pending) {
    if ((l.game === 'pkmjp' || l.game === 'pkmen') && l.condition === 'perfect') {
      const m = await findHucaCard(l.setCode, l.cardNumber);
      if (
        m &&
        isArbitrageVsHuca(
          { price: l.price, condition: l.condition, game: l.game, hucaLow: m.lowPriceTwd, hucaHigh: m.highPriceTwd, offerCount: m.offerCount },
          HUCA_STRICT_PARAMS
        )
      ) {
        const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
        if (!existing) {
          detected++;
          const baseline = m.lowPriceTwd!;
          let notified = false;
          if (await canPushNow()) {
            await pushArbitrage(l, baseline);
            await markPushed();
            notified = true;
            pushed++;
          }
          await prisma.arbitrageAlert.create({
            data: {
              listingId: l.id, cardKey: l.cardKey, game: l.game,
              price: l.price, baseline,
              discount: l.price / baseline, profit: baseline - l.price,
              notified,
            },
          });
        }
      }
    }
    await prisma.kapaiListing.update({ where: { id: l.id }, data: { processed: true } });
  }
  return { detected, pushed };
}
