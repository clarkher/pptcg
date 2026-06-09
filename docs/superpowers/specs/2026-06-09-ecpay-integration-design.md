# ECPay 綠界金流串接 + 移除餘額系統 設計文件

**日期：** 2026-06-09
**狀態：** 已核准，待實作

---

## 背景與目標

### 現況
- `User.wallet` 欄位（預設 1000 NT$）作為虛擬餘額
- 購買時後端直接扣買家 wallet、加賣家 wallet
- 每次只能買一張卡（單筆訂單 = 單個 Listing）

### 目標
1. **移除**整個 wallet/餘額系統
2. **串接綠界 AIO 金流**（信用卡、超商代碼）
3. **串接綠界物流 + 超商取貨付款**
4. **新增購物車**（一次結帳多張卡）
5. **支援退款**（後台管理員操作）

### 範圍說明
- 平台只有一位賣家（店主本人），無多賣家分潤邏輯
- 付款方式：信用卡 / 超商代碼 / 超商取貨付款（貨到付款）
- 不含：電子發票、分期、ATM 轉帳

---

## Section 1：資料模型

### 移除
```prisma
// User 移除此欄位
wallet Float @default(1000)
```

### 移除自 Order
```prisma
// 只有一個賣家（平台本身），sellerId 無意義，移除
sellerId String
seller   User @relation("seller", ...)
sales    Order[] @relation("seller")  // User 上也移除
```

### 新增：CartItem
```prisma
model CartItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id])
  quantity  Int      @default(1)
  createdAt DateTime @default(now())

  @@unique([userId, listingId])
}
```

### 改造：Order
現有 `Order` 以 `listingId`（單一商品）為核心，改為支援多商品。

```prisma
model Order {
  id              String      @id @default(cuid())
  merchantTradeNo String      @unique  // 我們生成，給綠界用（≤20字）

  buyerId         String
  buyer           User        @relation("buyer", fields: [buyerId], references: [id])
  items           OrderItem[]
  total           Float

  // 付款
  paymentMethod   String      // 'credit' | 'cvs' | 'cvs_cod'
  paymentStatus   String      @default("pending")  // 'pending' | 'paid' | 'failed'
  ecpayTradeNo    String?     // 綠界交易編號（付款後回傳）
  cvsPaymentCode  String?     // 超商代碼付款用
  cvsExpireDate   String?

  // 超商取貨付款
  shippingType    String?     // 'UNIMART' | 'FAMI' | 'HILIFE'
  storeId         String?
  storeName       String?
  receiverName    String?
  receiverPhone   String?

  // 訂單狀態
  status          String      @default("pending_payment")
  // pending_payment → paid → shipped → completed
  //                ↘ cancelled
  // paid / completed → refunded

  refundedAt      DateTime?
  refundNote      String?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

### 新增：PendingCheckout（超商取貨選門市用）

Railway 後端是無狀態服務，不能用記憶體 session。
選門市流程需要暫存購物車快照，用 DB 記錄解決：

```prisma
model PendingCheckout {
  id           String   @id @default(cuid())
  userId       String
  cartSnapshot Json     // CartItem 快照
  receiverName  String
  receiverPhone String
  shippingType  String   // 'UNIMART' | 'FAMI' | 'HILIFE'
  storeId       String?  // 綠界回傳後填入
  storeName     String?
  expiresAt    DateTime  // 建立後 30 分鐘過期
  createdAt    DateTime @default(now())
}
```

token = `PendingCheckout.id`，塞在 `CVSServerReplyURL` 的 query string 裡，
綠界回傳時後端靠此 id 找回記錄。

### 新增：OrderItem
```prisma
model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  listingId String
  listing   Listing @relation(fields: [listingId], references: [id])
  quantity  Int
  price     Float   // 下單時快照價格

  @@index([orderId])
}
```

---

## Section 2：付款流程

### 信用卡 / 超商代碼

```
買家點「結帳」
    ↓
前端：結帳頁（選付款方式、填收件人）
    ↓
POST /api/checkout
後端：建立 Order（status: pending_payment）
      計算 CheckMacValue
      回傳自動提交 HTML form
    ↓
瀏覽器：auto-submit → 跳轉綠界付款頁
    ↓
使用者付款
    ↓
綠界 → POST /api/ecpay/callback（ReturnURL，server-to-server）
         驗 CheckMacValue
         更新 Order.paymentStatus = 'paid'
         OrderItem 對應 Listing 全標 status = 'sold'
         清空 CartItem
         回應 "1|OK"
    ↓
綠界 → 瀏覽器跳回 /order-result?tradeNo=xxx（OrderResultURL）
         前端顯示「付款成功」或「超商代碼 + 截止日期」
```

### 超商取貨付款（多一步選門市）

```
買家選「超商取貨付款」
    ↓
POST /api/checkout/select-store
後端：暫存 session（購物車 snapshot + 收件人資料）
      回傳 HTML form
    ↓
瀏覽器 → 跳轉綠界門市地圖（選 7-11 / 全家 / 萊爾富）
    ↓
綠界 → POST /api/ecpay/store-callback（帶回 StoreID、StoreName）
         後端把門市資訊存入 session
         302 轉回前端 /checkout/store-confirm
    ↓
前端顯示「已選門市：OOOO 7-11 xxx 店」→ 使用者確認
    ↓
POST /api/checkout（帶 storeId）→ 走一般 AIO 流程
                                    但加入物流相關參數
```

### Callback 安全規則
- ReturnURL 必須是 server-side 路由（不能是前端 URL）
- 必須驗 CheckMacValue，失敗一律忽略回應 `0|ErrorMessage`
- 驗成功必須回應純文字 `1|OK`（否則綠界重試最多 5 次）

---

## Section 3：退款流程

### 信用卡退款
```
後台管理員點「退款」
    ↓
POST /api/admin/orders/:id/refund
後端 → POST 綠界 DoAction API
       Action=R、MerchantTradeNo、TradeNo、TotalAmount
       計算 CheckMacValue
    ↓
綠界回應 RtnCode=1 → 成功
    ↓
Order.status = 'refunded'
Order.refundedAt = now()
OrderItem 對應 Listing 全恢復 status = 'active'
```

### 超商代碼退款
| 情況 | 處理方式 |
|------|---------|
| 買家**尚未**去超商付款 | 直接作廢（不呼叫退款 API，更新 Order status = cancelled） |
| 買家**已付款** | 同信用卡走 DoAction |

### 超商取貨付款退款
| 情況 | 處理方式 |
|------|---------|
| 未出貨 | 取消物流訂單（綠界物流 Cancel API）|
| 已出貨 / 已取貨 | 現金交易，無法自動退款；後台標記 refundNote「請手動匯款給買家」|

---

## Section 4：後端 API

### 新增路由

| Method | Path | Auth | 說明 |
|--------|------|------|------|
| `GET` | `/api/cart` | 需登入 | 取得購物車 |
| `POST` | `/api/cart` | 需登入 | 加入商品 `{listingId, quantity}` |
| `DELETE` | `/api/cart/:listingId` | 需登入 | 移除單項 |
| `DELETE` | `/api/cart` | 需登入 | 清空購物車 |
| `POST` | `/api/checkout` | 需登入 | 建立訂單，回傳綠界 form |
| `POST` | `/api/checkout/select-store` | 需登入 | 超商取貨：產生選門市 form |
| `POST` | `/api/ecpay/callback` | **無需登入** | 綠界付款通知（ReturnURL）|
| `POST` | `/api/ecpay/store-callback` | **無需登入** | 綠界門市回傳 |
| `GET` | `/api/orders/:id` | 需登入 | 訂單詳情 |
| `POST` | `/api/admin/orders/:id/refund` | 需 admin | 退款 |

### 移除路由
- `POST /api/orders/buy`（wallet 扣款邏輯整個刪除）

### 環境變數

```env
# 金流
ECPAY_MERCHANT_ID=
ECPAY_HASH_KEY=
ECPAY_HASH_IV=

# 物流（金鑰與金流不同組）
ECPAY_LOGISTICS_MERCHANT_ID=
ECPAY_LOGISTICS_HASH_KEY=
ECPAY_LOGISTICS_HASH_IV=

# 環境切換
ECPAY_IS_STAGING=true   # false = 正式機

# 後端公開網址（供綠界 Callback 使用）
BACKEND_URL=https://pptcg-backend-staging-production.up.railway.app
```

**測試帳號（staging 開發用）**

| 服務 | MerchantID | HashKey | HashIV |
|------|-----------|---------|--------|
| 金流 | `3002607` | `pwFHCqoQZGmho4w6` | `EkRm7iFT261dpevs` |
| 物流 | `2000132` | `5294y06JbISpM5x9` | `v77hoKGq4kWxNNIS` |

---

## Section 5：前端

### 新增頁面

| 路由 | 說明 |
|------|------|
| `/cart` | 購物車頁（品項、數量、總計、結帳按鈕）|
| `/checkout` | 結帳頁（付款方式、收件人、確認訂單）|
| `/checkout/store-confirm` | 超商取貨：顯示已選門市，讓使用者確認 |
| `/order-result` | 付款結果頁（成功 / 超商代碼 / 失敗）|

### 修改位置

| 位置 | 變動 |
|------|------|
| `ListingDetail` | 「我的餘額 + 立即購買」→「加入購物車」按鈕 |
| `AppShell` | 移除餘額顯示，加購物車 icon（帶數量 badge）|
| `Profile` | 移除餘額區塊 |
| `types/index.ts` | 移除 `User.wallet` |
| `AdminDashboard` | 訂單列表加「退款」按鈕 |

### 結帳頁付款方式 UI

```
◉ 信用卡（一次付清）
○ 超商代碼（3 天內到 7-11 / 全家 / 萊爾富 付款）
○ 超商取貨付款（到店取貨時付現金）
   └─ [選擇取貨門市] → 點後跳到綠界門市地圖
```

---

## 不在本次範圍

- 電子發票
- ATM 轉帳
- 分期付款
- 多賣家分潤
- 物流追蹤狀態同步（出貨通知可之後加）
