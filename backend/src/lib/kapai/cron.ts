import cron from 'node-cron';
import { runMonitorCycle } from './runner';

export function startKapaiCron(): void {
  if (process.env.KAPAI_MONITOR_ENABLED !== 'true') {
    console.log('[kapai] monitor disabled (set KAPAI_MONITOR_ENABLED=true to enable)');
    return;
  }
  console.log('[kapai] monitor cron enabled — every 5 minutes');
  cron.schedule('*/5 * * * *', () => {
    runMonitorCycle().catch((e) => console.error('[kapai] cycle error', e));
  });
}
