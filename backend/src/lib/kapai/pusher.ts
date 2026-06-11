import { prisma } from '../prisma';
import { pushArbitrage } from './notifier';

const TOP_N = 5;

/** 台灣時間是否在推播時段（09:00–23:00）。 */
export function inPushWindow(now = new Date()): boolean {
  const twHour = (now.getUTCHours() + 8) % 24; // 台灣 = UTC+8
  return twHour >= 9 && twHour < 23;
}

/**
 * 每30分批次推播：挑「尚未推播、價差最大」的前 N 筆推送，推完標 notified=true。
 * - 只在台灣 09:00–23:00 推（避免半夜打擾、省配額）
 * - 推過的(notified=true)不再選 → 自動不與前一批重複
 */
export async function runPushBatch(): Promise<{ pushed: number }> {
  if (!inPushWindow()) {
    console.log('[kapai] push batch skipped（非 09:00-23:00 時段）');
    return { pushed: 0 };
  }
  const alerts = await prisma.arbitrageAlert.findMany({
    where: { notified: false },
    orderBy: { profit: 'desc' },
    take: TOP_N,
  });
  let pushed = 0;
  for (const a of alerts) {
    const l = await prisma.kapaiListing.findUnique({ where: { id: a.listingId } });
    if (l) {
      await pushArbitrage(l, a.baseline);
      pushed++;
    }
    await prisma.arbitrageAlert.update({ where: { id: a.id }, data: { notified: true } });
  }
  console.log(`[kapai] push batch: 推了 ${pushed} 筆（未推中價差前 ${TOP_N} 大）`);
  return { pushed };
}
