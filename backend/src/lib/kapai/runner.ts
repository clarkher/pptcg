import { ingestLatest } from './scraper';
import { recomputePendingBaselines } from './baseline';
import { detectAndAlert } from './detector';

export async function runMonitorCycle(): Promise<void> {
  const { scraped, saved, skipped } = await ingestLatest();
  const pairs = await recomputePendingBaselines();
  const { detected, pushed } = await detectAndAlert();
  console.log(
    `[kapai] scraped=${scraped} saved=${saved} skipped=${skipped} baselines=${pairs} detected=${detected} pushed=${pushed}`
  );
}
