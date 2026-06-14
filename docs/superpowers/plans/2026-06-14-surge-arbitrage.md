# 行情跳漲撿漏（美日卡第二偵測軌）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一條獨立偵測軌，偵測美日卡在 Huca 的成交「漲價＋熱度」雙跳漲，反向回抓該卡卡拍拍目前最低掛單，用後台可調的專用門檻判斷是否可獲利並推播。

**Architecture:** 純計算（`computeSurge`、`pickSurgeDeal`）放 `logic.ts` 可單元測試；I/O（抓成交序列、抓在售快照）放 `huca-raw.ts`／`market.ts`；`surge.ts` 串流程；每小時 cron 觸發。共用既有 `isDeal`／`isHucaBaselineReliable`／`ArbitrageAlert`（`listingId` unique 去重）／`notifier`／`pusher`。

**Tech Stack:** TypeScript、Node、Prisma（Neon Postgres）、vitest、node-cron、React（後台設定頁）。

---

## File Structure

- `backend/src/lib/kapai/logic.ts` — 加 `computeSurge`、`pickSurgeDeal`、`JPY_TWD`（純函式）
- `backend/src/lib/kapai/config.ts` — `KapaiConfig` 加 `surge` 區塊
- `backend/src/lib/kapai/huca-raw.ts` — 加 `fetchSurgeSeries`，改用 logic 的 `JPY_TWD`
- `backend/src/lib/kapai/market.ts` — 抽純 `parsePerfectProducts`、加 `fetchPerfectSnapshot`、擴充 `PerfectListing` 欄位
- `backend/src/lib/kapai/surge.ts` — 新檔，`detectSurges()` 主流程
- `backend/src/lib/kapai/cron.ts` — 加每小時 surge schedule
- `backend/src/lib/kapai/notifier.ts` — `buildText` 加 surge 標記
- `backend/prisma/schema.prisma` — `ArbitrageAlert.source`
- `backend/src/controllers/kapai-admin.ts` — surge 欄位驗證
- `frontend/src/pages/admin/AdminKapaiSettings.tsx` — surge 設定區
- 測試：`logic.test.ts`、`config.test.ts`、新增 `notifier.test.ts`、`market.test.ts`（既有，不需改）

---

### Task 1: `computeSurge` 純函式 + `JPY_TWD` 共用常數

**Files:**
- Modify: `backend/src/lib/kapai/logic.ts`
- Modify: `backend/src/lib/kapai/huca-raw.ts:6`（移除本地 `JPY_TWD`，改 import）
- Test: `backend/src/lib/kapai/logic.test.ts`

- [ ] **Step 1: 寫失敗測試** — 加到 `logic.test.ts` 結尾，並把 import 行補上 `computeSurge`

```ts
import { median, buildCardKey, isArbitrage, matchesPreference, isArbitrageVsHuca, isArbitrageVsRaw, isDeal, isHucaBaselineReliable, computeSurge, HUCA_STRICT_PARAMS, RAW_PARAMS, KAPAI_PARAMS, DEFAULT_PARAMS } from './logic';

describe('computeSurge', () => {
  const NOW = Date.UTC(2026, 5, 14); // 2026-06-14
  const DAY = 24 * 60 * 60 * 1000;
  const P = { recentDays: 7, priorDays: 30, priceSurgeRatio: 1.2, volSurgeRatio: 2, minRecentCount: 3 };
  // 近期點（1~6 天前）與對照點（10~37 天前）
  const recentAt = (d: number) => NOW - d * DAY;
  const priorAt = (d: number) => NOW - d * DAY;

  it('漲價且熱度→surge，新基準=近期中位×匯率', () => {
    const series: [number, number][] = [
      [recentAt(1), 5000], [recentAt(2), 5000], [recentAt(3), 5000], [recentAt(4), 5000], // 近7天4筆@5000
      [priorAt(10), 3000], [priorAt(20), 3000], [priorAt(30), 3000],                       // 前30天3筆@3000
    ];
    const r = computeSurge(series, P, NOW);
    expect(r.priceSurged).toBe(true);   // 5000 ≥ 3000×1.2
    expect(r.volSurged).toBe(true);     // 週量 4 ≥ (3/(30/7))×2≈1.4
    expect(r.surged).toBe(true);
    expect(r.recentMedianTwd).toBe(Math.round(5000 * 0.21)); // 1050
  });

  it('只漲不熱→否', () => {
    const prior: [number, number][] = Array.from({ length: 30 }, (_, i) => [priorAt(8 + i), 3000] as [number, number]);
    const series: [number, number][] = [[recentAt(1), 5000], [recentAt(3), 5000], [recentAt(5), 5000], ...prior];
    const r = computeSurge(series, P, NOW);
    expect(r.priceSurged).toBe(true);
    expect(r.volSurged).toBe(false);    // 近週量3 < (30/(30/7))×2=14
    expect(r.surged).toBe(false);
  });

  it('只熱不漲→否', () => {
    const recent: [number, number][] = Array.from({ length: 10 }, (_, i) => [recentAt(1 + (i % 6)), 3000] as [number, number]);
    const series: [number, number][] = [...recent, [priorAt(10), 3000], [priorAt(20), 3000], [priorAt(30), 3000]];
    const r = computeSurge(series, P, NOW);
    expect(r.volSurged).toBe(true);
    expect(r.priceSurged).toBe(false);  // 3000 not ≥ 3000×1.2
    expect(r.surged).toBe(false);
  });

  it('近期樣本不足→否', () => {
    const series: [number, number][] = [[recentAt(1), 5000], [recentAt(2), 5000], [priorAt(10), 3000], [priorAt(20), 3000]];
    expect(computeSurge(series, P, NOW).surged).toBe(false); // 近期2筆 < minRecentCount 3
  });

  it('對照期無樣本→否', () => {
    const series: [number, number][] = [[recentAt(1), 5000], [recentAt(2), 5000], [recentAt(3), 5000]];
    expect(computeSurge(series, P, NOW).surged).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/kapai/logic.test.ts -t computeSurge`
Expected: FAIL — `computeSurge is not a function` / import error。

- [ ] **Step 3: 實作** — 在 `logic.ts` 頂部（`median` 之後）加 `JPY_TWD`，並在檔尾加 `computeSurge`

```ts
// 日圓→台幣近期匯率（成交序列換算用，與 huca-raw 共用）
export const JPY_TWD = 0.21;
```

```ts
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
```

在 `huca-raw.ts` 移除本地常數、改 import（第 6 行 `const JPY_TWD = 0.21;` 刪除）：

```ts
import { prisma } from '../prisma';
import { JPY_TWD } from './logic';
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/kapai/logic.test.ts`
Expected: PASS（含 computeSurge 全綠、既有測試不變）。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/kapai/logic.ts backend/src/lib/kapai/logic.test.ts backend/src/lib/kapai/huca-raw.ts
git commit -m "feat(kapai): computeSurge 成交跳漲偵測純函式 + JPY_TWD 共用"
```

---

### Task 2: `pickSurgeDeal` 純函式（同稀有度選最低、防呆、套利判斷）

**Files:**
- Modify: `backend/src/lib/kapai/logic.ts`
- Test: `backend/src/lib/kapai/logic.test.ts`

- [ ] **Step 1: 寫失敗測試** — 補 import `pickSurgeDeal`，加 describe

```ts
describe('pickSurgeDeal', () => {
  const params = { discountThreshold: 0.8, minProfit: 200, minMarketValue: 1000, minSamples: 5 };
  const L = (id: number, price: number, rare = 'AR') => ({ id, price, rare });

  it('同稀有度最低掛單夠便宜→回該筆', () => {
    const listings = [L(1, 2000), L(2, 2800), L(3, 3000), L(4, 3100), L(5, 3200)];
    const d = pickSurgeDeal(listings, 3000, params);
    expect(d).not.toBeNull();
    expect(d!.listing.id).toBe(1);
    expect(d!.profit).toBe(1000);
    expect(d!.siteMin).toBe(2800); // 排除最低後的第二低
  });

  it('折扣不足→null', () => {
    const listings = [L(1, 2600), L(2, 2900), L(3, 3000)];
    expect(pickSurgeDeal(listings, 3000, params)).toBeNull(); // 2600 > 3000×0.8=2400
  });

  it('跨稀有度取較高利潤，且擋掉基準對不上的稀有度', () => {
    // 基準 3000 來自某變體；'B' 群中位 700、樣本足→基準遠高於它(>3×)→不可靠跳過
    const listings = [
      L(1, 2000, 'A'), L(2, 2900, 'A'), L(3, 3000, 'A'), L(4, 3100, 'A'), L(5, 3050, 'A'),
      L(6, 500, 'B'), L(7, 600, 'B'), L(8, 700, 'B'), L(9, 800, 'B'), L(10, 900, 'B'),
    ];
    const d = pickSurgeDeal(listings, 3000, params);
    expect(d!.listing.rare).toBe('A'); // B 雖看似省更多但基準不可靠被跳過
    expect(d!.listing.id).toBe(1);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/kapai/logic.test.ts -t pickSurgeDeal`
Expected: FAIL — `pickSurgeDeal is not a function`。

- [ ] **Step 3: 實作** — 在 `logic.ts` `computeSurge` 之後加

```ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/kapai/logic.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/kapai/logic.ts backend/src/lib/kapai/logic.test.ts
git commit -m "feat(kapai): pickSurgeDeal 同稀有度選最低+防呆套利判斷"
```

---

### Task 3: `KapaiConfig.surge` 設定區塊

**Files:**
- Modify: `backend/src/lib/kapai/config.ts`
- Test: `backend/src/lib/kapai/config.test.ts`

- [ ] **Step 1: 寫/改測試** — `config.test.ts` 的 `parseConfig` describe 內

新增兩個 it、並**修正既有「完整自訂值原樣保留」**（因 DEFAULT 多了 surge，custom 須帶 surge 才會 toEqual）：

```ts
  it('缺漏 surge 補預設', () => {
    const cfg = parseConfig(JSON.stringify({ surge: { minBaseline: 2000 } }));
    expect(cfg.surge.minBaseline).toBe(2000);                                   // 保留有給的
    expect(cfg.surge.discountThreshold).toBe(DEFAULT_CONFIG.surge.discountThreshold); // 補預設
    expect(cfg.surge.enabled).toBe(DEFAULT_CONFIG.surge.enabled);
  });

  it('整段缺 surge → 全預設', () => {
    const cfg = parseConfig(JSON.stringify({ params: { minProfit: 150 } }));
    expect(cfg.surge).toEqual(DEFAULT_CONFIG.surge);
  });
```

把既有 `完整自訂值原樣保留` 的 `custom` 物件補上 surge（與下方 DEFAULT 一致即可，避免 toEqual 失敗）：

```ts
  it('完整自訂值原樣保留', () => {
    const custom = {
      scrapeWindows: [{ startHour: 0, pkmtw: 2000, pkmjp: 2000, pkmen: 400 }],
      params: { discountThreshold: 0.75, minProfit: 150, minMarketValue: 500, minSamples: 8 },
      push: { noPushStartHour: 3, noPushEndHour: 9, lineBatchTopN: 10 },
      surge: { enabled: false, recentDays: 5, priorDays: 21, priceSurgeRatio: 1.3, volSurgeRatio: 2.5, minRecentCount: 4, minBaseline: 1500, discountThreshold: 0.75, minProfit: 300 },
    };
    expect(parseConfig(JSON.stringify(custom))).toEqual(custom);
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/kapai/config.test.ts`
Expected: FAIL — `cfg.surge` undefined / `完整自訂值` toEqual 不符。

- [ ] **Step 3: 實作** — `config.ts`

在 `KapaiConfig` 之前加介面、`KapaiConfig` 加欄位、`DEFAULT_CONFIG` 加 surge、`parseConfig` 加 merge：

```ts
export interface SurgeConfig {
  enabled: boolean;
  recentDays: number;       // 近期視窗（天）
  priorDays: number;        // 對照視窗（天，近期之前）
  priceSurgeRatio: number;  // 近期中位 ≥ 對照中位 × 此值
  volSurgeRatio: number;    // 近期週量 ≥ 對照週均 × 此值
  minRecentCount: number;   // 近期最少成交筆數（可靠度）
  minBaseline: number;      // 只看新行情 ≥ 此值的卡（高價值）
  discountThreshold: number;// 最低掛單 ≤ 新行情 × 此值
  minProfit: number;        // 省額下限
}
```

```ts
export interface KapaiConfig {
  scrapeWindows: ScrapeWindow[];
  params: KapaiParams;
  push: PushConfig;
  surge: SurgeConfig;
}
```

```ts
export const DEFAULT_CONFIG: KapaiConfig = {
  scrapeWindows: [{ startHour: 0, pkmtw: 1500, pkmjp: 1500, pkmen: 350 }],
  params: { discountThreshold: 0.7, minProfit: 100, minMarketValue: 300, minSamples: 5 },
  push: { noPushStartHour: 4, noPushEndHour: 8, lineBatchTopN: 5 },
  surge: {
    enabled: true, recentDays: 7, priorDays: 30, priceSurgeRatio: 1.2, volSurgeRatio: 2,
    minRecentCount: 3, minBaseline: 1000, discountThreshold: 0.8, minProfit: 200,
  },
};
```

在 `parseConfig` 的 return 物件加一行：

```ts
  return {
    scrapeWindows: Array.isArray(obj.scrapeWindows) && obj.scrapeWindows.length > 0
      ? obj.scrapeWindows
      : DEFAULT_CONFIG.scrapeWindows,
    params: { ...DEFAULT_CONFIG.params, ...(obj.params ?? {}) },
    push: { ...DEFAULT_CONFIG.push, ...(obj.push ?? {}) },
    surge: { ...DEFAULT_CONFIG.surge, ...(obj.surge ?? {}) },
  };
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/kapai/config.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/kapai/config.ts backend/src/lib/kapai/config.test.ts
git commit -m "feat(kapai): KapaiConfig 加 surge 行情跳漲偵測設定區塊"
```

---

### Task 4: schema `ArbitrageAlert.source` + db push（staging）

**Files:**
- Modify: `backend/prisma/schema.prisma:294-307`

- [ ] **Step 1: 改 schema** — `ArbitrageAlert` 在 `notified` 後加

```prisma
  notified  Boolean  @default(false)
  source    String   @default("listing") // "listing"=新掛單軌 / "surge"=行情跳漲軌
  pushedAt  DateTime @default(now())
```

- [ ] **Step 2: 對 staging Neon push + 重生 client**

先取 staging DATABASE_URL（記憶：staging 服務 `pptcg-backend-staging`，Neon ep-rough-butterfly）：

Run:
```bash
cd backend
STAGING_DB=$(railway variables -s pptcg-backend-staging --kv 2>/dev/null | grep '^DATABASE_URL=' | cut -d= -f2-)
DATABASE_URL="$STAGING_DB" npx prisma db push
npx prisma generate
```
Expected: `Your database is now in sync` + client 重生成功。
（若 `railway` 取不到，改用 `railway variables -s pptcg-backend-staging` 人工確認 URL。prod push 留待最後部署步驟，見「部署」段。）

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(kapai): ArbitrageAlert 加 source 欄區分新掛單/跳漲軌"
```

---

### Task 5: `buildText` surge 標記

**Files:**
- Modify: `backend/src/lib/kapai/notifier.ts:14-25`
- Test: `backend/src/lib/kapai/notifier.test.ts`（新）

- [ ] **Step 1: 寫失敗測試** — 新檔 `notifier.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildText, type AlertListing } from './notifier';

const sample: AlertListing = {
  id: 1, game: 'pkmjp', name: '皮卡丘', packName: '測試包', cardKey: 'SV2a-025',
  condition: 'perfect', price: 800, sellerId: 9, sellerNickname: '賣家', sellerArea: '台北',
};

describe('buildText', () => {
  it('預設用套利雷達標頭', () => {
    expect(buildText(sample, 1200)).toContain('🚨 套利雷達');
  });
  it('surge 用行情跳漲標頭', () => {
    const t = buildText(sample, 1200, { surge: true });
    expect(t).toContain('🔥 行情跳漲撿漏');
    expect(t).not.toContain('🚨 套利雷達');
  });
  it('仍顯示售價與省額', () => {
    expect(buildText(sample, 1200)).toContain('省 NT$400');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/kapai/notifier.test.ts`
Expected: FAIL — surge 標頭不存在。

- [ ] **Step 3: 實作** — 改 `buildText` 簽章與標頭

```ts
export function buildText(listing: AlertListing, baseline: number, opts?: { surge?: boolean }): string {
  const langMap: Record<string, string> = { pkmjp: '日文', pkmen: '英文', pkmtw: '繁中' };
  const lang = langMap[listing.game] ?? listing.game;
  // 基準來源：日英=Huca 裸卡成交價、繁中=卡拍拍站內 perfect 行情
  const src = listing.game === 'pkmtw' ? '站內行情' : 'Huca成交價';
  const header = opts?.surge ? '🔥 行情跳漲撿漏' : '🚨 套利雷達';
  return (
    `${header}\n\n${listing.name}\n套系：${listing.packName}\n番號：${listing.cardKey}｜語言：${lang}\n\n` +
    `💰 售價 NT$${listing.price}（${src} NT$${baseline}）\n📉 省 NT$${baseline - listing.price}\n` +
    `賣家：${listing.sellerNickname}（${listing.sellerArea}）\n\n` +
    `https://trade.kapaipai.tw/shop/${listing.sellerId}/${listing.id}`
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/kapai/notifier.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/kapai/notifier.ts backend/src/lib/kapai/notifier.test.ts
git commit -m "feat(kapai): buildText 加 surge 行情跳漲標頭"
```

---

### Task 6: market `parsePerfectProducts` + `fetchPerfectSnapshot`

**Files:**
- Modify: `backend/src/lib/kapai/market.ts:22-64`
- Test: `backend/src/lib/kapai/market.test.ts`（既有 + 補 parse 測試）

- [ ] **Step 1: 補測試** — `market.test.ts` import 加 `parsePerfectProducts, fetchPerfectSnapshot`，加 describe

```ts
import { fetchPerfectListings, fetchPerfectMarket, clearMarketCache, parsePerfectProducts, fetchPerfectSnapshot } from './market';

describe('parsePerfectProducts', () => {
  it('只留 perfect、解析完整欄位、濾掉壞價', () => {
    const out = parsePerfectProducts({ data: { products: [
      { id: 1, condition: 'perfect', price: '500', rare: 'AR', game: 'pkmjp', sellerId: 7, sellerNickname: '賣', sellerArea: '台北', productKey: '皮卡丘', packName: '包', packId: 'SV2a', packCardId: '025', stock: 2, createdTime: '2026-06-01' },
      { id: 2, condition: 'rated', price: '900' },     // 非 perfect 濾掉
      { id: 3, condition: 'perfect', price: 'abc' },    // 壞價濾掉
    ] } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 1, price: 500, rare: 'AR', sellerId: 7, productKey: '皮卡丘', packId: 'SV2a' });
  });
  it('無 products 回空陣列', () => {
    expect(parsePerfectProducts({})).toEqual([]);
  });
});

describe('fetchPerfectSnapshot', () => {
  it('非標準卡回 null、不打 API', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await fetchPerfectSnapshot('pkmjp', 'DECK-x', 'y')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it('正常卡回完整 listings（不吃快取、每次都打）', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { products: [
      { id: 1, condition: 'perfect', price: '500', rare: 'AR' },
    ] } }) });
    vi.stubGlobal('fetch', f);
    const a = await fetchPerfectSnapshot('pkmjp', 'SV2a', '025');
    const b = await fetchPerfectSnapshot('pkmjp', 'SV2a', '025');
    expect(a).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(2); // 無快取
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/kapai/market.test.ts`
Expected: FAIL — `parsePerfectProducts` / `fetchPerfectSnapshot` 未匯出。

- [ ] **Step 3: 實作** — 改 `market.ts`

把 `PerfectListing` 擴充、抽出純 `parsePerfectProducts`、`fetchPerfectListings` 改用它、新增 `fetchPerfectSnapshot`：

```ts
export interface PerfectListing {
  id: number;
  price: number;
  rare: string;
  game: string;
  condition: string;
  sellerId: number;
  sellerNickname: string;
  sellerArea: string;
  productKey: string;
  packName: string;
  packId: string;
  packCardId: string;
  stock: number;
  createdTime: string;
}
```

```ts
/** 純解析 listProduct 回應 → perfect 完整 listing 陣列（濾非 perfect / 壞價）。 */
export function parsePerfectProducts(json: any): PerfectListing[] {
  const products: any[] = json?.data?.products ?? [];
  return products
    .filter((p) => p?.condition === 'perfect')
    .map((p) => ({
      id: p?.id,
      price: parseInt(p?.price, 10),
      rare: p?.rare ?? '',
      game: p?.game ?? '',
      condition: p?.condition ?? '',
      sellerId: p?.sellerId ?? 0,
      sellerNickname: p?.sellerNickname ?? '',
      sellerArea: p?.sellerArea ?? '',
      productKey: p?.productKey ?? '',
      packName: p?.packName ?? '',
      packId: p?.packId ?? '',
      packCardId: p?.packCardId ?? '',
      stock: p?.stock ?? 0,
      createdTime: p?.createdTime ?? '',
    }))
    .filter((l) => typeof l.id === 'number' && !Number.isNaN(l.price) && l.price > 0);
}
```

`fetchPerfectListings` 內的 `.map/.filter` 區段改成呼叫純函式（其餘快取邏輯不動）：

```ts
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null; // 失敗不快取，下輪重試
  const value = parsePerfectProducts(await res.json());
  cache.set(key, { value, at: Date.now() });
  return value;
```

檔尾加 `fetchPerfectSnapshot`（不吃快取，surge 每小時掃一次本就需當下在售）：

```ts
/**
 * 抓某卡「站內 perfect」在售完整快照（不吃快取）。供 surge 軌即時取最低掛單與賣家資訊。
 * 非標準卡回 null、API 失敗回 null。
 */
export async function fetchPerfectSnapshot(
  game: string,
  packId: string,
  packCardId: string
): Promise<PerfectListing[] | null> {
  if (!isStandardCard(packId, packCardId)) return null;
  const url =
    `${BASE}/product/listProduct?game=${encodeURIComponent(game)}` +
    `&packId=${encodeURIComponent(packId)}&packCardId=${encodeURIComponent(packCardId)}` +
    `&condition=perfect&page=1&pageSize=50`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  return parsePerfectProducts(await res.json());
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/kapai/market.test.ts`
Expected: PASS（既有快取/行情測試 + 新 parse/snapshot 全綠）。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/kapai/market.ts backend/src/lib/kapai/market.test.ts
git commit -m "feat(kapai): 抽 parsePerfectProducts + fetchPerfectSnapshot（surge 取最低掛單）"
```

---

### Task 7: `fetchSurgeSeries`（抓成交序列）

**Files:**
- Modify: `backend/src/lib/kapai/huca-raw.ts`

- [ ] **Step 1: 實作** — 在 `huca-raw.ts` 檔尾加（沿用既有 `UA`、`RAW_GRADE_KEY`）

```ts
/**
 * 取某卡的 snkrdunk 裸卡成交走勢原始序列 [ts(ms), priceJPY][]（grade 18）。
 * 供 computeSurge 判斷跳漲。失敗或格式異常回空陣列。
 */
export async function fetchSurgeSeries(snkrdunkId: number): Promise<[number, number][]> {
  const res = await fetch(`https://huca.tw/api/get_snkrdunk_chart.php?snkrdunk_id=${snkrdunkId}&mode=all`, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const json: any = await res.json();
  const series = json?.[RAW_GRADE_KEY];
  return Array.isArray(series) ? (series as [number, number][]) : [];
}
```

- [ ] **Step 2: 型別檢查**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/kapai/huca-raw.ts
git commit -m "feat(kapai): fetchSurgeSeries 抓 snkrdunk 成交走勢序列"
```

---

### Task 8: `surge.ts` 主流程 `detectSurges()`

**Files:**
- Create: `backend/src/lib/kapai/surge.ts`

- [ ] **Step 1: 建檔** — `backend/src/lib/kapai/surge.ts`

```ts
import { prisma } from '../prisma';
import { computeSurge, pickSurgeDeal } from './logic';
import { fetchSurgeSeries } from './huca-raw';
import { fetchPerfectSnapshot } from './market';
import { buildText, pushTelegram, type AlertListing } from './notifier';
import { loadConfig } from './config';

const CONCURRENCY = 10; // 與主偵測一致：並行 10 路打 Huca/卡拍拍

/** 由 HucaCard 的 setCode+番號，還原卡拍拍 packId/packCardId/game（取番號數字對齊的最近一筆掛單）。 */
async function findKapaiCard(setCode: string, cardNumber: string) {
  const num = parseInt(cardNumber, 10);
  if (Number.isNaN(num)) return null;
  const rows = await prisma.kapaiListing.findMany({
    where: { setCode },
    orderBy: { scrapedAt: 'desc' },
    select: { game: true, cardNumber: true, cardKey: true },
  });
  const hit = rows.find((r) => parseInt(r.cardNumber, 10) === num);
  return hit ? { game: hit.game, packId: setCode, packCardId: hit.cardNumber, cardKey: hit.cardKey } : null;
}

/**
 * 行情跳漲撿漏（並行）：掃高價值美日卡的 Huca 成交序列，
 * 「漲價＋熱度」雙跳漲者，回抓卡拍拍目前最低 perfect 掛單，用 surge 專用門檻判套利。
 * 命中 → upsert 掛單 + 建 ArbitrageAlert(source='surge') + 即時推 Telegram（LINE 走批次）。
 * 去重靠 ArbitrageAlert.listingId unique；單卡失敗不影響整輪。
 */
export async function detectSurges(): Promise<{ scanned: number; surged: number; detected: number }> {
  const { params, surge } = await loadConfig();
  if (!surge.enabled) return { scanned: 0, surged: 0, detected: 0 };

  const cards = await prisma.hucaCard.findMany({
    where: { rawPriceTwd: { gte: surge.minBaseline }, snkrdunkId: { not: null } },
    select: { snkrdunkId: true, setCode: true, cardNumber: true },
  });

  let surged = 0;
  let detected = 0;
  let idx = 0;
  async function worker() {
    while (idx < cards.length) {
      const c = cards[idx++];
      try {
        const series = await fetchSurgeSeries(c.snkrdunkId!);
        const s = computeSurge(series, surge, Date.now());
        if (!s.surged || s.recentMedianTwd < surge.minBaseline) continue;
        surged++;

        const map = await findKapaiCard(c.setCode, c.cardNumber);
        if (!map) continue;
        const listings = await fetchPerfectSnapshot(map.game, map.packId, map.packCardId);
        if (!listings || listings.length === 0) continue;

        const deal = pickSurgeDeal(listings, s.recentMedianTwd, {
          discountThreshold: surge.discountThreshold,
          minProfit: surge.minProfit,
          minMarketValue: surge.minBaseline,
          minSamples: params.minSamples,
        });
        if (!deal) continue;

        const l = deal.listing;
        const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
        if (existing) continue; // 兩軌去重：已建過就不重複

        await prisma.kapaiListing.upsert({
          where: { id: l.id },
          update: { price: l.price, stock: l.stock, processed: true },
          create: {
            id: l.id, game: l.game, cardKey: map.cardKey, setCode: l.packId, cardNumber: l.packCardId,
            name: l.productKey, packName: l.packName, rarity: l.rare, price: l.price, stock: l.stock,
            condition: l.condition, sellerId: l.sellerId, sellerNickname: l.sellerNickname,
            sellerArea: l.sellerArea, listedAt: l.createdTime ? new Date(l.createdTime) : new Date(),
            processed: true,
          },
        });
        await prisma.arbitrageAlert.create({
          data: {
            listingId: l.id, cardKey: map.cardKey, game: l.game, price: l.price,
            baseline: s.recentMedianTwd, discount: deal.discount, profit: deal.profit,
            source: 'surge', notified: false,
          },
        });
        const alertListing: AlertListing = {
          id: l.id, game: l.game, name: l.productKey, packName: l.packName, cardKey: map.cardKey,
          condition: l.condition, price: l.price, sellerId: l.sellerId,
          sellerNickname: l.sellerNickname, sellerArea: l.sellerArea,
        };
        await pushTelegram(buildText(alertListing, s.recentMedianTwd, { surge: true }));
        detected++;
      } catch {
        // 單卡失敗不影響整輪
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { scanned: cards.length, surged, detected };
}
```

- [ ] **Step 2: 型別檢查**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤（`AlertListing` 由 notifier 匯出、`prisma.arbitrageAlert` 已含 `source` 欄）。

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/kapai/surge.ts
git commit -m "feat(kapai): detectSurges 行情跳漲撿漏主流程"
```

---

### Task 9: cron 每小時 surge schedule

**Files:**
- Modify: `backend/src/lib/kapai/cron.ts`

- [ ] **Step 1: 實作** — `cron.ts` 加 import 與 schedule

```ts
import cron from 'node-cron';
import { runMonitorCycle } from './runner';
import { runPushBatch } from './pusher';
import { detectSurges } from './surge';
```

在既有兩個 `cron.schedule` 之後加：

```ts
  // 行情跳漲撿漏：每小時掃高價值美日卡成交跳漲、回抓最低掛單（surge.enabled 由 config 控制）
  cron.schedule('0 * * * *', () => {
    detectSurges()
      .then((r) => console.log(`[kapai] surge scanned=${r.scanned} surged=${r.surged} detected=${r.detected}`))
      .catch((e) => console.error('[kapai] surge error', e));
  });
```

並把啟動 log 補上 surge：

```ts
  console.log('[kapai] monitor enabled — 全量重偵測每20分鐘、行情跳漲每小時、LINE批次每20分鐘');
```

- [ ] **Step 2: 型別檢查**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/kapai/cron.ts
git commit -m "feat(kapai): 每小時跑 detectSurges 行情跳漲偵測"
```

---

### Task 10: 後台 surge 設定驗證（backend）

**Files:**
- Modify: `backend/src/controllers/kapai-admin.ts:16-37`

- [ ] **Step 1: 實作** — `adminPutKapaiConfig` 在既有 scrapeWindows 驗證後、`saveConfig` 前加 surge 驗證

```ts
  if (b.surge) {
    const sg = b.surge;
    if (typeof sg.enabled !== 'boolean') {
      res.status(400).json({ error: 'surge.enabled 必須是 true/false' }); return;
    }
    for (const k of ['recentDays', 'priorDays', 'minRecentCount', 'minBaseline', 'minProfit'] as const) {
      if (typeof sg[k] !== 'number' || sg[k] < 0) {
        res.status(400).json({ error: `surge.${k} 必須是 ≥ 0 的數字` }); return;
      }
    }
    for (const k of ['priceSurgeRatio', 'volSurgeRatio'] as const) {
      if (typeof sg[k] !== 'number' || sg[k] <= 0) {
        res.status(400).json({ error: `surge.${k} 必須 > 0` }); return;
      }
    }
    if (typeof sg.discountThreshold !== 'number' || sg.discountThreshold <= 0 || sg.discountThreshold > 1) {
      res.status(400).json({ error: 'surge.discountThreshold 必須在 0–1 之間' }); return;
    }
  }
```

- [ ] **Step 2: 型別檢查**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/kapai-admin.ts
git commit -m "feat(kapai): 後台 surge 設定欄位驗證"
```

---

### Task 11: 後台 surge 設定區（frontend）

**Files:**
- Modify: `frontend/src/pages/admin/AdminKapaiSettings.tsx`

- [ ] **Step 1: 加型別與 setter** — `KapaiConfig` interface 加 surge，新增 `setSurge`

interface 內加：

```ts
  surge: {
    enabled: boolean; recentDays: number; priorDays: number; priceSurgeRatio: number;
    volSurgeRatio: number; minRecentCount: number; minBaseline: number;
    discountThreshold: number; minProfit: number;
  };
```

在 `setPush` 之後加：

```ts
  const setSurge = (k: keyof KapaiConfig['surge'], v: number | boolean) => config && setConfig({ ...config, surge: { ...config.surge, [k]: v } });
```

- [ ] **Step 2: 加設定區 JSX** — 在「③ 推播」區塊之後、儲存按鈕之前插入

```tsx
      {/* ④ 行情跳漲偵測（美日卡） */}
      <div style={sectionT}>④ 行情跳漲偵測（美日卡）</div>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>每小時掃高價值美日卡：Huca 成交「漲價＋熱度」雙跳漲，就回抓卡拍拍目前最低掛單算獲利。</p>
      <label style={{ ...label, cursor: readOnly ? 'default' : 'pointer' }}>
        <input type="checkbox" checked={config.surge.enabled} disabled={readOnly} onChange={e => setSurge('enabled', e.target.checked)} />
        啟用行情跳漲偵測
      </label>
      <div style={label}>近期視窗 {num(config.surge.recentDays, v => setSurge('recentDays', v), 64)} 天，對照視窗 {num(config.surge.priorDays, v => setSurge('priorDays', v), 64)} 天</div>
      <div style={label}>漲價倍數 近期中位 ≥ 對照 × {num(config.surge.priceSurgeRatio, v => setSurge('priceSurgeRatio', v), 64)}</div>
      <div style={label}>熱度倍數 近期週量 ≥ 對照週均 × {num(config.surge.volSurgeRatio, v => setSurge('volSurgeRatio', v), 64)}</div>
      <div style={label}>近期最少成交筆數 {num(config.surge.minRecentCount, v => setSurge('minRecentCount', v), 64)}</div>
      <div style={label}>只看新行情 ≥ {num(config.surge.minBaseline, v => setSurge('minBaseline', v))} 元（高價值卡）</div>
      <div style={label}>最低掛單 ≤ 新行情的 {num(Math.round(config.surge.discountThreshold * 100), v => setSurge('discountThreshold', v / 100), 64)} %</div>
      <div style={label}>最低省額 {num(config.surge.minProfit, v => setSurge('minProfit', v))} 元</div>
```

- [ ] **Step 3: 前端建置檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminKapaiSettings.tsx
git commit -m "feat(kapai): 後台加行情跳漲偵測設定區"
```

---

### Task 12: 全量驗證

**Files:** 無（驗證）

- [ ] **Step 1: 後端全測 + 型別**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 全綠、無型別錯誤。

- [ ] **Step 2: 前端型別 + 建置**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 建置成功。

- [ ] **Step 3: 起伺服器煙霧測試（可選）**

Run: `cd backend && KAPAI_MONITOR_ENABLED=false npm run dev`（確認載入無爆、import 圖無循環錯）；確認後 Ctrl-C。
Expected: server 正常啟動、無 `surge`/import 相關錯誤。

---

## 部署（依專案規則：先 dev／staging，用戶確認後 main／prod）

1. 上面所有 commit 已在本 worktree 分支；推到 `dev` 觸發 staging（Vercel dev + Railway `pptcg-backend-staging`）。staging Neon（ep-rough-butterfly）已於 Task 4 `db push`。
2. 在 dev 預覽（https://pptcg-dev.vercel.app 後台「卡報報設定」）確認「④ 行情跳漲偵測」可讀可存。
3. 用戶確認後 merge `main`：
   - 對 **prod Neon（ep-autumn-dream）** 跑一次 `DATABASE_URL=<prod> npx prisma db push`（加 `source` 欄）。
   - 正式機 `KAPAI_MONITOR_ENABLED=true` 才會啟動 cron；`surge.enabled` 預設 true。
4. 上線後觀察一輪 surge log（`[kapai] surge scanned=.. surged=.. detected=..`）確認有掃到候選卡。

---

## Self-Review

**Spec 覆蓋：**
- 觸發（漲價＋熱度）→ Task 1 `computeSurge` ✓
- 範圍（rawPriceTwd ≥ minBaseline 高價值卡）→ Task 8 candidates query ✓
- 回抓最低掛單 + 專用門檻 → Task 6 `fetchPerfectSnapshot` + Task 2 `pickSurgeDeal` + Task 8 ✓
- 新基準用近期中位 → Task 1 `recentMedianTwd` ✓
- 後台可調 → Task 3 config + Task 10 驗證 + Task 11 UI ✓
- source 欄去重區分 → Task 4 ✓
- 通知標記 → Task 5 ✓
- 每小時 cron + enabled 開關 → Task 9 + Task 8 早退 ✓
- 稀有度防呆（重用 isHucaBaselineReliable）→ Task 2 ✓
- 部署 db push staging+prod → Task 4 + 部署段 ✓

**Placeholder scan：** 無 TBD/TODO；每個 code step 均為完整可貼上程式碼。

**型別一致性：**
- `computeSurge(series, SurgeComputeParams, now)` — config `SurgeConfig` 結構含其全部欄位，Task 8 直接傳 `surge` ✓
- `pickSurgeDeal(listings, baseline, KapaiArbParams)` 泛型回傳含完整 `PerfectListing`；Task 8 用 `params.minSamples` 經由傳入的 params 物件 ✓
- `fetchPerfectSnapshot` 回 `PerfectListing[] | null`，欄位涵蓋 Task 8 upsert/AlertListing 所需（productKey/packName/packId/packCardId/seller*/stock/createdTime）✓
- `buildText(listing, baseline, opts?)` 第三參數選用，既有呼叫端（detector/pusher）不需改 ✓
- `ArbitrageAlert.source` 於 Task 4 加欄，Task 8 create 才使用，順序正確 ✓
