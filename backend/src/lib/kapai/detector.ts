import { prisma } from '../prisma';
import { isArbitrage, DEFAULT_PARAMS } from './logic';
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

/**
 * 對未處理商品判斷套利，建 alert（記錄所有命中＝量），推播限速一分鐘一筆。
 * 回傳 detected（偵測到幾筆）與 pushed（實際推播幾筆）。
 */
export async function detectAndAlert(): Promise<{ detected: number; pushed: number }> {
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let detected = 0, pushed = 0;
  for (const l of pending) {
    const baseline = await prisma.kapaiBaseline.findUnique({
      where: { cardKey_condition: { cardKey: l.cardKey, condition: l.condition } },
    });
    if (
      baseline &&
      isArbitrage({ price: l.price, baseline: baseline.median, sampleSize: baseline.sampleSize }, DEFAULT_PARAMS)
    ) {
      const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
      if (!existing) {
        detected++;
        let notified = false;
        if (await canPushNow()) {
          await pushArbitrage(l, baseline.median);
          await markPushed();
          notified = true;
          pushed++;
        }
        await prisma.arbitrageAlert.create({
          data: {
            listingId: l.id, cardKey: l.cardKey, game: l.game,
            price: l.price, baseline: baseline.median,
            discount: l.price / baseline.median, profit: baseline.median - l.price,
            notified,
          },
        });
      }
    }
    await prisma.kapaiListing.update({ where: { id: l.id }, data: { processed: true } });
  }
  return { detected, pushed };
}
