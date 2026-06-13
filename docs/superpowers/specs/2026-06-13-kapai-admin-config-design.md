# 卡報報後台參數面板 — 設計

日期：2026-06-13
狀態：已核准設計，待實作

## 背景與動機

卡報報監控引擎目前的關鍵數值全部寫死在程式碼：
- 爬取量 `scraper.ts` `GAME_SIZE`（繁中/日 1500、英 350）
- 套利門檻 `logic.ts` `KAPAI_PARAMS`（折扣 0.7、最低省 100、最低行情價 300、最低賣家數 5）
- 推播時段與批次 `pusher.ts`（凌晨 04–08 不推、LINE top5）

問題：**熱門時段（晚上）上架爆量，固定 1500 撈不到全部新貨；凌晨上架少，1500 又浪費**。要靠改程式 + 重新部署才能調整，不夠靈活。

## 目標

把上述數值做成**後台可調**，並支援**分時段定義爬取量**。正式機可編輯、測試機唯讀（僅展示）。

## 範圍

### 可調參數
1. **分時段爬取量**（自訂區間）
   - 區間清單，每區間 = `startHour`(0–23, 台灣時間) + `pkmtw` / `pkmjp` / `pkmen` 各爬量
   - 爬蟲每輪依「當前台灣時間」落在哪區間決定爬量
   - 區間以 startHour 排序，覆蓋到下一區間的 startHour（最後一區間繞回第一個）
   - 例：`00:00→繁1500/日1500/英350`、`18:00→繁3000/日2500/英500`
2. **套利門檻**（全域單一值）：`discountThreshold` / `minProfit` / `minMarketValue` / `minSamples`
3. **推播**：不推時段 `noPushStartHour` / `noPushEndHour`、LINE 批次筆數 `lineBatchTopN`

### 不在範圍
- 偵測/推播**頻率**維持固定（偵測每 5 分、LINE 每 20 分）——node-cron schedule 不動
- 門檻不分時段（全域單一值）

## 資料模型

存於現有 `Setting` 表，key = `KAPAI_CONFIG`，value = JSON 字串：

```json
{
  "scrapeWindows": [
    { "startHour": 0,  "pkmtw": 1500, "pkmjp": 1500, "pkmen": 350 },
    { "startHour": 18, "pkmtw": 3000, "pkmjp": 2500, "pkmen": 500 }
  ],
  "params": {
    "discountThreshold": 0.7,
    "minProfit": 100,
    "minMarketValue": 300,
    "minSamples": 5
  },
  "push": {
    "noPushStartHour": 4,
    "noPushEndHour": 8,
    "lineBatchTopN": 5
  }
}
```

不存在或解析失敗 → 回退到**預設值**（= 目前寫死的值），引擎照常運作。

## 後端設計

### `backend/src/lib/kapai/config.ts`（新）
- `DEFAULT_CONFIG`：對應現狀的預設值
- `loadConfig(): Promise<KapaiConfig>`：讀 `Setting['KAPAI_CONFIG']`、JSON.parse、欄位驗證、缺漏補預設；**60 秒記憶體快取**避免每輪打 DB
- `saveConfig(cfg)`：驗證後寫回 Setting，清快取
- `pickScrapeWindow(windows, twHour): ScrapeWindow`：純函式，依台灣小時挑出當前區間（可單元測試，含跨午夜/空清單/未排序）
- `getTaiwanHour(date?): number`：UTC+8 當前小時

### 引擎改讀 config（取代寫死常數）
- `scraper.ts`：`fetchLatestProducts` 改用 `loadConfig()` → `pickScrapeWindow` 決定各 game pageSize
- `detector.ts` / `market.ts`：`KAPAI_PARAMS` 改由 config.params 提供（`isDeal` 簽名不變，呼叫端傳入 config 的 params）
- `pusher.ts`：`inPushWindow` 改讀 `push.noPushStartHour/EndHour`，top N 改讀 `lineBatchTopN`

### API：`backend/src/controllers/kapai-admin.ts`
- `GET /admin/kapai/config` → `{ env, config }`，`env = process.env.APP_ENV ?? 'production'`
- `PUT /admin/kapai/config` → 驗證 body → `saveConfig` → 回新 config
  - 若 `APP_ENV === 'staging'` → 拒絕寫入（回 403 + 訊息），後端層也擋，不只靠前端

## 前端設計

後台新分頁「**卡報報設定**」（`AdminLayout` NAV 加一項，新頁 `AdminKapaiSettings.tsx`）：
- 進頁 `GET /admin/kapai/config`，依 `env` 決定唯讀
- **時段區間編輯器**：清單，每列 startHour + 三 game 爬量，可 ＋ 新增 / － 刪除（至少保留一個 startHour=0 的區間）
- **門檻**、**推播**：數字輸入
- 儲存鈕 `PUT`
- **測試機**（env==='staging'）：所有輸入 disabled + 頂部橫幅「⚠️ 此為測試機，僅展示介面，實際請在正式機設定」

## 環境判斷

- 正式機 Railway `pptcg-backend` 設 `APP_ENV=production`
- 測試機 Railway `pptcg-backend-staging` 設 `APP_ENV=staging`
- GET config 回傳 env，前端據此鎖唯讀；後端 PUT 也用 env 擋寫入（雙重保險）

## 測試

- `config.test.ts`：`pickScrapeWindow`（正常落點、跨午夜繞回、未排序輸入、空清單回預設）、`loadConfig` 缺漏補預設、JSON 壞掉回退
- 既有 49 個測試不得破壞（`isDeal`/`buildCardKey` 等純函式簽名不變）

## 部署

依專案規則：先 dev → 用戶確認 → main。兩個 Railway 服務各設 `APP_ENV`。
