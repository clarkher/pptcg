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

// ── 對 Huca 行情的嚴格比價（日英卡）──

export interface HucaArbParams {
  discountThreshold: number; // 卡拍拍售價 ≤ Huca基準 × 此值
  minProfit: number;         // Huca基準 − 售價 ≥ 此值
  minOfferCount: number;     // Huca 成交數下限（行情可靠度）
  maxSpreadRatio: number;    // Huca high/low 比值上限（行情穩定度，避免極端掛單）
}

export const HUCA_STRICT_PARAMS: HucaArbParams = {
  discountThreshold: 0.7,
  minProfit: 100,
  minOfferCount: 10,
  maxSpreadRatio: 3,
};

export interface HucaArbInput {
  price: number;           // 卡拍拍售價
  condition: string;       // 卡拍拍品相
  game: string;            // 卡拍拍 game
  hucaLow: number | null;  // Huca 低價（基準）
  hucaHigh: number | null; // Huca 高價（穩定度判斷）
  offerCount: number | null;
}

/** 日英卡對 Huca 行情的嚴格套利判斷。回傳是否命中。 */
export function isArbitrageVsHuca(input: HucaArbInput, params: HucaArbParams): boolean {
  // 只比日英卡
  if (input.game !== 'pkmjp' && input.game !== 'pkmen') return false;
  // 只比裸卡（perfect），排除 rated 評級卡與有損
  if (input.condition !== 'perfect') return false;
  // 行情可靠度：成交數足夠
  if (input.offerCount == null || input.offerCount < params.minOfferCount) return false;
  // 基準需存在且為正
  const low = input.hucaLow;
  if (low == null || low <= 0) return false;
  // 行情穩定度：high/low 不能差太多（避免極端掛單）
  if (input.hucaHigh != null && input.hucaHigh > 0 && input.hucaHigh / low > params.maxSpreadRatio) return false;
  // 套利條件
  if (input.price > low * params.discountThreshold) return false;
  if (low - input.price < params.minProfit) return false;
  return true;
}

// ── 對純裸卡市價的比價（取代 vs Huca 混合價，因 Huca 偏 PSA10）──

export interface RawArbParams {
  discountThreshold: number; // 卡拍拍售價 ≤ 裸卡市價 × 此值
  minProfit: number;         // 裸卡市價 − 售價 ≥ 此值
  minRawSamples: number;     // 裸卡在售樣本下限（行情可靠度）
}

export const RAW_PARAMS: RawArbParams = { discountThreshold: 0.7, minProfit: 100, minRawSamples: 3 };

export interface RawArbInput {
  price: number;
  condition: string;
  game: string;
  rawPriceTwd: number | null;
  rawSampleCount: number | null;
}

export function isArbitrageVsRaw(input: RawArbInput, params: RawArbParams): boolean {
  if (input.game !== 'pkmjp' && input.game !== 'pkmen') return false;
  if (input.condition !== 'perfect') return false;
  if (input.rawSampleCount == null || input.rawSampleCount < params.minRawSamples) return false;
  const raw = input.rawPriceTwd;
  if (raw == null || raw <= 0) return false;
  if (input.price > raw * params.discountThreshold) return false;
  if (raw - input.price < params.minProfit) return false;
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
