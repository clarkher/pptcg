import { prisma } from '../prisma';
import { pushLine } from './notifier';
import { loadConfig, getTaiwanHour, type PushConfig } from './config';

/** 台灣時間是否在推播時段。config 的 noPushStartHour–noPushEndHour 之間不推，其餘都推。 */
export function inPushWindow(now: Date, push: PushConfig): boolean {
  const twHour = getTaiwanHour(now);
  return !(twHour >= push.noPushStartHour && twHour < push.noPushEndHour);
}

/**
 * 批次推播：挑「尚未推播、價差最大」的前 N 筆推送，推完標 notified=true。
 * - 不推時段（config.push）跳過，省配額
 * - 推過的(notified=true)不再選 → 自動不與前一批重複
 */
export async function runPushBatch(): Promise<{ pushed: number }> {
  const { push } = await loadConfig();
  if (!inPushWindow(new Date(), push)) {
    console.log(`[kapai] push batch skipped（不推時段 ${push.noPushStartHour}:00-${push.noPushEndHour}:00）`);
    return { pushed: 0 };
  }
  const alerts = await prisma.arbitrageAlert.findMany({
    where: { notified: false },
    orderBy: { profit: 'desc' },
    take: push.lineBatchTopN,
  });
  let pushed = 0;
  for (const a of alerts) {
    const l = await prisma.kapaiListing.findUnique({ where: { id: a.listingId } });
    if (l) {
      await pushLine(l, a.baseline);
      pushed++;
    }
    await prisma.arbitrageAlert.update({ where: { id: a.id }, data: { notified: true } });
  }
  console.log(`[kapai] push batch: 推了 ${pushed} 筆（未推中價差前 ${push.lineBatchTopN} 大）`);
  return { pushed };
}
