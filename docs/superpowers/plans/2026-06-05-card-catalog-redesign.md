# 卡片目錄瀏覽改版 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把前台改成卡拍拍式「系列→套系」卡片目錄瀏覽（每卡顯示最低價＋剩餘數＋稀有度、可篩有庫存、可敲碗），後台改成對應卡片網格（就地改價量、看敲碗數、手動修目錄資料、稀有度/系列/品相 CRUD、換圖）。

**Architecture:** 沿用既有 Express + Prisma(Postgres) + React/Vite。庫存沿用 `Listing`（加 `variant` 欄位），新增 `Wishlist`/`Notification`/`Rarity`/`Series`/`Condition` 表。瀏覽彙整以 `cardId`（=`PokemonCard.id`）groupBy 後與目錄卡合併。正確性關鍵的純邏輯（彙整、補貨偵測）抽成純函式並以 vitest 單元測試。

**Tech Stack:** Express 4、Prisma 5、Postgres(Neon)、React 19、Vite、Zustand、TypeScript、vitest（新增）。

---

## 前置事實（實作前必讀）

- `Listing.cardId` === `PokemonCard.id`，格式 `"{language}:{setId}-{number}"`（如 `zh:sv1-1`）。來源：`frontend/src/pages/admin/AdminListings.tsx:115` 用 `cardId: selectedCard.id`。
- 後端無 FK 連 `Listing`↔`PokemonCard`，彙整用兩段查詢（先查目錄卡頁、再 `groupBy` listing aggregates）後在記憶體合併。
- 路由掛載前綴 `/api`（`backend/src/app.ts`）。admin 路由經 `middleware/admin.ts` 驗證。
- admin controller 模式見 `backend/src/controllers/admin.ts`；inline router 模式見 `backend/src/routes/pokemon.ts`。
- DB schema 變更用 `npx prisma db push`（專案無 migrations 目錄）。
- 上傳走既有 upload worker：`POST /api/upload`（multipart，回 `{ url }`），見 `backend/src/routes/upload.ts`。
- 前台 API 走 `frontend/src/api/client.ts`（axios，base `/api`，帶 auth interceptor）。

---

## 檔案結構

**後端新增/修改：**
- Modify: `backend/prisma/schema.prisma`（加 variant + 5 個 model）
- Create: `backend/src/lib/inventory.ts`（純函式：彙整、補貨偵測）
- Create: `backend/src/lib/inventory.test.ts`
- Create: `backend/src/controllers/catalog.ts`（前台目錄瀏覽）
- Create: `backend/src/routes/catalog.ts`
- Create: `backend/src/controllers/wishlist.ts`
- Create: `backend/src/routes/wishlist.ts`
- Create: `backend/src/controllers/notifications.ts`
- Create: `backend/src/routes/notifications.ts`
- Create: `backend/src/lib/restock.ts`（補貨通知 service，DB 版）
- Modify: `backend/src/controllers/admin.ts`（庫存/目錄卡/孤兒/敲碗名單）
- Create: `backend/src/controllers/refdata.ts`（Rarity/Series/Condition CRUD）
- Modify: `backend/src/routes/admin.ts`（掛新 admin 端點）
- Modify: `backend/src/app.ts`（掛 catalog/wishlist/notifications 路由）
- Create: `backend/prisma/seed-refdata.ts`（參照表初始資料）
- Modify: `backend/package.json`（加 vitest、seed:refdata script）

**前端新增/修改：**
- Create: `frontend/src/api/catalog.ts`、`wishlist.ts`、`notifications.ts`
- Modify: `frontend/src/api/admin.ts`（加庫存/目錄卡/refdata/敲碗 API）
- Create: `frontend/src/types/catalog.ts`（或併入 types/index.ts）
- Create: `frontend/src/components/SeriesSetNav.tsx`（語言→系列→套系導覽，前後台共用）
- Create: `frontend/src/components/CatalogCard.tsx`（卡片格）
- Create: `frontend/src/pages/Browse.tsx`（取代 Market 為主瀏覽）
- Create: `frontend/src/pages/CardDetail.tsx`（目錄卡詳情 + 變體 + 敲碗）
- Create: `frontend/src/components/NotificationBell.tsx`
- Create: `frontend/src/pages/admin/AdminCatalog.tsx`（後台卡片網格 + inline 改價量 + 敲碗數 + 改目錄資料/換圖）
- Create: `frontend/src/pages/admin/AdminRefData.tsx`（稀有度/系列/品相 CRUD）
- Modify: `frontend/src/App.tsx`（路由）、`frontend/src/components/AppShell.tsx` 或 Header（鈴鐺）、`frontend/src/pages/admin/AdminLayout.tsx`（側欄連結）

---

## Phase 0：測試框架 + Schema

### Task 1: 安裝 vitest

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: 安裝 vitest**

Run: `cd backend && npm i -D vitest`
Expected: 安裝成功，devDependencies 出現 vitest。

- [ ] **Step 2: 加 test script**

在 `backend/package.json` 的 `scripts` 加入：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 驗證可跑**

Run: `cd backend && npx vitest run`
Expected: `No test files found`（尚無測試），指令本身正常結束。

- [ ] **Step 4: Commit**
```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add vitest to backend"
```

---

### Task 2: Prisma schema — variant 欄位 + 5 個 model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Listing 加 variant**

在 `model Listing` 內 `condition` 下方加一行：
```prisma
  variant     String   @default("標準")   // 普通 / 反射閃 / 異圖 / 金卡 ...
```

- [ ] **Step 2: User 加反向關聯**

在 `model User` 內 `sales Order[] @relation("seller")` 下方加：
```prisma
  wishlists     Wishlist[]
  notifications Notification[]
```

- [ ] **Step 3: 加 5 個 model**（檔尾）
```prisma
model Wishlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  cardId    String
  cardName  String
  cardImage String
  language  String
  variant   String?
  notified  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([userId, cardId, variant])
  @@index([cardId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   @default("restock")
  cardId    String
  cardName  String
  cardImage String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
}

model Rarity {
  id        String @id @default(cuid())
  code      String @unique
  label     String
  color     String @default("#64748b")
  sortOrder Int    @default(0)
}

model Series {
  id        String  @id @default(cuid())
  key       String
  name      String
  language  String
  logo      String?
  sortOrder Int     @default(0)

  @@unique([language, key])
}

model Condition {
  id        String @id @default(cuid())
  code      String @unique
  label     String
  sortOrder Int    @default(0)
}
```

- [ ] **Step 4: 推送 schema 並重新生成 client**

Run: `cd backend && npx prisma db push && npx prisma generate`
Expected: `Your database is now in sync`，無錯誤。

> ⚠️ 連線需 `DATABASE_URL`（Neon）。若本機無法連 DB，改在有 env 的環境執行；Prisma client 型別需生成成功後續任務才編得過。

- [ ] **Step 5: Commit**
```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): add variant field + Wishlist/Notification/Rarity/Series/Condition models"
```

---

## Phase 1：純邏輯（TDD）

### Task 3: 庫存彙整純函式

**Files:**
- Create: `backend/src/lib/inventory.ts`
- Test: `backend/src/lib/inventory.test.ts`

- [ ] **Step 1: 寫失敗測試**

`backend/src/lib/inventory.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { aggregateInventory, type InventoryRow } from './inventory';

const rows = (...r: Partial<InventoryRow>[]): InventoryRow[] =>
  r.map((x) => ({ cardId: 'c1', variant: '標準', condition: 'NM', price: 100, quantity: 1, ...x }));

describe('aggregateInventory', () => {
  it('回傳空彙整當無庫存', () => {
    expect(aggregateInventory([])).toEqual({ minPrice: null, totalQty: 0, variantCount: 0 });
  });

  it('單筆庫存', () => {
    expect(aggregateInventory(rows({ price: 120, quantity: 3 }))).toEqual({
      minPrice: 120, totalQty: 3, variantCount: 1,
    });
  });

  it('多變體取最低價、加總數量、算 distinct 變體數', () => {
    const agg = aggregateInventory(rows(
      { variant: '普通', price: 100, quantity: 2 },
      { variant: '反射閃', price: 80, quantity: 1 },
      { variant: '反射閃', price: 90, quantity: 4 },
    ));
    expect(agg).toEqual({ minPrice: 80, totalQty: 7, variantCount: 2 });
  });

  it('忽略數量為 0 的庫存於 totalQty 但仍可計入變體', () => {
    const agg = aggregateInventory(rows(
      { variant: '普通', price: 100, quantity: 0 },
      { variant: '異圖', price: 300, quantity: 2 },
    ));
    expect(agg.totalQty).toBe(2);
    expect(agg.minPrice).toBe(300); // 數量 0 的不報價
    expect(agg.variantCount).toBe(2);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/inventory.test.ts`
Expected: FAIL — `Cannot find module './inventory'`。

- [ ] **Step 3: 實作**

`backend/src/lib/inventory.ts`：
```typescript
export interface InventoryRow {
  cardId: string;
  variant: string;
  condition: string;
  price: number;
  quantity: number;
}

export interface InventoryAgg {
  minPrice: number | null;
  totalQty: number;
  variantCount: number;
}

export function aggregateInventory(rows: InventoryRow[]): InventoryAgg {
  if (rows.length === 0) return { minPrice: null, totalQty: 0, variantCount: 0 };
  const inStock = rows.filter((r) => r.quantity > 0);
  const minPrice = inStock.length ? Math.min(...inStock.map((r) => r.price)) : null;
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const variantCount = new Set(rows.map((r) => r.variant)).size;
  return { minPrice, totalQty, variantCount };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/inventory.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**
```bash
git add backend/src/lib/inventory.ts backend/src/lib/inventory.test.ts
git commit -m "feat: inventory aggregation pure function with tests"
```

---

### Task 4: 補貨偵測純函式

**Files:**
- Modify: `backend/src/lib/inventory.ts`（加 `becameRestocked`）
- Modify: `backend/src/lib/inventory.test.ts`

- [ ] **Step 1: 加失敗測試**

在 `inventory.test.ts` 末尾加：
```typescript
import { becameRestocked } from './inventory';

describe('becameRestocked', () => {
  it('0 → 正數 視為補貨', () => {
    expect(becameRestocked(0, 5)).toBe(true);
  });
  it('正數 → 正數 不算補貨', () => {
    expect(becameRestocked(3, 8)).toBe(false);
  });
  it('正數 → 0 不算補貨', () => {
    expect(becameRestocked(5, 0)).toBe(false);
  });
  it('0 → 0 不算補貨', () => {
    expect(becameRestocked(0, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/inventory.test.ts`
Expected: FAIL — `becameRestocked is not a function`。

- [ ] **Step 3: 實作**

在 `backend/src/lib/inventory.ts` 加：
```typescript
export function becameRestocked(prevTotalQty: number, nextTotalQty: number): boolean {
  return prevTotalQty <= 0 && nextTotalQty > 0;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/inventory.test.ts`
Expected: PASS（8 passed）。

- [ ] **Step 5: Commit**
```bash
git add backend/src/lib/inventory.ts backend/src/lib/inventory.test.ts
git commit -m "feat: restock detection pure function with tests"
```

---

## Phase 2：參照資料 seed + CRUD

### Task 5: 參照表初始資料 seed

**Files:**
- Create: `backend/prisma/seed-refdata.ts`
- Modify: `backend/package.json`（加 script）

- [ ] **Step 1: 寫 seed 腳本**

`backend/prisma/seed-refdata.ts`：
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const RARITIES: { code: string; label: string; color: string; sortOrder: number }[] = [
  { code: 'C', label: '普通 Common', color: '#94a3b8', sortOrder: 10 },
  { code: 'U', label: '罕見 Uncommon', color: '#0891b2', sortOrder: 20 },
  { code: 'R', label: '稀有 Rare', color: '#16a34a', sortOrder: 30 },
  { code: 'RR', label: 'Double Rare', color: '#2563eb', sortOrder: 40 },
  { code: 'AR', label: 'Art Rare', color: '#db2777', sortOrder: 50 },
  { code: 'SR', label: 'Super Rare', color: '#9333ea', sortOrder: 60 },
  { code: 'SAR', label: 'Special Art Rare', color: '#db2777', sortOrder: 70 },
  { code: 'UR', label: 'Ultra Rare', color: '#f59e0b', sortOrder: 80 },
];

const CONDITIONS: { code: string; label: string; sortOrder: number }[] = [
  { code: 'NM', label: '近完美 NM', sortOrder: 10 },
  { code: 'LP', label: '輕微磨損 LP', sortOrder: 20 },
  { code: 'MP', label: '中度磨損 MP', sortOrder: 30 },
  { code: 'HP', label: '重度磨損 HP', sortOrder: 40 },
];

async function main() {
  // 稀有度：先放標準清單，再補目錄裡出現但清單沒有的 rarity 值
  for (const r of RARITIES) {
    await prisma.rarity.upsert({ where: { code: r.code }, update: {}, create: r });
  }
  const usedRarities = await prisma.pokemonCard.findMany({
    where: { rarity: { not: null } },
    distinct: ['rarity'],
    select: { rarity: true },
  });
  let order = 100;
  for (const { rarity } of usedRarities) {
    if (!rarity) continue;
    await prisma.rarity.upsert({
      where: { code: rarity },
      update: {},
      create: { code: rarity, label: rarity, color: '#64748b', sortOrder: order++ },
    });
  }

  // 品相
  for (const c of CONDITIONS) {
    await prisma.condition.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // 系列：從目錄 distinct (language, seriesKey, seriesName) 匯入
  const seriesRows = await prisma.pokemonCard.groupBy({
    by: ['language', 'seriesKey', 'seriesName'],
    _count: { id: true },
  });
  let sOrder = 0;
  for (const s of seriesRows) {
    await prisma.series.upsert({
      where: { language_key: { language: s.language, key: s.seriesKey } },
      update: { name: s.seriesName },
      create: { language: s.language, key: s.seriesKey, name: s.seriesName, sortOrder: sOrder++ },
    });
  }

  console.log('refdata seeded');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: 加 script**

`backend/package.json` scripts 加：
```json
"seed:refdata": "ts-node prisma/seed-refdata.ts"
```

- [ ] **Step 3: 執行 seed**

Run: `cd backend && npm run seed:refdata`
Expected: `refdata seeded`，無錯誤。

- [ ] **Step 4: 驗證**

Run: `cd backend && npx prisma studio`（或寫一次性 count 查詢）
Expected: Rarity、Condition、Series 表有資料。

- [ ] **Step 5: Commit**
```bash
git add backend/prisma/seed-refdata.ts backend/package.json
git commit -m "feat: seed Rarity/Series/Condition reference tables from catalog"
```

---

### Task 6: 參照資料 CRUD controller + 路由

**Files:**
- Create: `backend/src/controllers/refdata.ts`
- Modify: `backend/src/routes/admin.ts`
- Create: `backend/src/routes/catalog.ts`（本任務先建公開讀取端點）
- Modify: `backend/src/app.ts`

- [ ] **Step 1: 寫 controller**

`backend/src/controllers/refdata.ts`：
```typescript
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// ── Rarity ──
export const listRarities = async (_req: Request, res: Response) => {
  res.json(await prisma.rarity.findMany({ orderBy: { sortOrder: 'asc' } }));
};
export const createRarity = async (req: Request, res: Response) => {
  const { code, label, color, sortOrder } = req.body;
  if (!code || !label) return res.status(400).json({ error: '缺少 code/label' });
  res.status(201).json(await prisma.rarity.create({
    data: { code, label, color: color || '#64748b', sortOrder: sortOrder ?? 0 },
  }));
};
export const updateRarity = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { code, label, color, sortOrder } = req.body;
  res.json(await prisma.rarity.update({
    where: { id },
    data: {
      ...(code !== undefined && { code }),
      ...(label !== undefined && { label }),
      ...(color !== undefined && { color }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
  }));
};
export const deleteRarity = async (req: Request, res: Response) => {
  const { id } = req.params;
  const r = await prisma.rarity.findUnique({ where: { id } });
  if (!r) return res.status(404).json({ error: 'not found' });
  const inUseCount = await prisma.pokemonCard.count({ where: { rarity: r.code } });
  await prisma.rarity.delete({ where: { id } });
  res.json({ ok: true, inUseCount });
};

// ── Condition ──
export const listConditions = async (_req: Request, res: Response) => {
  res.json(await prisma.condition.findMany({ orderBy: { sortOrder: 'asc' } }));
};
export const createCondition = async (req: Request, res: Response) => {
  const { code, label, sortOrder } = req.body;
  if (!code || !label) return res.status(400).json({ error: '缺少 code/label' });
  res.status(201).json(await prisma.condition.create({
    data: { code, label, sortOrder: sortOrder ?? 0 },
  }));
};
export const updateCondition = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { code, label, sortOrder } = req.body;
  res.json(await prisma.condition.update({
    where: { id },
    data: {
      ...(code !== undefined && { code }),
      ...(label !== undefined && { label }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
  }));
};
export const deleteCondition = async (req: Request, res: Response) => {
  const { id } = req.params;
  const c = await prisma.condition.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: 'not found' });
  const inUseCount = await prisma.listing.count({ where: { condition: c.code } });
  await prisma.condition.delete({ where: { id } });
  res.json({ ok: true, inUseCount });
};

// ── Series ──
export const listSeriesDefs = async (req: Request, res: Response) => {
  const { language } = req.query as Record<string, string>;
  res.json(await prisma.series.findMany({
    where: language ? { language } : undefined,
    orderBy: [{ language: 'asc' }, { sortOrder: 'asc' }],
  }));
};
export const createSeriesDef = async (req: Request, res: Response) => {
  const { key, name, language, logo, sortOrder } = req.body;
  if (!key || !name || !language) return res.status(400).json({ error: '缺少 key/name/language' });
  res.status(201).json(await prisma.series.create({
    data: { key, name, language, logo: logo || null, sortOrder: sortOrder ?? 0 },
  }));
};
export const updateSeriesDef = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key, name, language, logo, sortOrder } = req.body;
  res.json(await prisma.series.update({
    where: { id },
    data: {
      ...(key !== undefined && { key }),
      ...(name !== undefined && { name }),
      ...(language !== undefined && { language }),
      ...(logo !== undefined && { logo }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
  }));
};
export const deleteSeriesDef = async (req: Request, res: Response) => {
  const { id } = req.params;
  const s = await prisma.series.findUnique({ where: { id } });
  if (!s) return res.status(404).json({ error: 'not found' });
  const inUseCount = await prisma.pokemonCard.count({ where: { language: s.language, seriesKey: s.key } });
  await prisma.series.delete({ where: { id } });
  res.json({ ok: true, inUseCount });
};
```

- [ ] **Step 2: 建公開讀取路由 `catalog.ts`（本任務先放 rarities/conditions）**

`backend/src/routes/catalog.ts`：
```typescript
import { Router } from 'express';
import { listRarities, listConditions } from '../controllers/refdata';

const router = Router();
router.get('/rarities', listRarities);
router.get('/conditions', listConditions);
// （Task 8 會再加 /cards 等端點）
export default router;
```

- [ ] **Step 3: 掛 admin CRUD 路由**

在 `backend/src/routes/admin.ts` 適當處 import 並加（沿用該檔既有 admin 中介層套用方式）：
```typescript
import {
  listRarities, createRarity, updateRarity, deleteRarity,
  listConditions, createCondition, updateCondition, deleteCondition,
  listSeriesDefs, createSeriesDef, updateSeriesDef, deleteSeriesDef,
} from '../controllers/refdata';

router.get('/rarities', listRarities);
router.post('/rarities', createRarity);
router.patch('/rarities/:id', updateRarity);
router.delete('/rarities/:id', deleteRarity);

router.get('/conditions', listConditions);
router.post('/conditions', createCondition);
router.patch('/conditions/:id', updateCondition);
router.delete('/conditions/:id', deleteCondition);

router.get('/series-defs', listSeriesDefs);
router.post('/series-defs', createSeriesDef);
router.patch('/series-defs/:id', updateSeriesDef);
router.delete('/series-defs/:id', deleteSeriesDef);
```

- [ ] **Step 4: 掛 catalog 路由到 app**

`backend/src/app.ts`：import 後加
```typescript
import catalogRoutes from './routes/catalog';
app.use('/api/catalog', catalogRoutes);
```

- [ ] **Step 5: 編譯檢查 + 手動煙霧測試**

Run: `cd backend && npx tsc --noEmit`
Expected: 無型別錯誤。
Run（另起 dev server 後）: `curl localhost:PORT/api/catalog/rarities`
Expected: 回傳稀有度陣列。

- [ ] **Step 6: Commit**
```bash
git add backend/src/controllers/refdata.ts backend/src/routes/catalog.ts backend/src/routes/admin.ts backend/src/app.ts
git commit -m "feat(api): Rarity/Series/Condition admin CRUD + public read endpoints"
```

---

## Phase 3：目錄瀏覽 API

### Task 7: 目錄卡列表 + 詳情 controller

**Files:**
- Create: `backend/src/controllers/catalog.ts`
- Modify: `backend/src/routes/catalog.ts`

- [ ] **Step 1: 寫 controller**

`backend/src/controllers/catalog.ts`：
```typescript
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { aggregateInventory, type InventoryRow } from '../lib/inventory';
import { AuthRequest } from '../middleware/auth';

// 取一批 cardId 的 active 庫存，回 Map<cardId, InventoryRow[]>
async function inventoryByCard(cardIds: string[]): Promise<Map<string, InventoryRow[]>> {
  const map = new Map<string, InventoryRow[]>();
  if (cardIds.length === 0) return map;
  const listings = await prisma.listing.findMany({
    where: { cardId: { in: cardIds }, status: 'active' },
    select: { cardId: true, variant: true, condition: true, price: true, quantity: true },
  });
  for (const l of listings) {
    const arr = map.get(l.cardId) ?? [];
    arr.push(l);
    map.set(l.cardId, arr);
  }
  return map;
}

async function wishlistCountByCard(cardIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (cardIds.length === 0) return map;
  const grouped = await prisma.wishlist.groupBy({
    by: ['cardId'],
    where: { cardId: { in: cardIds } },
    _count: { id: true },
  });
  for (const g of grouped) map.set(g.cardId, g._count.id);
  return map;
}

export async function listCatalogCards(req: Request, res: Response) {
  const {
    language = '', seriesKey = '', setId = '', q = '',
    inStock = '', sort = 'price', page = '1', limit = '24',
  } = req.query as Record<string, string>;

  const where: any = {};
  if (language) where.language = language;
  if (seriesKey) where.seriesKey = seriesKey;
  if (setId) where.setId = setId;
  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: 'insensitive' } },
      { number: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }

  const take = parseInt(limit);
  const skip = (parseInt(page) - 1) * take;

  // 為支援「只看有庫存」與「價格排序」，先抓符合條件的卡（不分頁），
  // 合併庫存彙整後在記憶體排序/篩選/分頁。資料量級為單一套系（數十～數百張），可接受。
  const cards = await prisma.pokemonCard.findMany({ where });
  const ids = cards.map((c) => c.id);
  const [inv, wish] = await Promise.all([inventoryByCard(ids), wishlistCountByCard(ids)]);

  let merged = cards.map((c) => {
    const agg = aggregateInventory(inv.get(c.id) ?? []);
    return {
      id: c.id, name: c.name, number: c.number, image: c.image, imageHigh: c.imageHigh,
      rarity: c.rarity, language: c.language, seriesKey: c.seriesKey, seriesName: c.seriesName,
      setId: c.setId, setName: c.setName,
      minPrice: agg.minPrice, totalQty: agg.totalQty, variantCount: agg.variantCount,
      wishlistCount: wish.get(c.id) ?? 0,
    };
  });

  if (inStock === 'true') merged = merged.filter((m) => m.totalQty > 0);

  merged.sort((a, b) => {
    if (sort === 'price') {
      // 有貨者優先；有貨內依最低價升冪；無貨者排後（依 number）
      const aHas = a.minPrice != null, bHas = b.minPrice != null;
      if (aHas && bHas) return a.minPrice! - b.minPrice!;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    }
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const total = merged.length;
  const pageItems = merged.slice(skip, skip + take);
  res.json({ cards: pageItems, total, page: parseInt(page), pages: Math.ceil(total / take) });
}

export async function getCatalogCard(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const card = await prisma.pokemonCard.findUnique({ where: { id } });
  if (!card) return res.status(404).json({ error: '找不到卡片' });

  const listings = await prisma.listing.findMany({
    where: { cardId: id, status: 'active' },
    select: { id: true, variant: true, condition: true, price: true, quantity: true },
    orderBy: [{ price: 'asc' }],
  });
  const wishlistCount = await prisma.wishlist.count({ where: { cardId: id } });
  let userWished = false;
  if (req.userId) {
    userWished = (await prisma.wishlist.count({ where: { cardId: id, userId: req.userId } })) > 0;
  }

  res.json({
    ...card,
    variants: listings.map((l) => ({
      listingId: l.id, variant: l.variant, condition: l.condition,
      price: l.price, quantity: l.quantity,
    })),
    wishlistCount, userWished,
  });
}
```

> 注意：`getCatalogCard` 用 `AuthRequest` 但端點為**選擇性登入**——需在路由套用「可選 auth」中介層（若無，於 Task 9 建立 `optionalAuth`，或此處先以 `req.userId` 可能 undefined 處理；route 不強制 auth）。

- [ ] **Step 2: 加路由**

`backend/src/routes/catalog.ts` 補：
```typescript
import { listCatalogCards, getCatalogCard } from '../controllers/catalog';
import { optionalAuth } from '../middleware/auth';

router.get('/cards', listCatalogCards);
router.get('/cards/:id', optionalAuth, getCatalogCard);
```

- [ ] **Step 3: 建 optionalAuth 中介層（若不存在）**

檢查 `backend/src/middleware/auth.ts` 是否已有可選驗證。若無，加入：
```typescript
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      req.userId = payload.userId;
    } catch { /* 忽略無效 token，視為未登入 */ }
  }
  next();
}
```
（import 沿用該檔既有 `jwt`、型別。）

- [ ] **Step 4: 編譯檢查 + 煙霧測試**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。
Run: `curl "localhost:PORT/api/catalog/cards?language=zh&seriesKey=sv&inStock=true"`
Expected: 回傳含 `minPrice/totalQty/variantCount/wishlistCount` 的卡片陣列。

- [ ] **Step 5: Commit**
```bash
git add backend/src/controllers/catalog.ts backend/src/routes/catalog.ts backend/src/middleware/auth.ts
git commit -m "feat(api): catalog cards list + detail with inventory aggregation"
```

---

## Phase 4：敲碗 + 通知 + 補貨

### Task 8: 敲碗 API

**Files:**
- Create: `backend/src/controllers/wishlist.ts`
- Create: `backend/src/routes/wishlist.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: 寫 controller**

`backend/src/controllers/wishlist.ts`：
```typescript
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function addWishlist(req: AuthRequest, res: Response) {
  const { cardId, variant = null } = req.body;
  if (!cardId) return res.status(400).json({ error: '缺少 cardId' });
  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  if (!card) return res.status(404).json({ error: '找不到卡片' });

  // 冪等：已存在則直接回成功
  const wl = await prisma.wishlist.upsert({
    where: { userId_cardId_variant: { userId: req.userId!, cardId, variant } },
    update: {},
    create: {
      userId: req.userId!, cardId, variant,
      cardName: card.name, cardImage: card.imageHigh || card.image, language: card.language,
      notified: false,
    },
  });
  res.status(201).json(wl);
}

export async function removeWishlist(req: AuthRequest, res: Response) {
  const { cardId, variant = null } = req.body;
  await prisma.wishlist.deleteMany({ where: { userId: req.userId!, cardId, variant } });
  res.json({ ok: true });
}

export async function myWishlist(req: AuthRequest, res: Response) {
  res.json(await prisma.wishlist.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  }));
}
```

> `userId_cardId_variant` 為 `@@unique([userId, cardId, variant])` 生成的複合鍵名。`variant=null` 在 Postgres unique 中允許多筆 null——故「敲整張卡」的冪等改以先查再建：若 variant 為 null，先 `findFirst({ userId, cardId, variant: null })`，存在則回該筆，否則 create。請依此調整 addWishlist 的 null 分支。

- [ ] **Step 2: 處理 null variant 冪等**

把 `addWishlist` 改為：
```typescript
export async function addWishlist(req: AuthRequest, res: Response) {
  const { cardId, variant = null } = req.body;
  if (!cardId) return res.status(400).json({ error: '缺少 cardId' });
  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  if (!card) return res.status(404).json({ error: '找不到卡片' });

  const existing = await prisma.wishlist.findFirst({ where: { userId: req.userId!, cardId, variant } });
  if (existing) {
    // 重新敲碗 = 重新武裝通知：若先前已通知過，reset notified 讓下次補貨再次觸發（符合 spec「下次缺貨再敲可再次觸發」）
    if (existing.notified) {
      const rearmed = await prisma.wishlist.update({ where: { id: existing.id }, data: { notified: false } });
      return res.status(200).json(rearmed);
    }
    return res.status(200).json(existing);
  }

  const wl = await prisma.wishlist.create({
    data: {
      userId: req.userId!, cardId, variant,
      cardName: card.name, cardImage: card.imageHigh || card.image, language: card.language,
    },
  });
  res.status(201).json(wl);
}
```

- [ ] **Step 3: 路由**

`backend/src/routes/wishlist.ts`：
```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { addWishlist, removeWishlist, myWishlist } from '../controllers/wishlist';

const router = Router();
router.use(requireAuth); // 沿用既有 auth 中介層名稱（如不同請對應）
router.post('/', addWishlist);
router.delete('/', removeWishlist);
router.get('/mine', myWishlist);
export default router;
```
> 確認 `middleware/auth.ts` 強制驗證中介層實際匯出名稱（可能是 `authMiddleware`/`requireAuth`），import 對應之。

- [ ] **Step 4: 掛 app**

`backend/src/app.ts`：
```typescript
import wishlistRoutes from './routes/wishlist';
app.use('/api/wishlist', wishlistRoutes);
```

- [ ] **Step 5: 編譯 + 煙霧測試**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。
帶有效 token：`curl -X POST localhost:PORT/api/wishlist -H "Authorization: Bearer XXX" -H "Content-Type: application/json" -d '{"cardId":"zh:sv1-1"}'`
Expected: 201 + wishlist 物件；重打回 200 同物件（冪等）。

- [ ] **Step 6: Commit**
```bash
git add backend/src/controllers/wishlist.ts backend/src/routes/wishlist.ts backend/src/app.ts
git commit -m "feat(api): wishlist add/remove/list (idempotent)"
```

---

### Task 9: 通知 API + 補貨 service

**Files:**
- Create: `backend/src/lib/restock.ts`
- Create: `backend/src/controllers/notifications.ts`
- Create: `backend/src/routes/notifications.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: 補貨 service**

`backend/src/lib/restock.ts`：
```typescript
import { prisma } from './prisma';

// 在「某 cardId 庫存可能由 0→正數」之後呼叫。
// 以 cardId 目前 active 庫存總量判定是否已有貨；若有貨，通知所有 notified=false 的敲碗用戶。
export async function runRestockNotify(cardId: string): Promise<number> {
  const agg = await prisma.listing.aggregate({
    where: { cardId, status: 'active' },
    _sum: { quantity: true },
  });
  const totalQty = agg._sum.quantity ?? 0;
  if (totalQty <= 0) return 0;

  const wishes = await prisma.wishlist.findMany({ where: { cardId, notified: false } });
  if (wishes.length === 0) return 0;

  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  const name = card?.name ?? '卡片';
  const image = card?.imageHigh || card?.image || '';

  await prisma.$transaction([
    prisma.notification.createMany({
      data: wishes.map((w) => ({
        userId: w.userId, type: 'restock', cardId,
        cardName: name, cardImage: image,
        message: `你敲碗的「${name}」補貨了！`,
      })),
    }),
    prisma.wishlist.updateMany({
      where: { cardId, notified: false },
      data: { notified: true },
    }),
  ]);
  return wishes.length;
}
```

- [ ] **Step 2: 通知 controller**

`backend/src/controllers/notifications.ts`：
```typescript
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function myNotifications(req: AuthRequest, res: Response) {
  res.json(await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }));
}

export async function markRead(req: AuthRequest, res: Response) {
  const { id } = req.params;
  await prisma.notification.updateMany({ where: { id, userId: req.userId! }, data: { read: true } });
  res.json({ ok: true });
}

export async function markAllRead(req: AuthRequest, res: Response) {
  await prisma.notification.updateMany({ where: { userId: req.userId!, read: false }, data: { read: true } });
  res.json({ ok: true });
}
```

- [ ] **Step 3: 路由 + 掛 app**

`backend/src/routes/notifications.ts`：
```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { myNotifications, markRead, markAllRead } from '../controllers/notifications';

const router = Router();
router.use(requireAuth);
router.get('/mine', myNotifications);
router.patch('/:id/read', markRead);
router.post('/read-all', markAllRead);
export default router;
```
`backend/src/app.ts`：
```typescript
import notificationRoutes from './routes/notifications';
app.use('/api/notifications', notificationRoutes);
```

- [ ] **Step 4: 編譯檢查**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 5: Commit**
```bash
git add backend/src/lib/restock.ts backend/src/controllers/notifications.ts backend/src/routes/notifications.ts backend/src/app.ts
git commit -m "feat(api): notifications + restock notify service"
```

---

## Phase 5：後台庫存 + 目錄資料 API

### Task 10: 後台庫存 CRUD（含補貨觸發）+ 目錄管理查詢

**Files:**
- Modify: `backend/src/controllers/admin.ts`
- Modify: `backend/src/routes/admin.ts`

- [ ] **Step 1: 加庫存與目錄管理 handler**

在 `backend/src/controllers/admin.ts` 末尾加（import 補 `runRestockNotify`、`aggregateInventory`）：
```typescript
import { runRestockNotify } from '../lib/restock';
import { aggregateInventory, becameRestocked, type InventoryRow } from '../lib/inventory';

// 取某 cardId 目前 active 庫存總量
async function cardTotalQty(cardId: string): Promise<number> {
  const agg = await prisma.listing.aggregate({ where: { cardId, status: 'active' }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

// 後台庫存：建立（建立後觸發補貨檢查）
export async function adminCreateInventory(req: AuthRequest, res: Response) {
  const { cardId, cardName, cardGame, cardImage, language, variant, condition, price, quantity, description } = req.body;
  if (!cardId || price === undefined) return res.status(400).json({ error: '缺少必要資料' });
  // 一致性：cardId 必須對應目錄卡
  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  if (!card) return res.status(400).json({ error: 'cardId 對不到目錄卡，請先建立目錄卡' });

  const prevTotal = await cardTotalQty(cardId);
  const listing = await prisma.listing.create({
    data: {
      cardId,
      cardName: cardName || card.name,
      cardGame: cardGame || 'pokemon',
      cardImage: cardImage || card.imageHigh || card.image || '',
      language: language || card.language,
      variant: variant || '標準',
      condition: condition || 'NM',
      price: parseFloat(price),
      quantity: parseInt(quantity) || 0,
      description: description || '',
      sellerId: req.userId!,
      status: 'active',
    },
  });
  const nextTotal = await cardTotalQty(cardId);
  if (becameRestocked(prevTotal, nextTotal)) await runRestockNotify(cardId);
  res.status(201).json(listing);
}

// 後台庫存：更新（數量 0→正數 觸發補貨檢查）
export async function adminUpdateInventory(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { price, quantity, variant, condition, status } = req.body;
  const before = await prisma.listing.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: 'not found' });

  const prevTotal = await cardTotalQty(before.cardId);
  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(variant !== undefined && { variant }),
      ...(condition !== undefined && { condition }),
      ...(status !== undefined && { status }),
    },
  });
  const nextTotal = await cardTotalQty(updated.cardId);

  // 補貨判定：該 cardId 整體 active 總量由 0→正數才觸發通知
  if (becameRestocked(prevTotal, nextTotal)) await runRestockNotify(updated.cardId);
  res.json(updated);
}

export async function adminDeleteInventory(req: AuthRequest, res: Response) {
  const { id } = req.params;
  await prisma.listing.delete({ where: { id } });
  res.json({ ok: true });
}

// 後台目錄管理：列出符合條件的卡 + 庫存行 + 敲碗數（所有卡，不論有無庫存）
export async function adminCatalog(req: AuthRequest, res: Response) {
  const { language = '', seriesKey = '', setId = '', q = '', hasWishlist = '', inStock = '', page = '1', limit = '40' } =
    req.query as Record<string, string>;
  const where: any = {};
  if (language) where.language = language;
  if (seriesKey) where.seriesKey = seriesKey;
  if (setId) where.setId = setId;
  if (q.trim()) where.OR = [
    { name: { contains: q.trim(), mode: 'insensitive' } },
    { number: { contains: q.trim(), mode: 'insensitive' } },
  ];

  const cards = await prisma.pokemonCard.findMany({ where, orderBy: [{ setId: 'asc' }, { number: 'asc' }] });
  const ids = cards.map((c) => c.id);

  const listings = ids.length ? await prisma.listing.findMany({
    where: { cardId: { in: ids }, status: 'active' },
    select: { id: true, cardId: true, variant: true, condition: true, price: true, quantity: true },
  }) : [];
  const wishGrouped = ids.length ? await prisma.wishlist.groupBy({
    by: ['cardId'], where: { cardId: { in: ids } }, _count: { id: true },
  }) : [];

  const invMap = new Map<string, InventoryRow[]>();
  for (const l of listings) {
    const arr = invMap.get(l.cardId) ?? []; arr.push(l as any); invMap.set(l.cardId, arr);
  }
  const wishMap = new Map(wishGrouped.map((g) => [g.cardId, g._count.id]));
  const listingMap = new Map<string, typeof listings>();
  for (const l of listings) {
    const arr = listingMap.get(l.cardId) ?? []; arr.push(l); listingMap.set(l.cardId, arr);
  }

  let merged = cards.map((c) => {
    const agg = aggregateInventory(invMap.get(c.id) ?? []);
    return {
      id: c.id, name: c.name, number: c.number, image: c.image, imageHigh: c.imageHigh,
      rarity: c.rarity, language: c.language, seriesKey: c.seriesKey, seriesName: c.seriesName,
      setId: c.setId, setName: c.setName,
      inventory: listingMap.get(c.id) ?? [],
      ...agg,
      wishlistCount: wishMap.get(c.id) ?? 0,
    };
  });

  if (hasWishlist === 'true') merged = merged.filter((m) => m.wishlistCount > 0);
  if (inStock === 'true') merged = merged.filter((m) => m.totalQty > 0);
  if (inStock === 'false') merged = merged.filter((m) => m.totalQty === 0);

  const take = parseInt(limit); const skip = (parseInt(page) - 1) * take;
  res.json({ cards: merged.slice(skip, skip + take), total: merged.length, page: parseInt(page), pages: Math.ceil(merged.length / take) });
}

// 某卡敲碗名單
export async function adminCardWishlist(req: AuthRequest, res: Response) {
  const { cardId } = req.query as Record<string, string>;
  if (!cardId) return res.status(400).json({ error: '缺少 cardId' });
  const list = await prisma.wishlist.findMany({
    where: { cardId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { username: true, email: true } } },
  });
  res.json(list);
}
```

- [ ] **Step 2: 加路由**

`backend/src/routes/admin.ts`：
```typescript
import {
  adminCreateInventory, adminUpdateInventory, adminDeleteInventory,
  adminCatalog, adminCardWishlist,
} from '../controllers/admin';

router.get('/catalog', adminCatalog);
router.post('/inventory', adminCreateInventory);
router.patch('/inventory/:id', adminUpdateInventory);
router.delete('/inventory/:id', adminDeleteInventory);
router.get('/wishlist', adminCardWishlist);
```

- [ ] **Step 3: 編譯 + 煙霧測試**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。
Run: `curl "localhost:PORT/api/admin/catalog?language=zh&seriesKey=sv" -H "Authorization: Bearer ADMIN"`
Expected: 回傳每張卡含 `inventory[]`、`minPrice/totalQty/variantCount`、`wishlistCount`。

- [ ] **Step 4: Commit**
```bash
git add backend/src/controllers/admin.ts backend/src/routes/admin.ts
git commit -m "feat(api): admin inventory CRUD with restock trigger + catalog management + wishlist list"
```

---

### Task 11: 後台目錄卡編輯/新增/換圖/孤兒檢查

**Files:**
- Modify: `backend/src/controllers/admin.ts`
- Modify: `backend/src/routes/admin.ts`

- [ ] **Step 1: 加 handler**

`backend/src/controllers/admin.ts` 末尾加：
```typescript
const CARD_FIELDS = ['name','number','rarity','image','imageHigh','seriesKey','seriesName','setId','setName','types','hp','supertype'] as const;

export async function adminUpdateCard(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const data: any = {};
  for (const f of CARD_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
  const card = await prisma.pokemonCard.update({ where: { id }, data });
  res.json(card);
}

export async function adminCreateCard(req: AuthRequest, res: Response) {
  const { id, language, setId, setName, seriesKey, seriesName, number, name, image } = req.body;
  if (!id || !language || !setId || !seriesKey || !number || !name) {
    return res.status(400).json({ error: '缺少必要欄位 (id/language/setId/seriesKey/number/name)' });
  }
  const exists = await prisma.pokemonCard.findUnique({ where: { id } });
  if (exists) return res.status(409).json({ error: 'id 已存在' });
  const data: any = { id, language, setId, setName: setName || '', seriesKey, seriesName: seriesName || '', number, name, image: image || '' };
  for (const f of ['imageHigh','rarity','hp','types','supertype'] as const) if (req.body[f] !== undefined) data[f] = req.body[f];
  const card = await prisma.pokemonCard.create({ data });
  res.status(201).json(card);
}

export async function adminOrphanListings(_req: AuthRequest, res: Response) {
  const listings = await prisma.listing.findMany({ select: { id: true, cardId: true, cardName: true } });
  const ids = [...new Set(listings.map((l) => l.cardId))];
  const cards = await prisma.pokemonCard.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const known = new Set(cards.map((c) => c.id));
  res.json(listings.filter((l) => !known.has(l.cardId)));
}
```

- [ ] **Step 2: 加路由**

`backend/src/routes/admin.ts`：
```typescript
import { adminUpdateCard, adminCreateCard, adminOrphanListings } from '../controllers/admin';

router.post('/cards', adminCreateCard);
router.patch('/cards/:id', adminUpdateCard);
router.get('/orphan-listings', adminOrphanListings);
```

> 換圖：前端先呼叫既有 `POST /api/upload` 取得圖 URL，再以 `PATCH /api/admin/cards/:id { image }` 更新。後端不需新端點。

- [ ] **Step 3: 編譯 + 煙霧測試**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。
Run: `curl -X PATCH "localhost:PORT/api/admin/cards/zh:sv1-1" -H "Authorization: Bearer ADMIN" -H "Content-Type: application/json" -d '{"rarity":"SAR"}'`
Expected: 回傳更新後卡片，rarity=SAR。

- [ ] **Step 4: Commit**
```bash
git add backend/src/controllers/admin.ts backend/src/routes/admin.ts
git commit -m "feat(api): admin edit/create catalog card + orphan-listings check"
```

---

## Phase 6：前端 API 層

### Task 12: 前端 API client 模組

**Files:**
- Create: `frontend/src/api/catalog.ts`、`frontend/src/api/wishlist.ts`、`frontend/src/api/notifications.ts`
- Modify: `frontend/src/api/admin.ts`
- Create: `frontend/src/types/catalog.ts`

- [ ] **Step 1: 型別**

`frontend/src/types/catalog.ts`：
```typescript
export interface CatalogCard {
  id: string; name: string; number: string; image: string; imageHigh: string | null;
  rarity: string | null; language: string; seriesKey: string; seriesName: string;
  setId: string; setName: string;
  minPrice: number | null; totalQty: number; variantCount: number; wishlistCount: number;
}
export interface CardVariantRow {
  listingId: string; variant: string; condition: string; price: number; quantity: number;
}
export interface CatalogCardDetail extends Omit<CatalogCard, 'minPrice'|'totalQty'|'variantCount'> {
  imageHigh: string | null; hp: string | null; types: string | null; supertype: string | null;
  variants: CardVariantRow[]; wishlistCount: number; userWished: boolean;
}
export interface RarityDef { id: string; code: string; label: string; color: string; sortOrder: number; }
export interface ConditionDef { id: string; code: string; label: string; sortOrder: number; }
export interface SeriesDef { id: string; key: string; name: string; language: string; logo: string | null; sortOrder: number; }
export interface NotificationItem { id: string; type: string; cardId: string; cardName: string; cardImage: string; message: string; read: boolean; createdAt: string; }
export interface WishlistItem { id: string; cardId: string; cardName: string; cardImage: string; language: string; variant: string | null; createdAt: string; }
```

- [ ] **Step 2: catalog API**

`frontend/src/api/catalog.ts`：
```typescript
import { client } from './client';
import type { CatalogCard, CatalogCardDetail, RarityDef, ConditionDef } from '../types/catalog';

export const catalogApi = {
  cards: (params: { language?: string; seriesKey?: string; setId?: string; q?: string; inStock?: boolean; sort?: string; page?: number; limit?: number }) =>
    client.get<{ cards: CatalogCard[]; total: number; page: number; pages: number }>('/catalog/cards', { params }).then((r) => r.data),
  card: (id: string) => client.get<CatalogCardDetail>(`/catalog/cards/${encodeURIComponent(id)}`).then((r) => r.data),
  rarities: () => client.get<RarityDef[]>('/catalog/rarities').then((r) => r.data),
  conditions: () => client.get<ConditionDef[]>('/catalog/conditions').then((r) => r.data),
  series: (language: string) => client.get('/pokemon/series', { params: { language } }).then((r) => r.data),
  sets: (language: string, seriesKey: string) => client.get('/pokemon/sets', { params: { language, seriesKey } }).then((r) => r.data),
};
```

- [ ] **Step 3: wishlist + notifications API**

`frontend/src/api/wishlist.ts`：
```typescript
import { client } from './client';
import type { WishlistItem } from '../types/catalog';

export const wishlistApi = {
  add: (cardId: string, variant?: string | null) => client.post('/wishlist', { cardId, variant: variant ?? null }).then((r) => r.data),
  remove: (cardId: string, variant?: string | null) => client.delete('/wishlist', { data: { cardId, variant: variant ?? null } }).then((r) => r.data),
  mine: () => client.get<WishlistItem[]>('/wishlist/mine').then((r) => r.data),
};
```
`frontend/src/api/notifications.ts`：
```typescript
import { client } from './client';
import type { NotificationItem } from '../types/catalog';

export const notificationsApi = {
  mine: () => client.get<NotificationItem[]>('/notifications/mine').then((r) => r.data),
  markRead: (id: string) => client.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => client.post('/notifications/read-all').then((r) => r.data),
};
```

- [ ] **Step 4: admin API 擴充**

在 `frontend/src/api/admin.ts` 的 adminApi 物件加方法（沿用該檔既有 client 用法）：
```typescript
  catalog: (params: Record<string, any>) => client.get('/admin/catalog', { params }).then((r) => r.data),
  createInventory: (data: Record<string, any>) => client.post('/admin/inventory', data).then((r) => r.data),
  updateInventory: (id: string, data: Record<string, any>) => client.patch(`/admin/inventory/${id}`, data).then((r) => r.data),
  deleteInventory: (id: string) => client.delete(`/admin/inventory/${id}`).then((r) => r.data),
  cardWishlist: (cardId: string) => client.get('/admin/wishlist', { params: { cardId } }).then((r) => r.data),
  updateCard: (id: string, data: Record<string, any>) => client.patch(`/admin/cards/${encodeURIComponent(id)}`, data).then((r) => r.data),
  createCard: (data: Record<string, any>) => client.post('/admin/cards', data).then((r) => r.data),
  orphanListings: () => client.get('/admin/orphan-listings').then((r) => r.data),
  // refdata
  rarities: () => client.get('/admin/rarities').then((r) => r.data),
  createRarity: (d: Record<string, any>) => client.post('/admin/rarities', d).then((r) => r.data),
  updateRarity: (id: string, d: Record<string, any>) => client.patch(`/admin/rarities/${id}`, d).then((r) => r.data),
  deleteRarity: (id: string) => client.delete(`/admin/rarities/${id}`).then((r) => r.data),
  conditions: () => client.get('/admin/conditions').then((r) => r.data),
  createCondition: (d: Record<string, any>) => client.post('/admin/conditions', d).then((r) => r.data),
  updateCondition: (id: string, d: Record<string, any>) => client.patch(`/admin/conditions/${id}`, d).then((r) => r.data),
  deleteCondition: (id: string) => client.delete(`/admin/conditions/${id}`).then((r) => r.data),
  seriesDefs: (language?: string) => client.get('/admin/series-defs', { params: { language } }).then((r) => r.data),
  createSeriesDef: (d: Record<string, any>) => client.post('/admin/series-defs', d).then((r) => r.data),
  updateSeriesDef: (id: string, d: Record<string, any>) => client.patch(`/admin/series-defs/${id}`, d).then((r) => r.data),
  deleteSeriesDef: (id: string) => client.delete(`/admin/series-defs/${id}`).then((r) => r.data),
```
> 確認 `client` 匯出名稱與既有 `admin.ts` 一致（具名或預設）。

- [ ] **Step 5: 編譯檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 6: Commit**
```bash
git add frontend/src/api frontend/src/types/catalog.ts
git commit -m "feat(fe): API clients + types for catalog/wishlist/notifications/admin"
```

---

## Phase 7：前台 UI

### Task 13: SeriesSetNav 導覽元件

**Files:**
- Create: `frontend/src/components/SeriesSetNav.tsx`

- [ ] **Step 1: 實作（前後台共用的語言→系列→套系選擇器）**

`frontend/src/components/SeriesSetNav.tsx`：受控元件，props：
```typescript
interface Props {
  language: string; onLanguage: (l: string) => void;
  seriesKey: string; onSeries: (k: string) => void;
  setId: string; onSet: (id: string) => void;
}
```
行為：
- 內部用 `catalogApi.series(language)` 取系列、`catalogApi.sets(language, seriesKey)` 取套系。
- 語言切換 → 重抓系列、清空 seriesKey/setId。
- 系列切換 → 重抓套系、清空 setId（含「全部套系」選項 = 空字串）。
- 渲染：語言 Tab（繁中=zh/日文=ja/英文=en）、系列 chips 橫向、套系 chips（含 logo 縮圖）。沿用既有深色樣式（參考 `AdminListings.tsx` 的 chip 樣式）。

- [ ] **Step 2: 編譯檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/SeriesSetNav.tsx
git commit -m "feat(fe): SeriesSetNav language/series/set selector"
```

---

### Task 14: CatalogCard 卡片格元件

**Files:**
- Create: `frontend/src/components/CatalogCard.tsx`

- [ ] **Step 1: 實作**

`frontend/src/components/CatalogCard.tsx`，props `{ card: CatalogCard; rarityColor: (code: string|null) => string; onClick: () => void; onWish: () => void; wished: boolean }`。
渲染規格（對齊已核可 mockup `card-states.html`）：
- 左上稀有度徽章（底色 = `rarityColor(card.rarity)`）。
- 卡圖（`imageHigh || image`）；`totalQty===0` 時灰階。
- 卡名 + `number · setName`。
- 底列：
  - 有貨：價格（`variantCount>1` 顯示 `NT${minPrice} 起`，否則 `NT${minPrice}`）+ 綠色「剩 {totalQty}」（多變體用「共 {totalQty}」）。
  - 無貨：「無庫存」+ 藍色「🔔 敲碗 {wishlistCount}」按鈕（點擊 `onWish`，阻止冒泡）。
- `variantCount>1` 右上顯示「{variantCount} 變體」徽章。

- [ ] **Step 2: 編譯檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/CatalogCard.tsx
git commit -m "feat(fe): CatalogCard tile component"
```

---

### Task 15: Browse 瀏覽頁

**Files:**
- Create: `frontend/src/pages/Browse.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 實作 Browse**

`frontend/src/pages/Browse.tsx`：
- 狀態：language(預設 'zh')、seriesKey、setId、q、inStock(預設 false)、page。
- 載入 `catalogApi.rarities()` 建 `code→color` map。
- 頂部用 `<SeriesSetNav>`。
- 篩選列：☑只看有庫存（toggle inStock）、搜尋框（debounce 300ms 更新 q）、顯示排序固定「最低價」。
- 用 `catalogApi.cards({ language, seriesKey, setId, q, inStock, sort:'price', page })` 取資料，網格渲染 `<CatalogCard>`。
- 點卡片 → `navigate('/card/' + encodeURIComponent(card.id))`。
- 敲碗：未登入 → 導去 `/login`；已登入 → `wishlistApi.add(card.id)` 後樂觀更新 `wishlistCount+1`。
- 分頁：底部「載入更多」或頁碼。

- [ ] **Step 2: 路由**

`frontend/src/App.tsx`：把主瀏覽改為 Browse（保留 Market 或以 Browse 取代 `/market`，並讓首頁快捷指向 `/market`）：
```tsx
import Browse from './pages/Browse';
// 在 AppShell 區塊：
<Route path="/market" element={<Browse />} />
```

- [ ] **Step 3: 編譯 + 視覺驗證**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build 成功。
（執行 dev server，瀏覽 `/market` 確認系列→套系→卡片網格、篩選、敲碗運作。）

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/Browse.tsx frontend/src/App.tsx
git commit -m "feat(fe): catalog Browse page (series/set nav, filters, wishlist)"
```

---

### Task 16: CardDetail 詳情頁

**Files:**
- Create: `frontend/src/pages/CardDetail.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 實作**

`frontend/src/pages/CardDetail.tsx`：
- 由 `useParams` 取 id，`catalogApi.card(id)` 取詳情。
- 左卡圖、右資訊（卡名/卡號/套系/語言）。
- 變體列表：每筆 `variants[]` 一行（變體標籤 + 品相 + 價格 + 剩餘 + 購買鈕）；`quantity===0` 的行顯示「🔔 敲碗」（`wishlistApi.add(id, variant)`）。
- 購買：沿用既有下單。確認既有下單 API（`frontend/src/api/orders.ts` 的 create）參數為 `{ listingId, quantity }`，呼叫後導向 `/orders` 或顯示成功。
- 底部「敲整張卡」按鈕（`wishlistApi.add(id)`）+「目前 N 人敲碗」。
- 未登入時購買/敲碗 → 導 `/login`。

- [ ] **Step 2: 路由**

`frontend/src/App.tsx` 在 AppShell 區塊加：
```tsx
import CardDetail from './pages/CardDetail';
<Route path="/card/:id" element={<CardDetail />} />
```

- [ ] **Step 3: 編譯 + 視覺驗證**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build 成功；瀏覽某卡詳情確認變體列、購買、敲碗。

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/CardDetail.tsx frontend/src/App.tsx
git commit -m "feat(fe): CardDetail page with variants, buy, wishlist"
```

---

### Task 17: 通知鈴鐺

**Files:**
- Create: `frontend/src/components/NotificationBell.tsx`
- Modify: `frontend/src/components/AppShell.tsx`（或 Header）

- [ ] **Step 1: 實作 NotificationBell**

`frontend/src/components/NotificationBell.tsx`：
- 登入時 `notificationsApi.mine()` 取通知，計未讀數顯示紅點/數字。
- 點開下拉列出通知（卡圖 + message + 時間）；點某則 → `markRead` 並導向 `/card/{cardId}`。
- 「全部已讀」呼叫 `markAllRead`。
- 未登入不顯示。

- [ ] **Step 2: 放進外殼**

在 `frontend/src/components/AppShell.tsx` 的 header/sidebar 使用者區塊旁加 `<NotificationBell />`。

- [ ] **Step 3: 編譯 + 驗證**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build 成功；登入後可見鈴鐺與未讀數。

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/NotificationBell.tsx frontend/src/components/AppShell.tsx
git commit -m "feat(fe): notification bell"
```

---

## Phase 8：後台 UI

### Task 18: AdminCatalog 管理網格（inline 改價量 + 敲碗數 + 目錄資料/換圖）

**Files:**
- Create: `frontend/src/pages/admin/AdminCatalog.tsx`
- Modify: `frontend/src/App.tsx`、`frontend/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: 實作 AdminCatalog**

`frontend/src/pages/admin/AdminCatalog.tsx`：
- 頂部 `<SeriesSetNav>` + 篩選（搜尋、只看有敲碗 `hasWishlist`、有/無庫存）。
- `adminApi.catalog({...})` 取卡（含 `inventory[]`、`wishlistCount`）。
- 卡片網格，每卡：
  - 稀有度徽章 + 卡名 + number。
  - **inline 編輯**：展開顯示各 `inventory` 行（變體/品相/價格/數量），價格與數量為可編輯 input，blur 時 `adminApi.updateInventory(listingId, { price, quantity })`。
  - 「+ 變體」：選變體（自由輸入或常用清單）+ 品相（從 `conditions`）+ 價格 + 數量 → `adminApi.createInventory({ cardId, ... })`。
  - **敲碗數**徽章，點開 modal `adminApi.cardWishlist(cardId)` 顯示名單。
  - **編輯目錄資料** modal：欄位（name/number/rarity 下拉/seriesKey 下拉/setName…）→ `adminApi.updateCard(id, data)`；**換圖**：檔案上傳 → `POST /api/upload`（用既有 upload api）取 URL → `updateCard(id, { image })`。
- 稀有度/品相/系列下拉來源：`adminApi.rarities()/conditions()/seriesDefs(language)`。

- [ ] **Step 2: 路由 + 側欄**

`frontend/src/App.tsx` admin 區塊加：
```tsx
import AdminCatalog from './pages/admin/AdminCatalog';
<Route path="catalog" element={<AdminCatalog />} />  {/* /admin/catalog */}
```
`frontend/src/pages/admin/AdminLayout.tsx`：側欄加「卡片管理」連到 `/admin/catalog`。

- [ ] **Step 3: 編譯 + 驗證**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build 成功；`/admin/catalog` 可改價量、看敲碗數、改目錄資料、換圖。

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/admin/AdminCatalog.tsx frontend/src/App.tsx frontend/src/pages/admin/AdminLayout.tsx
git commit -m "feat(fe-admin): AdminCatalog grid with inline price/qty, wishlist counts, card-data edit, image replace"
```

---

### Task 19: AdminRefData 參照資料管理頁

**Files:**
- Create: `frontend/src/pages/admin/AdminRefData.tsx`
- Modify: `frontend/src/App.tsx`、`frontend/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: 實作**

`frontend/src/pages/admin/AdminRefData.tsx`：三個分頁。
- **稀有度**：表格列出 `rarities()`，每列可編輯 code/label/color(色票)/sortOrder，存檔 `updateRarity`；新增列 `createRarity`；刪除 `deleteRarity`（回 `inUseCount` 時跳確認「目前 N 張卡使用中，仍要刪？」）。
- **系列**：依 language 篩選，列出 `seriesDefs(language)`，欄位 key/name/logo/sortOrder，CRUD 對應 seriesDef API。
- **品相**：列出 `conditions()`，欄位 code/label/sortOrder，CRUD 對應 condition API。

- [ ] **Step 2: 路由 + 側欄**

`frontend/src/App.tsx` admin 區塊加：
```tsx
import AdminRefData from './pages/admin/AdminRefData';
<Route path="refdata" element={<AdminRefData />} />
```
`AdminLayout.tsx` 側欄加「資料管理」連到 `/admin/refdata`。

- [ ] **Step 3: 編譯 + 驗證**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build 成功；三類參照資料可 CRUD，刪除使用中項目有確認提示。

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/admin/AdminRefData.tsx frontend/src/App.tsx frontend/src/pages/admin/AdminLayout.tsx
git commit -m "feat(fe-admin): AdminRefData CRUD for rarity/series/condition"
```

---

## Phase 9：整合驗證

### Task 20: 端到端手動驗證 + 回歸

**Files:** 無（驗證）

- [ ] **Step 1: 後端全測**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: 測試全過、無型別錯誤。

- [ ] **Step 2: 前端建置**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build 成功。

- [ ] **Step 3: 啟動雙端手動走查（對照 spec 測試重點）**
  - 瀏覽：語言→系列→套系→卡片網格；卡片顯示最低價＋剩餘＋稀有度徽章。
  - 「只看有庫存」確實過濾無貨卡。
  - 多變體卡：卡面「N 變體 / NT$X 起」；詳情頁列出變體×品相。
  - 敲碗：無貨卡敲碗計數＋1；重複敲冪等不重複。
  - 後台改某卡數量 0→正數 → 敲碗者收到站內通知（鈴鐺未讀＋1）。
  - 後台改 rarity → 前台徽章/排序即時變。
  - 後台換圖 → 前台顯示新圖。
  - 參照資料 CRUD：新增稀有度後出現在卡片編輯下拉。
  - 權限：未登入無法敲碗/看通知；非 admin 無法存取 admin 端點。

- [ ] **Step 4: 最終 commit（如有微調）**
```bash
git add -A
git commit -m "test: end-to-end verification pass for card catalog redesign"
```

---

## Self-Review 對照（spec 覆蓋）

- 系列→套系瀏覽結構 → Task 13/15。
- 每卡顯示剩餘數＋價格＋稀有度 → Task 3/7/14。
- 只看有庫存篩選 → Task 7/15。
- 敲碗（含有貨也能敲、計數、冪等）→ Task 8/14/16。
- 補貨通知（站內鈴鐺、0→正數觸發、不重複）→ Task 4/9/10/17。
- 同卡多變體（瀏覽一卡一格、詳情分變體）→ Task 7/14/16。
- 後台卡片網格 inline 改價量 + 敲碗數 → Task 10/18。
- 手動修目錄資料 + 換圖 + 新增卡 + 孤兒檢查 → Task 11/18。
- 稀有度/系列/品相 CRUD → Task 5/6/19。
- 賣家模式（admin 獨家、保留擴充）→ 沿用 Listing.sellerId，未額外限制。
- 不做：email 通知、用戶上架前台改動、買取區、YuGiOh series → 計畫未含，符合 spec。
