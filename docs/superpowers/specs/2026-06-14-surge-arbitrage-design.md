# 行情跳漲撿漏（美日卡第二偵測軌）設計

日期：2026-06-14
狀態：設計待審

## 問題

卡報報「好久沒跳訊號」。現行偵測只在**新爬到的掛單**便宜於行情時才命中，而：

1. 美日卡基準是 **30 天成交中位**（`huca-raw.ts`），快取 24h、反應慢 → 行情真的漲了也幾乎不動。
2. 卡拍拍賣家通常貼近行情，`售價 ≤ 行情×0.7 且省 ≥100`（`logic.ts isDeal`）很難在新掛單上成立。
3. 「全量重偵測」實際只重算**還落在最新 N 筆爬取視窗內**的掛單（`scraper.ts ingestLatest` 只 upsert 最新 N 筆、把它們 `processed=false`）。行情漲了、但舊掛單早掉出視窗 → 不會被重新比價。

結果：「市場剛漲、掛單還沒跟上」這段時間差完全抓不到——而那正是最肥的撿漏。

## 目標

新增一條**獨立偵測軌**：偵測美日卡在 Huca 的成交「跳漲」，反向回抓該卡卡拍拍目前最低掛單，用專用門檻判斷是否可獲利，命中即推播。與現有「新掛單撿漏」並存，共用去重與推播管線。

非目標（Out of scope）：繁中卡（pkmtw，無 snkrdunk 成交序列）；改動現有新掛單偵測邏輯；歷史回補。

## 設計

### 觸發判斷（漲價 AND 熱度，兩者都要）

資料來源：Huca 背後 snkrdunk 成交走勢 `get_snkrdunk_chart.php?snkrdunk_id=X&mode=all`，grade key `18`（裸卡），回 `[ts(ms), priceJPY][]`——現行 `fetchRawPrice` 已在用同一支。

純函式 `computeSurge(series, params, now)`（無 I/O，可單元測試）：

- `recentCutoff = now − recentDays`；`priorCutoff = now − (recentDays + priorDays)`
- `recent` = ts ≥ recentCutoff 的點；`prior` = priorCutoff ≤ ts < recentCutoff 的點
- 可靠度：`recent.length < minRecentCount` → 不算 surge（樣本不足、噪音大）；`prior.length === 0` → 不算（無對照基準）
- **漲價**：`recentMedian ≥ priorMedian × priceSurgeRatio`
- **熱度**：近期週量 `recent.length /(recentDays/7) ≥` 對照週均 `prior.length /(priorDays/7) × volSurgeRatio`
- `surged = 漲價 && 熱度`
- 回傳 `{ surged, recentMedianTwd, priceSurged, volSurged, recentCount, priorCount }`，其中 `recentMedianTwd = round(median(recent priceJPY) × JPY_TWD)`

**新基準用近 7 天成交中位（剛漲上去的價），不用慢吞吞的 30 天中位。** 這是本軌與現行的關鍵差異。

### 掃描範圍（高價值卡）

候選 = `HucaCard.rawPriceTwd ≥ surge.minBaseline`（DB 直接撈，不需額外列舉 API）。這批是先前比過價、已知高價值且有 snkrdunkId 的日英卡，數量有界。

- 並行 10、chart 序列短快取（避免同輪/跨輪重打）。
- 抓到序列後再用 `recentMedianTwd ≥ minBaseline` 做精準二次過濾（cached `rawPriceTwd` 只當便宜預篩）。

### 回抓 + 獲利門檻（後台可調專用門檻）

surge 命中後：

1. **還原卡拍拍番號**：從 `KapaiListing` 取 `setCode = HucaCard.setCode` 且番號數字對齊（`parseInt` 去前導零）的最近一筆，拿到正確的 `packId / packCardId / game`。查無（從沒在卡拍拍出現過）→ 跳過。
2. **即時抓**該卡目前 perfect 在售（**不吃舊快取**，要當下最低）：取最低掛單完整欄位 + `siteMin` + `count`。
3. **獲利判斷**：重用現有 `isDeal({ price: 最低掛單, baseline: recentMedianTwd, siteMin }, surgeParams)`，其中 surgeParams = `{ discountThreshold, minProfit, minMarketValue: minBaseline }`。
4. 命中 → upsert 該掛單進 `KapaiListing`（讓 `notifier`/`pusher` 原樣重用）→ 建 `ArbitrageAlert(source='surge')`（`listingId` unique 自動去重，與新掛單軌不重複）→ `pushTelegram`（標 `🔥行情跳漲撿漏`）。LINE 走原有批次。

### 設定（`KapaiConfig.surge`，後台可改）

```ts
surge: {
  enabled: true,
  recentDays: 7,          // 近期視窗
  priorDays: 30,          // 對照視窗（近期之前）
  priceSurgeRatio: 1.2,   // 近期中位 ≥ 對照中位 × 此值
  volSurgeRatio: 2.0,     // 近期週量 ≥ 對照週均 × 此值
  minRecentCount: 3,      // 近期最少成交筆數（可靠度）
  minBaseline: 1000,      // 只看新行情 ≥ 此值的卡（高價值）
  discountThreshold: 0.8, // 最低掛單 ≤ 新行情 × 此值
  minProfit: 200,         // 省額下限
}
```

`parseConfig` 對 `surge` 做 `{ ...DEFAULT.surge, ...(obj.surge ?? {}) }` 補欄位（與既有 params/push 一致）。掃描頻率固定每小時（cron 寫死，不放假的可調旋鈕）。

### 資料模型

`ArbitrageAlert` 新增 `source String @default("listing")`（值：`"listing"` 新掛單軌 / `"surge"` 跳漲軌）。需對 staging + prod 兩個 Neon 各跑一次 `prisma db push`。

### 模組與檔案

| 檔案 | 改動 |
|---|---|
| `backend/src/lib/kapai/logic.ts` | 新增純函式 `computeSurge()` 與型別；獲利重用既有 `isDeal()` |
| `backend/src/lib/kapai/config.ts` | `KapaiConfig` 加 `surge` 區塊 + 預設 + parse 補欄位 |
| `backend/src/lib/kapai/huca-raw.ts` | 加 `fetchSurgeSeries(snkrdunkId)`（回原始序列、短快取；與 `fetchRawPrice` 共用 fetch） |
| `backend/src/lib/kapai/market.ts` | 加 `fetchCheapestPerfect(game, packId, packCardId)`（回最低掛單完整欄位 + siteMin + count，**不吃 30 分快取**） |
| `backend/src/lib/kapai/surge.ts`（新） | `detectSurges()` 串整個流程，回 `{ scanned, surged, detected }` |
| `backend/src/lib/kapai/cron.ts` | 加每小時 surge cron（`surge.enabled` 開關） |
| `backend/prisma/schema.prisma` | `ArbitrageAlert.source` |
| `backend/src/lib/kapai/notifier.ts` | `buildText` 加 surge 標記（向後相容、選用參數） |
| `backend/src/controllers/kapai-admin.ts` | `adminPutKapaiConfig` 加 surge 欄位驗證 |
| `frontend/src/pages/admin/AdminKapaiSettings.tsx` | 加「④ 行情跳漲偵測（美日卡）」設定區 |
| `backend/src/lib/kapai/logic.test.ts`、`config.test.ts` | `computeSurge` + surge 預設的單元測試 |

### 邊界與防呆

- **稀有度對齊**：番號對齊不分稀有度（皮卡丘一般版 vs 球閃）。回抓最低掛單時沿用 `fetchPerfectMarket` 的同稀有度比價邏輯，避免被高稀有度版本帶歪。
- **稀疏序列**：高價值卡成交稀疏，週量比值噪音大 → `minRecentCount` 地板 + `volSurgeRatio` 雙重把關；參數後台可調。
- **去重**：`ArbitrageAlert.listingId` unique。兩軌打到同一掛單 → 先到先建、後者跳過（baseline 可能不同，接受先到為準）。
- **單卡失敗不影響整輪**（try/catch per card，與現行 detector 一致）。
- **EN 覆蓋**：snkrdunk 偏日卡，EN 序列較薄 → 由「有 snkrdunkId + rawPriceTwd≥minBaseline」自然過濾，不另外特判。

### 測試

- `computeSurge`：漲價且熱度→surge；只漲不熱→否；只熱不漲→否；近期樣本不足→否；對照期空→否；JPY→TWD 換算正確。
- `parseConfig`：缺 `surge` 補預設；部分欄位 merge。
- 既有 `isDeal` 測試已覆蓋獲利判斷。

### 部署

- 改動先 commit 到 dev（push 觸發 staging：Vercel dev + Railway `pptcg-backend-staging`）。
- `prisma db push` 對 staging Neon（ep-rough-butterfly）先跑；用戶確認後 merge main，再對 prod Neon（ep-autumn-dream）跑一次。
- surge cron 由 `surge.enabled` 控制；正式機 `KAPAI_MONITOR_ENABLED=true` 才啟動。
