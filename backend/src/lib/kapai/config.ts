// 卡報報引擎可調設定：存於 Setting['KAPAI_CONFIG'] (JSON)，後台可改。
// 純函式（parseConfig/pickScrapeWindow/getTaiwanHour）可單元測試；loadConfig/saveConfig 為 DB 薄殼 + 快取。
import { prisma } from '../prisma';

export const CONFIG_KEY = 'KAPAI_CONFIG';

export interface ScrapeWindow {
  startHour: number; // 台灣時間 0–23，此區間從這個整點開始生效
  pkmtw: number;
  pkmjp: number;
  pkmen: number;
}

export interface KapaiParams {
  discountThreshold: number; // 售價 ≤ baseline × 此值
  minProfit: number;         // baseline − 售價 ≥ 此值
  minMarketValue: number;    // baseline 下限（過濾低價值小卡）
  minSamples: number;        // 繁中同卡 perfect 賣家數下限
}

export interface PushConfig {
  noPushStartHour: number; // 台灣時間：此時起不推 LINE
  noPushEndHour: number;   // 台灣時間：此時止恢復推 LINE
  lineBatchTopN: number;   // LINE 每批推前 N 大價差
}

export interface KapaiConfig {
  scrapeWindows: ScrapeWindow[];
  params: KapaiParams;
  push: PushConfig;
}

export const DEFAULT_CONFIG: KapaiConfig = {
  scrapeWindows: [{ startHour: 0, pkmtw: 1500, pkmjp: 1500, pkmen: 350 }],
  params: { discountThreshold: 0.7, minProfit: 100, minMarketValue: 300, minSamples: 5 },
  push: { noPushStartHour: 4, noPushEndHour: 8, lineBatchTopN: 5 },
};

/** 由 UTC Date 算台灣（UTC+8）當前小時 0–23。 */
export function getTaiwanHour(date: Date = new Date()): number {
  return (date.getUTCHours() + 8) % 24;
}

/**
 * 依台灣小時挑出當前生效的爬取量區間。
 * 區間以 startHour 排序、各自覆蓋到下一區間起始；落在最小 startHour 之前 → 繞回最後一區間（跨午夜）。
 * 空清單回退到預設區間。
 */
export function pickScrapeWindow(windows: ScrapeWindow[], twHour: number): ScrapeWindow {
  if (windows.length === 0) return DEFAULT_CONFIG.scrapeWindows[0];
  const sorted = [...windows].sort((a, b) => a.startHour - b.startHour);
  let chosen = sorted[sorted.length - 1]; // 預設繞回最後一個（涵蓋凌晨跨午夜）
  for (const w of sorted) {
    if (w.startHour <= twHour) chosen = w;
  }
  return chosen;
}

/** 解析 Setting 存的 JSON 字串；null/壞掉/缺漏 → 補預設。純函式好測。 */
export function parseConfig(raw: string | null): KapaiConfig {
  if (!raw) return DEFAULT_CONFIG;
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    return DEFAULT_CONFIG;
  }
  if (!obj || typeof obj !== 'object') return DEFAULT_CONFIG;
  return {
    scrapeWindows: Array.isArray(obj.scrapeWindows) && obj.scrapeWindows.length > 0
      ? obj.scrapeWindows
      : DEFAULT_CONFIG.scrapeWindows,
    params: { ...DEFAULT_CONFIG.params, ...(obj.params ?? {}) },
    push: { ...DEFAULT_CONFIG.push, ...(obj.push ?? {}) },
  };
}

// ── DB 薄殼 + 60 秒記憶體快取（避免每輪偵測都打 DB）──
let cache: { value: KapaiConfig; at: number } | null = null;
const TTL_MS = 60_000;

export async function loadConfig(): Promise<KapaiConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await prisma.setting.findUnique({ where: { key: CONFIG_KEY } });
  const value = parseConfig(row?.value ?? null);
  cache = { value, at: Date.now() };
  return value;
}

export async function saveConfig(cfg: KapaiConfig): Promise<KapaiConfig> {
  const value = parseConfig(JSON.stringify(cfg)); // 正規化 + 補欄位
  await prisma.setting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(value) },
    create: { key: CONFIG_KEY, value: JSON.stringify(value) },
  });
  cache = null; // 清快取，下次重讀
  return value;
}

/** 測試或寫入後手動清快取。 */
export function clearConfigCache(): void {
  cache = null;
}
