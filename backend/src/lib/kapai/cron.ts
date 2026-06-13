import cron from 'node-cron';
import { runMonitorCycle } from './runner';
import { runPushBatch } from './pusher';

export function startKapaiCron(): void {
  if (process.env.KAPAI_MONITOR_ENABLED !== 'true') {
    console.log('[kapai] monitor disabled (set KAPAI_MONITOR_ENABLED=true to enable)');
    return;
  }
  console.log('[kapai] monitor enabled — 全量重偵測每20分鐘（並行+行情快取）、LINE批次每20分鐘');
  // 偵測：每 20 分鐘爬+全量重比價+建 alert（Telegram 即時推、LINE 交給 pusher）
  cron.schedule('*/20 * * * *', () => {
    runMonitorCycle().catch((e) => console.error('[kapai] cycle error', e));
  });
  // 推播：每 20 分鐘批次推（內含時段判斷與去重）
  cron.schedule('*/20 * * * *', () => {
    runPushBatch().catch((e) => console.error('[kapai] push error', e));
  });
}
