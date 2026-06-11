import { ingestLatest } from './scraper';
import { detectAndAlert } from './detector';

export async function runMonitorCycle(): Promise<void> {
  const { scraped, saved, skipped } = await ingestLatest();
  const { detected, pushed } = await detectAndAlert();
  console.log(`[kapai] scraped=${scraped} saved=${saved} skipped=${skipped} detected=${detected} pushed=${pushed}`);
}
