import { prisma } from '../prisma';
import { isArbitrageVsKapai, KAPAI_PARAMS } from './logic';
import { fetchKapaiMarket } from './market';
import { pushArbitrage } from './notifier';

// 全域推播限速：一分鐘最多推一筆（用 Setting 持久化上次推播時間）
const PUSH_INTERVAL_MS = 60_000;
const LAST_PUSH_KEY = 'KAPAI_LAST_PUSH_AT';
const PKM_GAMES = new Set(['pkmtw', 'pkmjp', 'pkmen']);

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
 * 對「卡拍拍站內台灣行情」嚴格比價（繁中/日/英寶可夢卡）：
 * 只比 perfect 裸卡、同卡 perfect 賣家≥5、行情≥300、明顯低於台灣行情中位。
 * 建 ArbitrageAlert（記錄命中），推播限速一分鐘一筆。
 */
export async function detectAndAlert(): Promise<{ detected: number; pushed: number }> {
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let detected = 0, pushed = 0;
  for (const l of pending) {
    if (PKM_GAMES.has(l.game) && l.condition === 'perfect') {
      const m = await fetchKapaiMarket(l.game, l.setCode, l.cardNumber, KAPAI_PARAMS.minSamples);
      if (m && isArbitrageVsKapai({ price: l.price, marketMedian: m.median, sampleCount: m.sampleCount }, KAPAI_PARAMS)) {
        const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
        if (!existing) {
          detected++;
          const baseline = m.median;
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
