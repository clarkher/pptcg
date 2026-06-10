# 卡拍拍式購物體驗改版 — 設計

日期：2026-06-10
分支：`claude/funny-buck-1af46d`（基於 `dev`，含既有 cart/checkout/ECPay）

## 問題（使用者回報）

1. 首頁「最新上架」的卡片點下去不能加入購物車（動線不明顯、卡片上沒有加入鈕、購物車入口是右上角極小浮動圖示）。
2. 同一張卡不能買複數。
3. （程式追查）庫存扣減會把整筆 listing 標成 `sold`，買 1 件就讓多庫存的剩餘量全部消失。

## 根因

- `POST /api/cart`（`backend/src/controllers/cart.ts`）用 `upsert` 且 `update: { quantity: qty }`，重複加入是「覆寫成 1」而非累加；且前端從未傳過 quantity > 1，也沒有任何選數量 UI。
- 扣庫存三處（`ecpay-callbacks.ts` 付款成功 / 超商取號、`checkout.ts` confirmStore）皆 `listing.update({ status: 'sold' })`，未依 `quantity` 扣減。
- 底部導覽列（`AppShell`）只有 首頁/市場/訂單/我的，沒有購物車分頁。

## 設計決策（已與使用者確認）

- 購物車入口：**底部導覽列加「購物車」分頁**（5 分頁），帶數量徽章。
- 加入購物車鈕：**卡片格 + 詳情頁都有**。
- 選數量：**詳情頁選數量 + 購物車可再調**。

## 變更

### A. 導覽列
- `AppShell` NAV 改為 首頁 / 市場 / 購物車 / 訂單 / 我的；購物車徽章顯示 `cartCount`（distinct 件數）。桌機側邊欄同步。
- 移除右上角浮動購物車圖示（保留通知鈴）。未登入點購物車 → `/login`。

### B. 卡片格快速加入
- 首頁 `CardItem`（具體 listing）：卡片加「＋」鈕 → 加入該 listing ×1（累加）。自家/已售出不顯示。
- 市場 `CatalogCard`（聚合多品相）：快速加入「最低價且有庫存」品相 ×1，toast 提示品相；無庫存沿用敲碗。需後端 catalog cards 多回 `cheapestListingId`。

### C. 詳情頁選數量
- `ListingDetail`：底部列加「− 數量 ＋」步進器（上限＝庫存），加入所選數量。
- `CardDetail`：每個品相列加緊湊步進器＋加入購物車。

### D. 購物車調數量
- `Cart` 每列加「− n ＋」（上限＝庫存）＋移除，即時更新小計／總計。

### E. 後端
1. `POST /api/cart` 改「累加」：`update: { quantity: { increment } }`，最終值 cap 在 `listing.quantity`。
2. 新增 `PATCH /api/cart/:listingId { quantity }`：設定絕對數量（1..庫存）。
3. 庫存扣減量化：付款成功 / 超商取號 / COD 三處改為 `quantity -= 購買數`，`<=0` 才標 `sold`。
4. catalog cards select 多回 `cheapestListingId`（最低價且 quantity>0 的 listing id）。

## 測試

- 後端單元/整合：cart 累加上限、PATCH 設定範圍、庫存扣減（買 2 剩 3、買到 0 標 sold）。
- 前端：preview 跑「加入購物車 → 調數量 → 結帳頁」並截圖。

## 非目標（YAGNI）

- 不做庫存預留/鎖定（oversell 防護）—— 維持現狀，僅改為量化扣減。
- 不動 ECPay 金流參數與 callback 驗章邏輯。
