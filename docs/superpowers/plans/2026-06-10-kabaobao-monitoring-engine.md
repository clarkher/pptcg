# 卡報報監控引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每 5 分鐘爬卡拍拍最新商品累積行情，偵測明顯低於行情的套利機會並 LINE 推播給綁定用戶，後台可檢視。

**Architecture:** 站內同卡比價 — 爬 `listLatestProduct` 入庫 `KapaiListing`，依同卡（`packId-packCardId`）近 14 天售價中位數建 `KapaiBaseline`，未處理商品低於基準達門檻則建 `ArbitrageAlert` 並推播。純計算邏輯抽到 `lib/kapai/logic.ts` 做 TDD，I/O 與排程在其他檔案。

**Tech Stack:** TypeScript, Express, Prisma (Neon Postgres), vitest, node-cron, LINE Messaging API。

設計依據：`docs/superpowers/specs/2026-06-10-kabaobao-monitoring-engine-design.md`、記憶 `kapaipai-api`。

---

### Task 1: 資料模型（3 張新表）

**Files:**
- Modify: `backend/prisma/schema.prisma`（檔尾新增 3 個 model）

- [ ] **Step 1: 在 schema.prisma 檔尾新增 model**

```prisma
model KapaiListing {
  id             Int      @id
  game           String
  cardKey        String
  setCode        String
  cardNumber     String
  name           String
  packName       String
  rarity         String
  price          Int
  stock          Int
  condition      String
  sellerId       Int
  sellerNickname String
  sellerArea     String
  listedAt       DateTime
  scrapedAt      DateTime @default(now())
  processed      Boolean  @default(false)
  @@index([cardKey, condition])
  @@index([scrapedAt])
  @@index([processed])
}

model KapaiBaseline {
  id         String   @id @default(cuid())
  cardKey    String
  condition  String
  game       String
  median     Int
  sampleSize Int
  updatedAt  DateTime @updatedAt
  @@unique([cardKey, condition])
  @@index([cardKey])
}

model ArbitrageAlert {
  id        String   @id @default(cuid())
  listingId Int      @unique
  cardKey   String
  game      String
  price     Int
  baseline  Int
  discount  Float
  profit    Int
  pushedAt  DateTime @default(now())
  @@index([pushedAt])
}
```

- [ ] **Step 2: 推到 staging DB 並生成 client**

Run: `cd backend && DATABASE_URL=$(cd /Users/hepinru/PPTCG && railway variables -s pptcg-backend-staging --kv | grep '^DATABASE_URL=' | cut -d= -f2-) npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema` + `Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(kapai): 新增 KapaiListing/KapaiBaseline/ArbitrageAlert 表"
```

---

### Task 2: 純計算邏輯（TDD）

**Files:**
- Create: `backend/src/lib/kapai/logic.ts`
- Test: `backend/src/lib/kapai/logic.test.ts`

- [ ] **Step 1: 寫失敗測試**

```typescript
// backend/src/lib/kapai/logic.test.ts
import { describe, it, expect } from 'vitest';
import { median, buildCardKey, isArbitrage, DEFAULT_PARAMS } from './logic';

describe('median', () => {
  it('空陣列回 0', () => expect(median([])).toBe(0));
  it('單筆', () => expect(median([50])).toBe(50));
  it('奇數筆取中間', () => expect(median([10, 30, 20])).toBe(20));
  it('偶數筆取中間兩數平均（四捨五入）', () => expect(median([10, 20, 30, 50])).toBe(25));
});

describe('buildCardKey', () => {
  it('正常組合', () => expect(buildCardKey('M5', '065')).toBe('M5-065'));
  it('空 packId 回 null', () => expect(buildCardKey('', '065')).toBeNull());
  it('空 packCardId 回 null', () => expect(buildCardKey('M5', '')).toBeNull());
  it('去除前後空白', () => expect(buildCardKey(' M5 ', ' 065 ')).toBe('M5-065'));
});

describe('isArbitrage', () => {
  const p = DEFAULT_PARAMS; // discountThreshold 0.7, minProfit 100, minSampleSize 5
  it('樣本不足回 false', () => expect(isArbitrage({ price: 10, baseline: 1000, sampleSize: 4 }, p)).toBe(false));
  it('baseline 0 回 false', () => expect(isArbitrage({ price: 10, baseline: 0, sampleSize: 9 }, p)).toBe(false));
  it('價格高於門檻回 false', () => expect(isArbitrage({ price: 800, baseline: 1000, sampleSize: 9 }, p)).toBe(false));
  it('價差不足回 false', () => expect(isArbitrage({ price: 650, baseline: 700, sampleSize: 9 }, p)).toBe(false));
  it('命中回 true', () => expect(isArbitrage({ price: 500, baseline: 1000, sampleSize: 9 }, p)).toBe(true));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/kapai/logic.test.ts`
Expected: FAIL（`Cannot find module './logic'`）

- [ ] **Step 3: 寫實作**

```typescript
// backend/src/lib/kapai/logic.ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/kapai/logic.test.ts`
Expected: PASS（13 個測試）

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/kapai/logic.ts backend/src/lib/kapai/logic.test.ts
git commit -m "feat(kapai): 套利計算純邏輯（median/buildCardKey/isArbitrage）+ 測試"
```

---

### Task 3: 爬蟲入庫 service

**Files:**
- Create: `backend/src/lib/kapai/scraper.ts`

- [ ] **Step 1: 寫實作**

```typescript
// backend/src/lib/kapai/scraper.ts
import { prisma } from '../prisma';
import { buildCardKey } from './logic';

const LATEST_URL = 'https://trade.kapaipai.tw/api/product/listLatestProduct';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface RawProduct {
  id: number; game: string; productKey: string; price: string; stock: number;
  condition: string; rare: string; packId: string; packCardId: string; packName: string;
  sellerId: number; sellerNickname: string; sellerArea: string; createdTime: string;
}

export async function fetchLatestProducts(): Promise<RawProduct[]> {
  const res = await fetch(LATEST_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`kapai listLatestProduct HTTP ${res.status}`);
  const json: any = await res.json();
  return (json?.data?.products ?? []) as RawProduct[];
}

export async function ingestLatest(): Promise<{ scraped: number; saved: number; skipped: number }> {
  const products = await fetchLatestProducts();
  let saved = 0, skipped = 0;
  for (const p of products) {
    const cardKey = buildCardKey(p.packId, p.packCardId);
    if (!cardKey) { skipped++; continue; }
    const price = parseInt(p.price, 10);
    if (Number.isNaN(price)) { skipped++; continue; }
    const base = {
      game: p.game, cardKey, setCode: p.packId, cardNumber: p.packCardId,
      name: p.productKey, packName: p.packName ?? '', rarity: p.rare ?? '',
      price, stock: p.stock ?? 0, condition: p.condition ?? 'unknown',
      sellerId: p.sellerId ?? 0, sellerNickname: p.sellerNickname ?? '',
      sellerArea: p.sellerArea ?? '', listedAt: new Date(p.createdTime),
    };
    await prisma.kapaiListing.upsert({
      where: { id: p.id },
      update: { price: base.price, stock: base.stock },
      create: { id: p.id, ...base, processed: false },
    });
    saved++;
  }
  return { scraped: products.length, saved, skipped };
}
```

- [ ] **Step 2: 實跑驗證（抓真資料入 staging）**

Run: `cd backend && DATABASE_URL=$(cd /Users/hepinru/PPTCG && railway variables -s pptcg-backend-staging --kv | grep '^DATABASE_URL=' | cut -d= -f2-) npx ts-node -e "import('./src/lib/kapai/scraper').then(m=>m.ingestLatest()).then(r=>{console.log(r);process.exit(0)})"`
Expected: 印出 `{ scraped: 250, saved: <~200>, skipped: <剩餘> }`（skipped 是套牌/自訂名）

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/kapai/scraper.ts
git commit -m "feat(kapai): listLatestProduct 爬蟲入庫 service"
```

---

### Task 4: 基準價計算

**Files:**
- Create: `backend/src/lib/kapai/baseline.ts`

- [ ] **Step 1: 寫實作**

```typescript
// backend/src/lib/kapai/baseline.ts
import { prisma } from '../prisma';
import { median } from './logic';

const WINDOW_DAYS = 14;

/** 重算單一 (cardKey, condition) 的基準價，寫入 KapaiBaseline */
export async function recomputeBaseline(cardKey: string, condition: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.kapaiListing.findMany({
    where: { cardKey, condition, scrapedAt: { gte: since } },
    select: { price: true, game: true },
  });
  if (rows.length === 0) return;
  const m = median(rows.map((r) => r.price));
  await prisma.kapaiBaseline.upsert({
    where: { cardKey_condition: { cardKey, condition } },
    update: { median: m, sampleSize: rows.length, game: rows[0].game },
    create: { cardKey, condition, game: rows[0].game, median: m, sampleSize: rows.length },
  });
}

/** 重算所有「目前有未處理商品」涉及的卡的基準 */
export async function recomputePendingBaselines(): Promise<number> {
  const pairs = await prisma.kapaiListing.findMany({
    where: { processed: false },
    select: { cardKey: true, condition: true },
    distinct: ['cardKey', 'condition'],
  });
  for (const { cardKey, condition } of pairs) {
    await recomputeBaseline(cardKey, condition);
  }
  return pairs.length;
}
```

- [ ] **Step 2: 實跑驗證**

Run: `cd backend && DATABASE_URL=$(cd /Users/hepinru/PPTCG && railway variables -s pptcg-backend-staging --kv | grep '^DATABASE_URL=' | cut -d= -f2-) npx ts-node -e "import('./src/lib/kapai/baseline').then(m=>m.recomputePendingBaselines()).then(n=>{console.log('baselines for',n,'card-condition pairs');process.exit(0)})"`
Expected: 印出 `baselines for <N> card-condition pairs`（N > 0）

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/kapai/baseline.ts
git commit -m "feat(kapai): 同卡近14天售價中位數基準計算"
```

---

### Task 5: 套利偵測 + LINE 推播

**Files:**
- Modify: `backend/src/controllers/line.ts`（將 `linePush` 改 `export`）
- Create: `backend/src/lib/kapai/notifier.ts`
- Create: `backend/src/lib/kapai/detector.ts`

- [ ] **Step 1: 把 line.ts 的 linePush 改成 export**

在 `backend/src/controllers/line.ts` 找到 `async function linePush(` 改為 `export async function linePush(`。（函式本體不動）

- [ ] **Step 2: 寫 notifier.ts**

```typescript
// backend/src/lib/kapai/notifier.ts
import { prisma } from '../prisma';
import { linePush } from '../../controllers/line';

interface AlertListing {
  id: number; name: string; packName: string; cardKey: string;
  condition: string; price: number; sellerNickname: string; sellerArea: string;
}

/** 推播一筆套利機會給所有已綁定 LINE 的用戶 */
export async function pushArbitrage(listing: AlertListing, baselineMedian: number): Promise<void> {
  const token = await prisma.setting.findUnique({ where: { key: 'LINE_CHANNEL_ACCESS_TOKEN' } });
  if (!token?.value) return;
  const users = await prisma.user.findMany({
    where: { lineUid: { not: null } },
    select: { lineUid: true },
  });
  const text =
    `🚨 套利雷達\n\n${listing.name}\n套系：${listing.packName}\n番號：${listing.cardKey}｜品相：${listing.condition}\n\n` +
    `💰 售價 NT$${listing.price}（行情 NT$${baselineMedian}）\n📉 省 NT$${baselineMedian - listing.price}\n` +
    `賣家：${listing.sellerNickname}（${listing.sellerArea}）\n\n` +
    `https://trade.kapaipai.tw/product/${listing.id}`;
  for (const u of users) {
    if (u.lineUid) await linePush(u.lineUid, [{ type: 'text', text }], token.value);
  }
}
```

- [ ] **Step 3: 寫 detector.ts**

```typescript
// backend/src/lib/kapai/detector.ts
import { prisma } from '../prisma';
import { isArbitrage, DEFAULT_PARAMS } from './logic';
import { pushArbitrage } from './notifier';

/** 對所有未處理商品判斷套利、建 alert、推播，最後標記 processed */
export async function detectAndAlert(): Promise<number> {
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let alerts = 0;
  for (const l of pending) {
    const baseline = await prisma.kapaiBaseline.findUnique({
      where: { cardKey_condition: { cardKey: l.cardKey, condition: l.condition } },
    });
    if (
      baseline &&
      isArbitrage({ price: l.price, baseline: baseline.median, sampleSize: baseline.sampleSize }, DEFAULT_PARAMS)
    ) {
      const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
      if (!existing) {
        await prisma.arbitrageAlert.create({
          data: {
            listingId: l.id, cardKey: l.cardKey, game: l.game,
            price: l.price, baseline: baseline.median,
            discount: l.price / baseline.median, profit: baseline.median - l.price,
          },
        });
        await pushArbitrage(l, baseline.median);
        alerts++;
      }
    }
    await prisma.kapaiListing.update({ where: { id: l.id }, data: { processed: true } });
  }
  return alerts;
}
```

- [ ] **Step 4: 型別檢查**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep kapai || echo "no kapai errors"`
Expected: `no kapai errors`

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/line.ts backend/src/lib/kapai/notifier.ts backend/src/lib/kapai/detector.ts
git commit -m "feat(kapai): 套利偵測 + LINE 推播（去重防重複推）"
```

---

### Task 6: 排程串接（runner + cron）

**Files:**
- Create: `backend/src/lib/kapai/runner.ts`
- Create: `backend/src/lib/kapai/cron.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json`（裝 node-cron）

- [ ] **Step 1: 安裝 node-cron**

Run: `cd backend && npm install node-cron && npm install -D @types/node-cron`
Expected: 安裝成功，package.json 出現 `node-cron`

- [ ] **Step 2: 寫 runner.ts**

```typescript
// backend/src/lib/kapai/runner.ts
import { ingestLatest } from './scraper';
import { recomputePendingBaselines } from './baseline';
import { detectAndAlert } from './detector';

export async function runMonitorCycle(): Promise<void> {
  const { scraped, saved, skipped } = await ingestLatest();
  const pairs = await recomputePendingBaselines();
  const alerts = await detectAndAlert();
  console.log(`[kapai] scraped=${scraped} saved=${saved} skipped=${skipped} baselines=${pairs} alerts=${alerts}`);
}
```

- [ ] **Step 3: 寫 cron.ts**

```typescript
// backend/src/lib/kapai/cron.ts
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
```

- [ ] **Step 4: 在 index.ts 掛載**

把 `backend/src/index.ts` 改為：

```typescript
import 'dotenv/config';
import app from './app';
import { startKapaiCron } from './lib/kapai/cron';

const PORT = parseInt(process.env.PORT || '3001');

app.listen(PORT, () => {
  console.log(`🃏 PPTCG API running on http://localhost:${PORT}`);
  startKapaiCron();
});
```

- [ ] **Step 5: 完整跑一輪驗證**

Run: `cd backend && DATABASE_URL=$(cd /Users/hepinru/PPTCG && railway variables -s pptcg-backend-staging --kv | grep '^DATABASE_URL=' | cut -d= -f2-) npx ts-node -e "import('./src/lib/kapai/runner').then(m=>m.runMonitorCycle()).then(()=>process.exit(0))"`
Expected: 印出 `[kapai] scraped=... saved=... skipped=... baselines=... alerts=...`

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/kapai/runner.ts backend/src/lib/kapai/cron.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat(kapai): node-cron 每5分鐘監控排程（KAPAI_MONITOR_ENABLED 控制）"
```

---

### Task 7: 後台 API（卡拍拍商品／套利機會／Huca 行情）

**Files:**
- Modify: `backend/src/controllers/admin.ts`（檔尾新增 3 個 handler）
- Modify: `backend/src/routes/admin.ts`

- [ ] **Step 1: admin.ts 檔尾新增 handler**

```typescript
// ── 卡報報監控檢視 ───────────────────────────────────

export async function adminKapaiListings(req: AuthRequest, res: Response) {
  const { q = '', game = '', sort = 'scrapedAt', page = '1', limit = '40' } = req.query as Record<string, string>;
  const where: any = {};
  if (game) where.game = game;
  if (q.trim()) where.OR = [
    { name: { contains: q.trim(), mode: 'insensitive' } },
    { cardKey: { contains: q.trim(), mode: 'insensitive' } },
  ];
  const orderBy: any =
    sort === 'price' ? { price: 'asc' } : { scrapedAt: 'desc' };
  const take = parseInt(limit, 10); const skip = (parseInt(page, 10) - 1) * take;
  const [rows, total] = await Promise.all([
    prisma.kapaiListing.findMany({ where, orderBy, take, skip }),
    prisma.kapaiListing.count({ where }),
  ]);
  res.json({ listings: rows, total, page: parseInt(page, 10), pages: Math.ceil(total / take) });
}

export async function adminKapaiAlerts(req: AuthRequest, res: Response) {
  const { page = '1', limit = '40' } = req.query as Record<string, string>;
  const take = parseInt(limit, 10); const skip = (parseInt(page, 10) - 1) * take;
  const [rows, total] = await Promise.all([
    prisma.arbitrageAlert.findMany({ orderBy: { pushedAt: 'desc' }, take, skip }),
    prisma.arbitrageAlert.count(),
  ]);
  res.json({ alerts: rows, total, page: parseInt(page, 10), pages: Math.ceil(total / take) });
}

export async function adminHucaCards(req: AuthRequest, res: Response) {
  const { q = '', setCode = '', hasPrice = '', sort = 'updated', page = '1', limit = '40' } = req.query as Record<string, string>;
  const where: any = {};
  if (setCode) where.setCode = setCode;
  if (hasPrice === 'true') where.lowPriceTwd = { not: null };
  if (q.trim()) where.OR = [
    { nameZh: { contains: q.trim(), mode: 'insensitive' } },
    { sku: { contains: q.trim(), mode: 'insensitive' } },
  ];
  const orderBy: any =
    sort === 'price' ? { lowPriceTwd: 'asc' } :
    sort === 'offers' ? { offerCount: 'desc' } : { priceUpdatedAt: 'desc' };
  const take = parseInt(limit, 10); const skip = (parseInt(page, 10) - 1) * take;
  const [rows, total, withPrice, highLiq] = await Promise.all([
    prisma.hucaCard.findMany({ where, orderBy, take, skip }),
    prisma.hucaCard.count({ where }),
    prisma.hucaCard.count({ where: { lowPriceTwd: { not: null } } }),
    prisma.hucaCard.count({ where: { offerCount: { gte: 10 } } }),
  ]);
  res.json({ cards: rows, total, withPrice, highLiq, page: parseInt(page, 10), pages: Math.ceil(total / take) });
}
```

- [ ] **Step 2: routes/admin.ts 新增路由**

在 `backend/src/routes/admin.ts` 的 import 區把這三個加入既有 `from '../controllers/admin'`：`adminKapaiListings, adminKapaiAlerts, adminHucaCards`。然後在 `export default router;` 前加：

```typescript
// 卡報報監控檢視
router.get('/kapai/listings', ...guard, adminKapaiListings);
router.get('/kapai/alerts', ...guard, adminKapaiAlerts);
router.get('/huca', ...guard, adminHucaCards);
```

- [ ] **Step 3: 型別檢查**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep -E "admin|kapai|huca" || echo "no errors"`
Expected: `no errors`

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/admin.ts backend/src/routes/admin.ts
git commit -m "feat(kapai): 後台 API — 卡拍拍商品/套利機會/Huca 行情"
```

---

### Task 8: 後台前端頁

**Files:**
- Create: `frontend/src/pages/admin/AdminKapai.tsx`
- Create: `frontend/src/pages/admin/AdminHuca.tsx`
- Modify: `frontend/src/pages/admin/AdminLayout.tsx`（nav 加兩個入口）
- Modify: `frontend/src/App.tsx`（route 加兩頁）

- [ ] **Step 1: AdminKapai.tsx（兩分頁：商品／機會）**

```tsx
// frontend/src/pages/admin/AdminKapai.tsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Listing { id: number; game: string; cardKey: string; name: string; packName: string; price: number; condition: string; sellerNickname: string; sellerArea: string; scrapedAt: string; }
interface Alert { id: string; listingId: number; cardKey: string; game: string; price: number; baseline: number; profit: number; discount: number; pushedAt: string; }

export default function AdminKapai() {
  const [tab, setTab] = useState<'listings' | 'alerts'>('alerts');
  const [listings, setListings] = useState<Listing[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (tab === 'listings') api.get('/admin/kapai/listings', { params: { q } }).then(r => setListings(r.data.listings)).catch(() => {});
    else api.get('/admin/kapai/alerts').then(r => setAlerts(r.data.alerts)).catch(() => {});
  }, [tab, q]);

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const th: React.CSSProperties = { ...cell, color: '#64748B', fontWeight: 700, textAlign: 'left' };

  return (
    <div style={{ maxWidth: 960, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 16 }}>卡報報監控</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['alerts', 'listings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: '1px solid rgba(124,58,237,0.3)',
            background: tab === t ? 'rgba(124,58,237,0.18)' : 'transparent',
            color: tab === t ? '#C4B5FD' : '#475569',
          }}>{t === 'alerts' ? '套利機會' : '卡拍拍商品'}</button>
        ))}
      </div>

      {tab === 'alerts' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>番號</th><th style={th}>售價</th><th style={th}>行情</th><th style={th}>省</th><th style={th}>折扣</th><th style={th}>推播時間</th><th style={th}></th></tr></thead>
          <tbody>{alerts.map(a => (
            <tr key={a.id}>
              <td style={cell}>{a.cardKey}</td>
              <td style={{ ...cell, color: '#4ADE80', fontWeight: 700 }}>NT${a.price}</td>
              <td style={cell}>NT${a.baseline}</td>
              <td style={{ ...cell, color: '#F87171' }}>NT${a.profit}</td>
              <td style={cell}>{Math.round(a.discount * 100)}%</td>
              <td style={cell}>{new Date(a.pushedAt).toLocaleString('zh-TW')}</td>
              <td style={cell}><a href={`https://trade.kapaipai.tw/product/${a.listingId}`} target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>↗</a></td>
            </tr>
          ))}</tbody>
        </table>
      ) : (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋番號/名稱"
            style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', fontSize: 13, width: 240 }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>番號</th><th style={th}>名稱</th><th style={th}>售價</th><th style={th}>品相</th><th style={th}>賣家</th><th style={th}>上架</th><th style={th}></th></tr></thead>
            <tbody>{listings.map(l => (
              <tr key={l.id}>
                <td style={cell}>{l.cardKey}</td>
                <td style={cell}>{l.name}</td>
                <td style={{ ...cell, fontWeight: 700 }}>NT${l.price}</td>
                <td style={cell}>{l.condition}</td>
                <td style={cell}>{l.sellerNickname}（{l.sellerArea}）</td>
                <td style={cell}>{new Date(l.scrapedAt).toLocaleString('zh-TW')}</td>
                <td style={cell}><a href={`https://trade.kapaipai.tw/product/${l.id}`} target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>↗</a></td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: AdminHuca.tsx（純檢視 Huca 行情）**

```tsx
// frontend/src/pages/admin/AdminHuca.tsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface HucaCard { id: number; setCode: string; cardNumber: string; nameZh: string; sku: string; slug: string; lowPriceTwd: number | null; highPriceTwd: number | null; offerCount: number | null; priceUpdatedAt: string | null; }

export default function AdminHuca() {
  const [cards, setCards] = useState<HucaCard[]>([]);
  const [stats, setStats] = useState({ total: 0, withPrice: 0, highLiq: 0 });
  const [q, setQ] = useState('');
  const [hasPrice, setHasPrice] = useState(true);
  const [sort, setSort] = useState('updated');

  useEffect(() => {
    api.get('/admin/huca', { params: { q, hasPrice: String(hasPrice), sort } })
      .then(r => { setCards(r.data.cards); setStats({ total: r.data.total, withPrice: r.data.withPrice, highLiq: r.data.highLiq }); })
      .catch(() => {});
  }, [q, hasPrice, sort]);

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const th: React.CSSProperties = { ...cell, color: '#64748B', fontWeight: 700, textAlign: 'left' };
  const stat = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{val.toLocaleString()}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 960, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 16 }}>Huca 行情</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {stat('📦 總卡數', stats.total, '#F1F5F9')}
        {stat('💰 有價格', stats.withPrice, '#4ADE80')}
        {stat('🔥 高流動性', stats.highLiq, '#F59E0B')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋繁中名/SKU"
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', fontSize: 13, width: 220 }} />
        <label style={{ fontSize: 13, color: '#94A3B8', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={hasPrice} onChange={e => setHasPrice(e.target.checked)} /> 只看有價格
        </label>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', fontSize: 13 }}>
          <option value="updated">最近更新</option>
          <option value="price">低價優先</option>
          <option value="offers">成交數多</option>
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>番號</th><th style={th}>繁中名</th><th style={th}>低價</th><th style={th}>高價</th><th style={th}>成交數</th><th style={th}>更新</th><th style={th}></th></tr></thead>
        <tbody>{cards.map(c => (
          <tr key={c.id}>
            <td style={cell}>{c.setCode}-{c.cardNumber}</td>
            <td style={cell}>{c.nameZh}</td>
            <td style={{ ...cell, color: '#4ADE80' }}>{c.lowPriceTwd != null ? `NT$${c.lowPriceTwd}` : '—'}</td>
            <td style={cell}>{c.highPriceTwd != null ? `NT$${c.highPriceTwd}` : '—'}</td>
            <td style={cell}>{c.offerCount ?? '—'}</td>
            <td style={cell}>{c.priceUpdatedAt ? new Date(c.priceUpdatedAt).toLocaleDateString('zh-TW') : '—'}</td>
            <td style={cell}><a href={`https://huca.tw/cards/${c.id}/`} target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>↗</a></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: AdminLayout.tsx nav 加兩個入口**

在 `frontend/src/pages/admin/AdminLayout.tsx` 的 `import { ... } from 'lucide-react'` 補上 `Radar, TrendingUp`。然後在 `NAV` 陣列的 `{ path: '/admin/line-settings', ... }` 那行**之前**插入：

```tsx
  { path: '/admin/kapai',  label: '卡報報監控', icon: <Radar size={16} /> },
  { path: '/admin/huca',   label: 'Huca 行情',  icon: <TrendingUp size={16} /> },
```

- [ ] **Step 4: App.tsx 加 route**

在 `frontend/src/App.tsx` 的 import 區加：

```tsx
import AdminKapai from './pages/admin/AdminKapai';
import AdminHuca from './pages/admin/AdminHuca';
```

在 `<Route path="line-settings" element={<AdminLineSettings />} />` 那行之後加：

```tsx
            <Route path="kapai" element={<AdminKapai />} />
            <Route path="huca" element={<AdminHuca />} />
```

- [ ] **Step 5: 型別檢查**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -10`
Expected: 無輸出（乾淨）

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/AdminKapai.tsx frontend/src/pages/admin/AdminHuca.tsx frontend/src/pages/admin/AdminLayout.tsx frontend/src/App.tsx
git commit -m "feat(kapai): 後台前端 — 卡報報監控頁 + Huca 行情頁"
```

---

## 部署與啟用

1. 上述都在 `dev` 分支完成、push，dev 環境（staging 後端）會自動部署。
2. 在 staging 後端設環境變數啟用 cron：
   `cd /Users/hepinru/PPTCG && railway variables -s pptcg-backend-staging --set KAPAI_MONITOR_ENABLED=true`，重啟服務。
3. 觀察 staging log：每 5 分鐘應出現 `[kapai] scraped=...` 行。累積數天讓基準成形後，調整參數。
4. 穩定後再 merge `main`、在正式機後端設 `KAPAI_MONITOR_ENABLED=true`（只在單一環境開，避免雙推播）。
