import { ingestLatest } from './scraper';
import { detectAndAlert } from './detector';

/** 偵測一輪：爬最新商品、對台灣行情比價、建 alert（不推，推播交給 pusher）。 */
export async function runMonitorCycle(): Promise<void> {
  const { scraped, saved, skipped } = await ingestLatest();
  const { detected } = await detectAndAlert();
  console.log(`[kapai] scraped=${scraped} saved=${saved} skipped=${skipped} detected=${detected}`);
}
