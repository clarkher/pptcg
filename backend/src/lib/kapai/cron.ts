import cron from 'node-cron';
import { runMonitorCycle } from './runner';
import { runPushBatch } from './pusher';

export function startKapaiCron(): void {
  if (process.env.KAPAI_MONITOR_ENABLED !== 'true') {
    console.log('[kapai] monitor disabled (set KAPAI_MONITOR_ENABLED=true to enable)');
    return;
  }
  console.log('[kapai] monitor enabled — 偵測每5分鐘、批次推播每30分鐘（台灣 09:00-23:00、價差前5大、去重）');
  // 偵測：每 5 分鐘爬+比價+建 alert（不推）
  cron.schedule('*/5 * * * *', () => {
    runMonitorCycle().catch((e) => console.error('[kapai] cycle error', e));
  });
  // 推播：每 30 分鐘批次推（內含時段判斷與去重）
  cron.schedule('0,30 * * * *', () => {
    runPushBatch().catch((e) => console.error('[kapai] push error', e));
  });
}
