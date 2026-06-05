# 卡片目錄瀏覽改版設計（卡拍拍式）

> 狀態：已通過使用者確認，待寫實作計畫

## 目標

把前台從「以 Listing（單筆上架）為主」的市集，改成**以卡片目錄為主**的瀏覽體驗（仿卡拍拍）：
依「系列 → 套系」結構瀏覽，每張卡顯示**最低價＋剩餘數量＋稀有度**，可篩選只看有庫存，沒庫存（或有庫存）的卡都能「敲碗」。後台改成對應的卡片網格，可就地改價格／數量、篩選、看敲碗人數。

## 核心問題與解法：同卡多稀有度變體

寶可夢同一張卡（同卡號）會有多種印刷變體（普通／反射閃 reverse holo／異圖／金卡…），它們是**不同商品、不同價格**。目錄 `PokemonCard` 是「一個卡號一筆」（只有一個 rarity）。

加上硬需求「卡片全顯示、沒庫存也能敲碗」→ 瀏覽頁必須顯示**所有目錄卡**（含未進貨）。

**解法：**
- 瀏覽網格維持**一卡號一格**（所以無庫存卡也都顯示得出、能敲碗）。
- 變體收在**卡片詳情頁**與**後台庫存**：同卡號下把多個 `(變體 × 品相)` 列成一行行，各有獨立價格／數量。
- 卡面用稀有度徽章 + 「N 變體 / NT$X 起」表達多變體。

## 資料模型

### 沿用 `Listing` 作為庫存，新增 `variant` 欄位
```prisma
model Listing {
  // 既有欄位不變：id, cardId, cardName, cardGame, cardImage,
  //   language, condition, price, quantity, description,
  //   sellerId, seller, status, createdAt, orders
  variant String @default("標準")  // 新增：普通 / 反射閃 / 異圖 / 金卡 ...
}
```
- 後台模式 = 所有 `Listing.sellerId` 都是 admin 帳號。
- 一張卡的庫存 = 該 `cardId` 底下所有 `status="active"` 的 Listing，按 `(variant, condition)` 分行。
- 瀏覽頁彙整：`minPrice`、`totalQty`、`variantCount`（distinct variant 數）。
- 不另開新表：保留 `Order` 與 `Listing` 的關聯不變，YAGNI。

### 新增 `Wishlist`（敲碗）
```prisma
model Wishlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  cardId    String                       // PokemonCard id，如 "zh:sv1-1"
  cardName  String
  cardImage String
  language  String
  variant   String?                      // null = 敲整張卡；有值 = 敲特定變體
  notified  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([userId, cardId, variant])
  @@index([cardId])
}
```
- 後台依 `cardId` 聚合看人數與名單。

### 新增 `Notification`（站內通知，補貨用，MVP）
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   @default("restock")   // 之後可擴充其他類型
  cardId    String
  cardName  String
  cardImage String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
}
```
- User 需加上 `wishlists Wishlist[]` 與 `notifications Notification[]` 反向關聯。

### 補貨通知流程
當某 `cardId` 的庫存從「無貨」變成「有貨」時觸發（admin 新增庫存或把數量從 0 改成正數）：
1. 查該 `cardId` 所有 `notified=false` 的 `Wishlist`。
2. 為每位敲碗用戶建一筆 `Notification`（type=restock）。
3. 把那些 `Wishlist.notified` 設為 `true`（避免重複通知；下次缺貨再敲可再次觸發）。
- 「從無貨變有貨」判定：該 cardId 在此次異動前 `sum(quantity)=0`、異動後 `>0`。
- Email 通知列為**未來**，本次只做站內鈴鐺。

## 前台

### 瀏覽頁（取代/重構 `Market.tsx`）
版面（B：系列 → 套系雙層）：
- **語言 Tab**：繁中 / 日文 / 英文。
- **系列層**：系列 chips（朱&紫 / 劍&盾…），點選後展開該系列的**套系**清單（含套系 logo）。
- **套系層**：選套系後顯示卡片網格；亦可「全部套系」。
- **篩選列**：
  - ☑ 只看有庫存（`inStock` toggle）
  - 🔍 搜尋（卡名 / 卡號）
  - 排序：**預設最低價由低到高**（卡拍拍式；同價可用稀有度／卡號次序）
- **卡片格**：
  - 左上稀有度徽章（C/U/R/RR/SR/AR/SAR/UR…）
  - 有庫存：最低價（多變體顯示「NT$X 起」）＋ 剩餘總數
  - 多變體：右上「N 變體」徽章
  - 無庫存：灰階卡圖 ＋「🔔 敲碗 N」（N=已敲碗人數）
  - 有庫存的卡也能敲碗

### 卡片詳情頁（新 catalog 詳情，取代/補充 `ListingDetail`）
- 卡圖 + 卡名 + 卡號 + 套系 + 語言。
- 同卡號下列出每個 `(變體 × 品相)` 一行：稀有度/變體標籤、品相、價格、剩餘、購買鈕。
- 無庫存的行 →「🔔 敲碗」（敲該變體）；頁面另有「敲整張卡」。
- 顯示「目前 N 人敲碗」。
- 購買沿用現有下單流程（`POST /orders`，listingId+quantity）。

### 通知鈴鐺
- 前台 header / 個人頁加 🔔，顯示未讀數，點開看 `Notification` 列表。

## 後台（卡拍拍式管理網格）

### Admin 卡片管理頁（新 `AdminCatalog`）
- 結構同前台：語言 → 系列 → 套系 → 卡片網格，但顯示**所有**卡（不論有無庫存）。
- 每張卡：
  - **就地編輯**價格／數量（inline，至少編輯該卡「標準變體」那行；多變體可展開逐行編輯）。
  - 顯示**敲碗人數**徽章，點開看敲碗名單（用戶名／時間）。
  - 可新增變體庫存行（選變體 + 品相 + 價格 + 數量）。
- **篩選**：語言、系列、套系、搜尋、**只看有人敲碗的卡**、只看有/無庫存。
- 保留現有 `AdminListings` 的卡片挑選器邏輯做底層資料來源。

## API 端點

### 目錄瀏覽（前台）
- `GET /catalog/series?language=` — 沿用現有 `/pokemon/series`。
- `GET /catalog/sets?language=&seriesKey=` — 沿用現有 `/pokemon/sets`。
- `GET /catalog/cards?language=&seriesKey=&setId=&q=&inStock=&sort=&page=&limit=`
  → 回傳卡片清單，每筆含目錄欄位 ＋ 彙整 `{ minPrice, totalQty, variantCount, rarity, wishlistCount }`。
- `GET /catalog/cards/:id`
  → 卡片目錄資料 ＋ `variants[]: { listingId, variant, condition, price, quantity }` ＋ `wishlistCount` ＋ `userWished`（目前登入者是否已敲）。

### 敲碗（前台，需登入）
- `POST /wishlist` `{ cardId, variant? }`
- `DELETE /wishlist` `{ cardId, variant? }`
- `GET /wishlist/mine`

### 通知（前台，需登入）
- `GET /notifications/mine`
- `PATCH /notifications/:id/read`（或 `POST /notifications/read-all`）

### 後台（需 admin）
- `GET /admin/catalog?language=&seriesKey=&setId=&q=&hasWishlist=&inStock=&page=&limit=`
  → 所有卡 ＋ 庫存行 ＋ 敲碗人數。
- `POST /admin/inventory` `{ cardId, cardName, cardImage, cardGame, language, variant, condition, price, quantity, description? }`
  → 以 admin 身分建立 Listing；建立後執行補貨通知檢查。
- `PATCH /admin/inventory/:listingId` `{ price?, quantity?, variant?, condition?, status? }`
  → 更新；若數量由 0→正數觸發補貨通知檢查。
- `DELETE /admin/inventory/:listingId`
- `GET /admin/wishlist?cardId=` — 某卡的敲碗名單。

## 賣家模式（範圍界定）
- **現在**：admin 獨家經營，前台純購買。
- 架構保留 `Listing.sellerId` 與既有 `Sell` 流程 → 未來可開放用戶上架（不在本次範圍）。
- **買取區**（平台向用戶收卡）：未來獨立功能，本次不做；資料模型不阻擋其加入。

## 不做的事（YAGNI）
- Email / LINE 補貨通知（先站內）。
- 用戶自助上架的前台改動（保留現狀）。
- 買取區。
- YuGiOh 的系列/套系結構（現有 catalog 僅 Pokemon 有完整 series/set；YuGiOh 維持現有搜尋）。

## 測試重點
- 庫存彙整：多變體卡的 `minPrice / totalQty / variantCount` 正確。
- `inStock` 篩選只留有貨卡；敲碗計數正確。
- 敲碗 `@@unique` 防重複；重複敲回應冪等。
- 補貨通知：0→正數觸發、正數→正數不重複觸發、缺貨後再敲可再次觸發。
- 後台 inline 改價/改量後彙整即時反映。
- 權限：敲碗/通知需登入；admin 端點需 admin。
