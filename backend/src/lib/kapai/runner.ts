import { ingestLatest } from './scraper';
import { detectAndAlert } from './detector';

let running = false;

/** 偵測一輪：爬最新商品、對行情比價、建 alert（不推，推播交給 pusher）。防重疊。 */
export async function runMonitorCycle(): Promise<void> {
  if (running) {
    console.log('[kapai] 上一輪偵測還在跑，本輪跳過');
    return;
  }
  running = true;
  try {
    const { scraped, saved, skipped } = await ingestLatest();
    const { detected } = await detectAndAlert();
    console.log(`[kapai] scraped=${scraped} saved=${saved} skipped=${skipped} detected=${detected}`);
  } finally {
    running = false;
  }
}
