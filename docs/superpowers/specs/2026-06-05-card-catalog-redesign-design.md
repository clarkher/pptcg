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

### 受控詞彙參照表（admin 可 CRUD）
把目前寫死／自由字串的稀有度、系列、品相改成 admin 可管理的參照資料，是「資料正確性」的核心。

```prisma
model Rarity {
  id        String @id @default(cuid())
  code      String @unique          // "C","U","R","RR","SR","AR","SAR","UR"...
  label     String                  // 顯示名稱
  color     String @default("#64748b") // 徽章顏色
  sortOrder Int    @default(0)       // 排序（同價時的次序、清單順序）
}

model Series {
  id        String  @id @default(cuid())
  key       String                   // "sv","swsh"...（對應 PokemonCard.seriesKey）
  name      String                   // 顯示名稱
  language  String                   // 系列為語言別
  logo      String?
  sortOrder Int     @default(0)
  @@unique([language, key])
}

model Condition {
  id        String @id @default(cuid())
  code      String @unique          // "NM","LP","MP","HP","PSA10"...（對應 Listing.condition）
  label     String                  // 顯示名稱（近完美/輕微磨損…）
  sortOrder Int    @default(0)
}
```
- `PokemonCard.rarity` 存 `Rarity.code`；`PokemonCard.seriesKey` 對應 `Series.key`；`Listing.condition` 存 `Condition.code`。
- 徽章顏色、清單/排序順序由參照表決定（前後台共用）。
- 這些表為「軟參照」（用 code 字串對應，不加外鍵約束），避免改 code/刪除時連鎖卡住既有資料；刪除使用中的 code 時後台**警告但不阻擋**，並在卡片管理頁標示「未知稀有度/品相」供修正。
- 需一支 seed/migration 把現有 `PokemonCard.rarity` distinct 值、`seriesKey/seriesName` distinct 值、以及現有品相（NM/LP/MP/HP）匯入這三張表作為初始資料。

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

## 後台手動修資料（資料正確性）

目錄 `PokemonCard` 來自匯入來源，rarity / 卡名 / 卡圖 / 套系歸屬可能有錯或缺漏。後台必須能**手動修正目錄資料**，確保前台顯示與篩選正確。

### 編輯目錄卡欄位
- 後台卡片詳情可編輯 `PokemonCard` 的：`name`、`number`、`rarity`、`image`、`imageHigh`、`seriesKey`、`seriesName`、`setId`、`setName`、`types`、`hp`、`supertype`。
- `rarity` / `seriesKey` / `condition` 以下拉選單從參照表（Rarity/Series/Condition）選，避免打錯。
- 編輯後前台立即反映（同一張 `PokemonCard`）。
- 修改 rarity 直接修正前台徽章與排序，是解「資料不準」的主要手段。

### 換圖
- 後台卡片詳情可**替換卡圖**：上傳新圖（沿用既有 upload worker `POST /upload` → 回傳 URL），更新 `PokemonCard.image`（高清圖選填 `imageHigh`）。
- 支援貼圖片 URL 或上傳檔案兩種方式。

### 參照資料管理頁（稀有度 / 系列 / 品相 CRUD）
- 後台新增「資料管理」頁，三個分頁分別 CRUD `Rarity`、`Series`、`Condition`：
  - **稀有度**：新增/編輯/刪除，欄位 code、label、徽章顏色、排序。
  - **系列**：新增/編輯/刪除，欄位 language、key、name、logo、排序。
  - **品相**：新增/編輯/刪除，欄位 code、label、排序。
- 刪除使用中的 code 會提示「目前有 N 張卡/庫存使用中」，確認後仍可刪（軟參照），受影響資料在卡片管理頁標示待修正。

### 手動新增缺漏的卡
- 來源缺某張卡時，admin 可**手動建立** `PokemonCard`（指定 id、語言、套系、卡號、卡名、圖、rarity…），之後即可進貨與被敲碗。
- id 格式沿用 `"{language}:{setId}-{number}"` 慣例；建立前檢查 id 不重複。

### 庫存↔目錄一致性
- 建立庫存（Listing）時 `cardId` 必須對應到既有 `PokemonCard.id`；不符則擋下並提示，避免產生「孤兒庫存」（前台 join 不到目錄卡）。
- 後台提供「孤兒庫存檢查」：列出 `cardId` 找不到對應 `PokemonCard` 的 Listing，供手動修正或補建目錄卡。

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
- `PATCH /admin/cards/:id` `{ name?, number?, rarity?, image?, imageHigh?, seriesKey?, seriesName?, setId?, setName?, types?, hp?, supertype? }` — 手動修正目錄卡欄位。
- `POST /admin/cards` `{ id, language, setId, setName, seriesKey, seriesName, number, name, image, rarity?, ... }` — 手動新增缺漏目錄卡（檢查 id 不重複）。
- `GET /admin/orphan-listings` — 列出 `cardId` 對不到 `PokemonCard` 的庫存。

參照資料 CRUD（需 admin）：
- 稀有度：`GET /admin/rarities`、`POST /admin/rarities`、`PATCH /admin/rarities/:id`、`DELETE /admin/rarities/:id`
- 系列：`GET /admin/series-defs?language=`、`POST /admin/series-defs`、`PATCH /admin/series-defs/:id`、`DELETE /admin/series-defs/:id`
- 品相：`GET /admin/conditions`、`POST /admin/conditions`、`PATCH /admin/conditions/:id`、`DELETE /admin/conditions/:id`
- 刪除前回傳 `inUseCount`（使用該 code 的卡/庫存數）供前端提示。

前台讀取參照資料（公開）：
- `GET /catalog/rarities`、`GET /catalog/conditions`（給徽章顏色/排序/品相標籤用；series 已由 `/catalog/series` 提供）。

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
- 後台修目錄卡欄位後，前台彙整/徽章/排序即時反映。
- 建立 `cardId` 對不到目錄卡的庫存會被擋下；孤兒庫存檢查能正確列出。
- 手動新增目錄卡：id 重複會被擋；新增後可進貨並被敲碗。
- 換圖：上傳後 `PokemonCard.image` 更新，前台顯示新圖。
- 參照資料 CRUD：稀有度/系列/品相新增後出現在卡片編輯下拉；刪除使用中 code 回報 `inUseCount` 且不連鎖損壞既有資料。
- seed migration：現有 rarity/series/condition distinct 值正確匯入三張參照表。
- 徽章顏色與排序由 `Rarity` 參照表驅動（改顏色/排序前台即時反映）。
