# 卡報報監控引擎 MVP — 設計文件

- 日期：2026-06-10
- 範圍：卡拍拍套利監控引擎（爬蟲累積 → 站內同卡比價 → 套利偵測 → LINE 推播）
- 前置：LINE Bot 綁定已完成（用戶可在會員頁產生綁定碼綁定 LINE UID）

## 1. 目標

把卡拍拍（trade.kapaipai.tw）上「明顯低於市場行情」的便宜貨，即時偵測並透過 LINE 推播給已綁定的用戶。MVP 只驗證核心迴路能動，不含金流與訂閱分級。

## 2. 核心思路：站內同卡比價（不靠外部基準）

不需要外部市價來源（Huca 是日英市價，對不上卡拍拍大宗的繁中卡）。改用**卡拍拍自己的行情**：持續爬最新商品累積到自己 DB，同一張卡（`packId-packCardId`）累積夠多筆，就有了它在卡拍拍的「市場價」。新進的低價商品跟這個累積行情一比，價差夠大就是套利機會。

好處：繁中卡也適用、不依賴拿不到的站內均價 API、只用已驗證可公開爬取的 `listLatestProduct`。

## 3. 資料來源

詳見記憶 `kapaipai-api`。關鍵：

- **`GET https://trade.kapaipai.tw/api/product/listLatestProduct`** — 公開、無需登入、無 Turnstile，回最新商品（pageSize 250）的純 JSON。
- 商品欄位：`id`, `game`, `productKey`(卡名描述), `price`(字串), `stock`, `condition`, `rare`, `packId`, `packCardId`, `packName`, `sellerNickname`, `sellerArea`, `createdTime`。
- **番號對齊（坑）**：真正番號 = `packId` + `-` + `packCardId`（如 `M5-065`）。`productKey` 是卡名描述（如 `喇叭啄鳥-90-飛翔`），不可當 key。部分商品是套牌（`DECK-*`）或自訂名 → `packId`/`packCardId` 缺漏者直接跳過。

## 4. 資料模型（Prisma，新增 3 張表）

```prisma
model KapaiListing {
  id             Int      @id          // 卡拍拍商品 id（天然去重 key）
  game           String                // pkmtw/pkmjp/pkmen/onejp/uajp/ygojp
  cardKey        String                // packId-packCardId，如 M5-065（對齊用）
  setCode        String                // packId
  cardNumber     String                // packCardId
  name           String                // productKey（卡名描述）
  packName       String
  rarity         String                // rare
  price          Int
  stock          Int
  condition      String                // perfect/...
  sellerId       Int
  sellerNickname String
  sellerArea     String
  listedAt       DateTime              // createdTime
  scrapedAt      DateTime @default(now())
  processed      Boolean  @default(false) // 是否已跑過套利偵測
  @@index([cardKey, condition])
  @@index([scrapedAt])
  @@index([processed])
}

model KapaiBaseline {
  id         String   @id @default(cuid())
  cardKey    String
  condition  String
  game       String
  median     Int                       // 中位數基準價
  sampleSize Int
  updatedAt  DateTime @updatedAt
  @@unique([cardKey, condition])
  @@index([cardKey])
}

model ArbitrageAlert {
  id         String   @id @default(cuid())
  listingId  Int                       // KapaiListing.id（去重，同商品不重複推）
  cardKey    String
  game       String
  price      Int                       // 套利商品售價
  baseline   Int                       // 當時基準價
  discount   Float                     // price / baseline
  profit     Int                       // baseline - price（估算價差）
  pushedAt   DateTime @default(now())
  @@unique([listingId])
  @@index([pushedAt])
}

// 通知偏好（結構預留，MVP 階段先全推，欄位空=不限）
model NotifyPreference {
  id           String   @id @default(cuid())
  userId       String   @unique
  games        String[] @default([])   // 只收這些 game（pkmtw/pkmjp/...），空=全部
  minSavingPct Float?                  // 最低省下比例 0~1（0.4=至少省40%才推）
  minPrice     Int?                    // 售價下限
  maxPrice     Int?                    // 售價上限
  enabled      Boolean  @default(true) // 總開關（false=暫停所有通知）
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## 5. 資料流（每 5 分鐘一輪）

1. **爬取**：`GET listLatestProduct` → 解析 products。
2. **入庫**：對每筆，`cardKey = packId + "-" + packCardId`；缺 `packId`/`packCardId` 者跳過。`upsert KapaiListing`（以 `id` 去重，重複出現只更新）。新出現的標 `processed=false`。
3. **更新基準**：對本輪出現的每個 `(cardKey, condition)`，從近 N 天（建議 14 天）的 `KapaiListing` 取 `price` **中位數**，`sampleSize ≥ 5` 才寫入 `KapaiBaseline`。
4. **套利偵測**：對 `processed=false` 的商品，找對應 `(cardKey, condition)` 的 `KapaiBaseline`：
   - 條件：`sampleSize ≥ 5` 且 `price ≤ median × 0.7` 且 `(median − price) ≥ 100`
   - 命中 → 建 `ArbitrageAlert`（`listingId` unique 去重）→ 推播。
   - 不論命中與否，跑完標 `processed=true`。
5. **推播**：對每個 `lineUid` 不為 null 的 user，`linePush`（已存在於 `controllers/line.ts`）發送機會卡片訊息（卡名、套系、售價、基準價、價差、賣家、卡拍拍商品連結）。MVP 不分級、即時推給所有綁定者。

## 6. 關鍵參數（MVP 預設值）

| 參數 | 值 | 理由 |
|------|----|----|
| 套利門檻 | `price ≤ median × 0.7` | 明顯低於行情才算 |
| 絕對價差底線 | `median − price ≥ NT$100` | 小錢不推，避免洗版 |
| 最小樣本 | `sampleSize ≥ 5` | 樣本太少基準不可信 |
| 基準時間窗 | 近 14 天 | 兼顧時效與樣本量 |
| 品相比對 | 只比同 `condition` | perfect 與有損不可比 |
| 排程頻率 | 每 5 分鐘 | PRD 主力規格 |

## 7. 元件與邊界（單一職責）

- `lib/kapai/scraper.ts` — 抓 `listLatestProduct`、解析、入庫。輸入：無；輸出：本輪新增/更新的 listing。
- `lib/kapai/baseline.ts` — 重算指定 cardKey 的基準。輸入：cardKey 清單；輸出：更新 KapaiBaseline。
- `lib/kapai/detector.ts` — 對未處理 listing 跑套利判斷、建 alert。輸入：無；輸出：新 alert 清單。
- `lib/kapai/notifier.ts` — 把 alert 推播給綁定用戶（呼叫既有 linePush）。
- `lib/kapai/cron.ts` — 排程串起上面四步（node-cron 每 5 分鐘）。
- 後端啟動時掛載 cron（僅在指定環境啟用，用環境變數 `KAPAI_MONITOR_ENABLED` 控制）。

## 8. 後台檢視（純檢視）

- `/admin/kapai` — 兩個分頁：
  - 「卡拍拍商品」：最新爬到的 `KapaiListing`（番號、名稱、售價、基準價、品相、賣家、上架時間、↗看商品），可搜尋/篩 game/排序。
  - 「套利機會」：`ArbitrageAlert` 列表（卡名、售價、基準、價差、折扣、推播時間）。
- `/admin/huca` — 你原本要的 Huca 行情純檢視（番號、繁中名、低價/高價、成交數、更新時間）。站內比價方案下 Huca 非必須，但保留作日英卡備用基準與行情參考。

## 9. 風險與邊界條件

- **卡拍拍 API 改版/封鎖**：fetch 重試 3 次，連續失敗發 LINE 通知管理者，不中斷下一輪。
- **Turnstile**：目前 `listLatestProduct` 不需要；若未來被加上，需改用瀏覽器自動化或申請正式管道（屆時再議）。
- **冷啟動**：上線頭幾天樣本不足（`sampleSize < 5`），偵測自然不觸發，不會誤報；隨累積建立基準。可接受。
- **重複推播**：`ArbitrageAlert.listingId` unique 保證同商品只推一次。
- **公地悲劇**（同機會通知多人搶一張）：MVP 用戶少，先不分流；未來再做限額/分級。
- **番號雜訊**：套牌/自訂名（無 packId/packCardId）一律跳過，避免污染基準。

## 10. 環境策略

先在 **dev/staging**（測試用戶已綁定於此）把引擎跑起來、累積資料、調參數；穩定後再開到正式機。用 `KAPAI_MONITOR_ENABLED` 環境變數控制哪個環境啟用 cron，避免兩套環境同時推播。

## 11. 通知分流（結構預留，MVP 全推）

每個綁定用戶可設定自己的通知範圍，避免被不相關的便宜貨洗版。維度對應 `NotifyPreference`：

- `games`：只收的卡種/語言（pkmtw 繁中、pkmjp 日、pkmen 英、onejp 海賊王、ygojp 遊戲王…），空=全部
- `minSavingPct`：套利幅度下限，省下比例 `(baseline − price) / baseline ≥ 此值`
- `minPrice` / `maxPrice`：售價區間
- `enabled`：總開關（false 暫停所有通知）

**MVP 階段**：notifier 對所有綁定用戶全推（不查偏好）。但純函式 `matchesPreference(alert, pref)` 與 `NotifyPreference` 表先建好；之後只需把 notifier 的「全推」改成「逐一查用戶偏好用 `matchesPreference` 過濾」，不動其他元件。

**後續**：用戶自助設定介面（LINE Rich Menu 或網頁會員頁）、分級（免費版延遲/限筆、付費版即時）。

## 12. MVP 範圍

- ✅ 含：爬蟲累積、基準計算、套利偵測、LINE 推播（全推）、後台檢視（卡拍拍商品＋套利機會＋Huca 行情）、`NotifyPreference` 表與 `matchesPreference` 純函式（預留分流）。
- ❌ 不含：用戶自助設定通知範圍的 UI、分級延遲、金流、多平台整合、Rich Menu、邀請裂變。（皆為後續迭代）
