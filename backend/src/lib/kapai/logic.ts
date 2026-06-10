// 卡報報監控引擎 — 純計算邏輯（無 I/O，可單元測試）

export interface ArbitrageParams {
  discountThreshold: number; // 售價 ≤ baseline × 此值
  minProfit: number;         // baseline − 售價 ≥ 此值
  minSampleSize: number;     // 基準樣本數下限
}

export const DEFAULT_PARAMS: ArbitrageParams = {
  discountThreshold: 0.7,
  minProfit: 100,
  minSampleSize: 5,
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function buildCardKey(packId: string, packCardId: string): string | null {
  const pid = (packId ?? '').trim();
  const num = (packCardId ?? '').trim();
  if (!pid || !num) return null;
  return `${pid}-${num}`;
}

export interface ArbitrageInput {
  price: number;
  baseline: number;
  sampleSize: number;
}

export function isArbitrage(input: ArbitrageInput, params: ArbitrageParams): boolean {
  const { price, baseline, sampleSize } = input;
  if (sampleSize < params.minSampleSize) return false;
  if (baseline <= 0) return false;
  if (price > baseline * params.discountThreshold) return false;
  if (baseline - price < params.minProfit) return false;
  return true;
}

// ── 通知分流（結構預留，MVP notifier 先全推，之後接這個過濾）──

export interface AlertForMatch {
  game: string;
  price: number;
  baseline: number;
}

export interface PreferenceFilter {
  games: string[];            // 空=不限卡種/語言
  minSavingPct: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  enabled: boolean;
}

export function matchesPreference(alert: AlertForMatch, pref: PreferenceFilter): boolean {
  if (!pref.enabled) return false;
  if (pref.games.length > 0 && !pref.games.includes(alert.game)) return false;
  if (pref.minPrice != null && alert.price < pref.minPrice) return false;
  if (pref.maxPrice != null && alert.price > pref.maxPrice) return false;
  if (pref.minSavingPct != null && alert.baseline > 0) {
    const saving = (alert.baseline - alert.price) / alert.baseline;
    if (saving < pref.minSavingPct) return false;
  }
  return true;
}
