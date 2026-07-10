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

// 日圓→台幣近期匯率（成交序列換算用，與 huca-raw 共用）
export const JPY_TWD = 0.21;

export function buildCardKey(packId: string, packCardId: string): string | null {
  const pid = (packId ?? '').trim();
  const num = (packCardId ?? '').trim();
  if (!pid || !num) return null;
  return `${pid}-${num}`;
}

/** 掛單是否需要重新寫入/比價：新出現或價/量有變才需要（沒變就跳過，省 DB 寫入）。 */
export function listingChanged(
  existing: { price: number; stock: number } | null | undefined,
  scraped: { price: number; stock: number }
): boolean {
  if (!existing) return true;
  return existing.price !== scraped.price || existing.stock !== scraped.stock;
}

// ── 卡拍拍賣家備註判斷 ──
// 「隨機出貨」= 買到的不是圖上這張卡 → 抑制（不推）。瑕疵/缺件/損傷 → 警告（仍推、標⚠️）。
const NOTE_SUPPRESS_RE = /隨機|亂數出/;
const NOTE_WARN_RE = /[ABC]品|打牌品|瑕|裂|痕跡|磨損|凹|折痕|白邊|缺角|缺件|刮|受潮|水漬|翹|彎|破損|(?<![無无完])損/;

export interface NoteFlags {
  suppress: boolean; // 隨機出貨等：根本不是這張卡，別推
  warn: boolean;     // 疑似瑕疵/缺件/損傷：仍推但標⚠️
}

/** 分析賣家備註，回傳是否該抑制/警告。純函式。 */
export function analyzeNote(description: string | null | undefined): NoteFlags {
  const d = (description ?? '').trim();
  if (!d) return { suppress: false, warn: false };
  return { suppress: NOTE_SUPPRESS_RE.test(d), warn: NOTE_WARN_RE.test(d) };
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

// ── 對卡拍拍站內「台灣行情」的比價（終極方案，取代 Huca/Snkrdunk）──

export interface KapaiArbParams {
  discountThreshold: number; // 售價 ≤ 基準 × 此值
  minProfit: number;         // 基準 − 售價 ≥ 此值
  minMarketValue: number;    // 基準下限（過濾低價值小卡，如聖灰$10）
  minSamples: number;        // 繁中：同卡 perfect 賣家數下限（基準可信度）
}

export const KAPAI_PARAMS: KapaiArbParams = {
  discountThreshold: 0.7,
  minProfit: 100,
  minMarketValue: 300,
  minSamples: 5,
};

export interface DealInput {
  price: number;          // 新上架售價
  baseline: number;       // 行情基準（日英=Huca裸卡成交價；繁中=站內perfect中位）
  siteMin: number | null; // 卡拍拍站內現有 perfect 最低價（排除自身）；null=站內無其他在售
}

/**
 * 雙軌套利判斷（基準來源由呼叫端決定）：
 * 1. 必須是站內最低 —— 比站上現有 perfect 最低還便宜才算撿漏（解決「報貴的，站上明明有更便宜」）
 * 2. 明顯低於行情基準（≤70% 且省 ≥100）
 * 3. 基準 ≥ 下限（過濾低價值小卡）
 */
export function isDeal(input: DealInput, params: KapaiArbParams): boolean {
  const { price, baseline, siteMin } = input;
  if (baseline < params.minMarketValue) return false;
  if (baseline <= 0) return false;
  if (siteMin != null && price >= siteMin) return false; // 站上有更便宜或同價的 → 不是機會
  if (price > baseline * params.discountThreshold) return false;
  if (baseline - price < params.minProfit) return false;
  return true;
}

/**
 * 日英 Huca 基準防呆：Huca 番號對齊不分稀有度，同番號「一般版本」可能被對到「球閃」大師球高價版
 * （例：皮卡丘 SV2a-025 一般版站內中位 $75，但 Huca 對到球閃版 $789）。
 * 用站內同 rare 中位佐證：站內同 rare 樣本足(≥minSamples)且 Huca 遠高於站內中位(>maxRatio 倍) →
 * 代表 Huca 對齊到別的稀有度版本、不可信。樣本不足則無從佐證、只能信 Huca。
 */
export function isHucaBaselineReliable(
  hucaBaseline: number,
  siteMedianSameRare: number | null,
  siteCountSameRare: number,
  minSamples: number,
  maxRatio = 3
): boolean {
  if (siteMedianSameRare == null || siteMedianSameRare <= 0 || siteCountSameRare < minSamples) return true;
  return hucaBaseline <= siteMedianSameRare * maxRatio;
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

// ── 成交跳漲偵測（純計算）──

export interface SurgeComputeParams {
  recentDays: number;
  priorDays: number;
  priceSurgeRatio: number;
  volSurgeRatio: number;
  minRecentCount: number;
}

export interface SurgeResult {
  surged: boolean;
  recentMedianTwd: number;
  priceSurged: boolean;
  volSurged: boolean;
  recentCount: number;
  priorCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 從成交走勢序列 [ts(ms), priceJPY][] 判斷是否「漲價且熱度暴增」。
 * 近期 = 近 recentDays 天；對照 = 之前 priorDays 天。
 * 漲價：近期中位 ≥ 對照中位 × priceSurgeRatio；熱度：近期週量 ≥ 對照週均 × volSurgeRatio。
 * 兩者都成立才算 surge。樣本不足或對照期空 → 不算。recentMedianTwd 已換算台幣。
 */
export function computeSurge(series: [number, number][], params: SurgeComputeParams, now: number): SurgeResult {
  const recentCut = now - params.recentDays * DAY_MS;
  const priorCut = now - (params.recentDays + params.priorDays) * DAY_MS;
  const recent: number[] = [];
  const prior: number[] = [];
  for (const point of series) {
    const ts = point?.[0];
    const price = point?.[1];
    if (typeof ts !== 'number' || typeof price !== 'number' || price <= 0) continue;
    if (ts >= recentCut) recent.push(price);
    else if (ts >= priorCut) prior.push(price);
  }
  const none: SurgeResult = {
    surged: false, recentMedianTwd: 0, priceSurged: false, volSurged: false,
    recentCount: recent.length, priorCount: prior.length,
  };
  if (recent.length < params.minRecentCount || prior.length === 0) return none;
  const recentMed = median(recent);
  const priorMed = median(prior);
  const priceSurged = priorMed > 0 && recentMed >= priorMed * params.priceSurgeRatio;
  const recentWeekly = recent.length / (params.recentDays / 7);
  const priorWeekly = prior.length / (params.priorDays / 7);
  const volSurged = priorWeekly > 0 && recentWeekly >= priorWeekly * params.volSurgeRatio;
  return {
    surged: priceSurged && volSurged,
    recentMedianTwd: Math.round(recentMed * JPY_TWD),
    priceSurged, volSurged,
    recentCount: recent.length, priorCount: prior.length,
  };
}

/**
 * 在某卡的 perfect 在售清單中，依稀有度分組，挑「最低掛單夠便宜且基準可信」的最佳一筆。
 * - 同稀有度比價（避免一般版本被高稀有度基準帶歪）
 * - isHucaBaselineReliable 防呆：基準遠高於同稀有度站內中位 → 該稀有度跳過
 * - isDeal 套利判斷（基準 = 跳漲後近期成交中位）
 * 回利潤最高的一筆，無命中回 null。泛型保留呼叫端的完整 listing 型別。
 */
export function pickSurgeDeal<T extends { id: number; price: number; rare: string }>(
  listings: T[],
  baseline: number,
  params: KapaiArbParams
): { listing: T; siteMin: number | null; profit: number; discount: number } | null {
  const byRare = new Map<string, T[]>();
  for (const l of listings) {
    const arr = byRare.get(l.rare);
    if (arr) arr.push(l);
    else byRare.set(l.rare, [l]);
  }
  let best: { listing: T; siteMin: number | null; profit: number; discount: number } | null = null;
  for (const group of byRare.values()) {
    const sorted = [...group].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const med = median(sorted.map((l) => l.price));
    if (!isHucaBaselineReliable(baseline, med, group.length, params.minSamples)) continue;
    const siteMin = sorted[1]?.price ?? null;
    if (!isDeal({ price: cheapest.price, baseline, siteMin }, params)) continue;
    const profit = baseline - cheapest.price;
    if (!best || profit > best.profit) {
      best = { listing: cheapest, siteMin, profit, discount: cheapest.price / baseline };
    }
  }
  return best;
}

// ── 每日自動調節（純計算）：只調跳漲軌 4 個轉盤，鎖在 strict↔loose 安全帶 ──

export type AutotuneAction = 'loosen' | 'tighten' | 'hold';

const AUTOTUNE_BANDS = {
  priceSurgeRatio: { strict: 1.2, loose: 1.05, step: 0.05 },
  volSurgeRatio: { strict: 2.0, loose: 1.2, step: 0.1 },
  discountThreshold: { strict: 0.8, loose: 0.9, step: 0.02 },
  minProfit: { strict: 200, loose: 100, step: 20 },
} as const;

function moveToward(current: number, target: number, step: number): number {
  if (target > current) return Math.min(target, current + step);
  if (target < current) return Math.max(target, current - step);
  return current;
}
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * 依當日通知數決定放寬/收緊/維持跳漲軌門檻。
 * count < low → loosen（往 loose 端移一步）；count > high → tighten（往 strict 端移一步）；其餘 hold。
 * 已達端點而無實際變動 → 回 hold。純函式、泛型保留呼叫端 surge 型別。
 */
export function computeAutotune<T extends { priceSurgeRatio: number; volSurgeRatio: number; discountThreshold: number; minProfit: number }>(
  surge: T,
  alertCount: number,
  lowThreshold: number,
  highThreshold: number
): { action: AutotuneAction; next: T } {
  let action: AutotuneAction = 'hold';
  if (alertCount < lowThreshold) action = 'loosen';
  else if (alertCount > highThreshold) action = 'tighten';
  if (action === 'hold') return { action, next: surge };

  const end = action === 'loosen' ? 'loose' : 'strict';
  const next: T = {
    ...surge,
    priceSurgeRatio: round2(moveToward(surge.priceSurgeRatio, AUTOTUNE_BANDS.priceSurgeRatio[end], AUTOTUNE_BANDS.priceSurgeRatio.step)),
    volSurgeRatio: round2(moveToward(surge.volSurgeRatio, AUTOTUNE_BANDS.volSurgeRatio[end], AUTOTUNE_BANDS.volSurgeRatio.step)),
    discountThreshold: round2(moveToward(surge.discountThreshold, AUTOTUNE_BANDS.discountThreshold[end], AUTOTUNE_BANDS.discountThreshold.step)),
    minProfit: Math.round(moveToward(surge.minProfit, AUTOTUNE_BANDS.minProfit[end], AUTOTUNE_BANDS.minProfit.step)),
  };
  const changed =
    next.priceSurgeRatio !== surge.priceSurgeRatio ||
    next.volSurgeRatio !== surge.volSurgeRatio ||
    next.discountThreshold !== surge.discountThreshold ||
    next.minProfit !== surge.minProfit;
  if (!changed) return { action: 'hold', next: surge };
  return { action, next };
}
