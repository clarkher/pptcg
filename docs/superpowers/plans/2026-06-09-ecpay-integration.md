# ECPay 金流串接 + 移除餘額系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 wallet 虛擬餘額，串接綠界 AIO 金流（信用卡 + 超商代碼 + 超商取貨付款），加入購物車，支援後台退款。

**Architecture:** 後端新增 ECPay helper lib（CheckMacValue + form 產生）、Cart / Checkout / ECPay callback 路由；前端新增購物車頁、結帳頁、付款結果頁；所有 wallet 相關 code 全數移除。ECPay AIO redirect 模式：後端產生 form params → 前端動態提交 form → 綠界付款頁 → server callback 更新 Order。

**Tech Stack:** Node.js/TypeScript/Express/Prisma（後端）、React/TypeScript/Zustand（前端）、綠界 AIO 金流 API + 物流 API

---

## 檔案地圖

### 後端（新增）
- `backend/src/lib/ecpay.ts` — CheckMacValue(SHA256)、AIO form params、日期格式
- `backend/src/lib/ecpay-logistics.ts` — CheckMacValue(MD5)、門市地圖 form、物流訂單建立
- `backend/src/controllers/cart.ts` — 購物車 CRUD
- `backend/src/controllers/checkout.ts` — 結帳 + 綠界 callbacks
- `backend/src/routes/cart.ts`
- `backend/src/routes/checkout.ts`
- `backend/src/routes/ecpay.ts`

### 後端（修改）
- `backend/prisma/schema.prisma` — 移除 wallet, 新增 CartItem/OrderItem/PendingCheckout, 改 Order
- `backend/src/controllers/auth.ts` — 移除 wallet 欄位
- `backend/src/controllers/orders.ts` — 移除 buyListing（只保留 getMyOrders）
- `backend/src/controllers/admin.ts` — 新增 refundOrder
- `backend/src/routes/orders.ts` — 移除 POST /
- `backend/src/app.ts` — 新增路由

### 前端（新增）
- `frontend/src/api/cart.ts`
- `frontend/src/api/checkout.ts`
- `frontend/src/pages/Cart.tsx`
- `frontend/src/pages/Checkout.tsx`
- `frontend/src/pages/CheckoutStoreConfirm.tsx`
- `frontend/src/pages/OrderResult.tsx`

### 前端（修改）
- `frontend/src/types/index.ts` — 移除 wallet, 更新 Order, 新增 CartItem
- `frontend/src/components/AppShell.tsx` — 移除餘額, 加購物車 icon
- `frontend/src/pages/ListingDetail.tsx` — 改「加入購物車」
- `frontend/src/pages/Profile.tsx` — 移除餘額區塊
- `frontend/src/pages/admin/AdminDashboard.tsx` — 加退款按鈕
- `frontend/src/App.tsx` — 新增路由

---

## Task 1：DB Schema Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: 修改 schema.prisma**

將以下模型替換進 `backend/prisma/schema.prisma`（其他模型不動）：

```prisma
// ─── User：移除 wallet ────────────────────────────────────────
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  username  String    @unique
  password  String?
  googleId  String?   @unique
  avatar    String?
  isAdmin   Boolean   @default(false)
  lineUid   String?   @unique
  createdAt DateTime  @default(now())
  listings  Listing[]
  orders    Order[]   @relation("buyer")
  cartItems CartItem[]
  wishlists     Wishlist[]
  notifications Notification[]
}

// ─── CartItem ────────────────────────────────────────────────
model CartItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id])
  quantity  Int      @default(1)
  createdAt DateTime @default(now())

  @@unique([userId, listingId])
  @@index([userId])
}

// ─── PendingCheckout（超商取貨付款選門市暫存）──────────────────
model PendingCheckout {
  id            String   @id @default(cuid())
  userId        String
  cartSnapshot  Json     // CartItem[] snapshot
  receiverName  String
  receiverPhone String
  shippingType  String   // 'UNIMART' | 'FAMI' | 'HILIFE'
  storeId       String?
  storeName     String?
  storeAddress  String?
  expiresAt     DateTime
  createdAt     DateTime @default(now())

  @@index([userId])
}

// ─── Order（改版：多商品、完整付款狀態）──────────────────────────
model Order {
  id              String      @id @default(cuid())
  merchantTradeNo String      @unique
  buyerId         String
  buyer           User        @relation("buyer", fields: [buyerId], references: [id])
  items           OrderItem[]
  total           Float

  paymentMethod   String      // 'credit' | 'cvs' | 'cvs_cod'
  paymentStatus   String      @default("pending")  // 'pending' | 'paid' | 'failed'
  ecpayTradeNo    String?
  cvsPaymentCode  String?
  cvsExpireDate   String?

  // 超商取貨付款
  shippingType    String?
  storeId         String?
  storeName       String?
  logisticsId     String?     // ECPay AllPayLogisticsID
  bookingNote     String?     // 出貨書號（賣家印在包裹上）

  receiverName    String?
  receiverPhone   String?

  status          String      @default("pending_payment")
  // pending_payment | paid | shipped | completed | cancelled | refunded
  refundedAt      DateTime?
  refundNote      String?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

// ─── OrderItem ───────────────────────────────────────────────
model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  listingId String
  listing   Listing @relation(fields: [listingId], references: [id])
  quantity  Int
  price     Float

  @@index([orderId])
}
```

同時在 `Listing` 模型加上兩個關聯（在 `orders Order[]` 後面）：
```prisma
  cartItems CartItem[]
  orderItems OrderItem[]
```

- [ ] **Step 2: 建立 migration**

```bash
cd /Users/hepinru/PPTCG/backend
# 先設定 DATABASE_URL 為 staging Neon URL
DATABASE_URL=$(railway variables -s pptcg-backend-staging --kv | grep DATABASE_URL | cut -d'=' -f2-)
DATABASE_URL=$DATABASE_URL npx prisma migrate dev --name ecpay-integration
```

預期輸出：`✓ Generated Prisma Client`

- [ ] **Step 3: 更新 .env.example**

在 `backend/.env.example` 末尾加入：
```env
# ECPay 金流（AIO）
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs

# ECPay 物流（國內）
ECPAY_LOGISTICS_MERCHANT_ID=2000132
ECPAY_LOGISTICS_HASH_KEY=5294y06JbISpM5x9
ECPAY_LOGISTICS_HASH_IV=v77hoKGq4kWxNNIS

# 環境（staging=true 用測試機，false 用正式機）
ECPAY_IS_STAGING=true

# 後端公開網址（給綠界 Callback 用）
BACKEND_URL=https://pptcg-backend-staging-production.up.railway.app

# 前端網址（付款完成後跳回用）
FRONTEND_URL=https://pptcg-dev.vercel.app
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/.env.example
git commit -m "feat: schema migration for ecpay integration"
```

---

## Task 2：ECPay Payment Helper Library

**Files:**
- Create: `backend/src/lib/ecpay.ts`

- [ ] **Step 1: 建立 `backend/src/lib/ecpay.ts`**

```typescript
import crypto from 'crypto';

// ─── 型別 ─────────────────────────────────────────────────────

export interface EcpayConfig {
  merchantId: string;
  hashKey: string;
  hashIv: string;
  isStaging: boolean;
}

export interface AioParams {
  [key: string]: string;
}

// ─── 設定（從環境變數讀） ──────────────────────────────────────

export function getPaymentConfig(): EcpayConfig {
  return {
    merchantId: process.env.ECPAY_MERCHANT_ID!,
    hashKey: process.env.ECPAY_HASH_KEY!,
    hashIv: process.env.ECPAY_HASH_IV!,
    isStaging: process.env.ECPAY_IS_STAGING !== 'false',
  };
}

export function getAioBaseUrl(isStaging: boolean): string {
  return isStaging
    ? 'https://payment-stage.ecpay.com.tw'
    : 'https://payment.ecpay.com.tw';
}

// ─── CheckMacValue（SHA256，AIO 金流用）───────────────────────

function ecpayUrlEncode(source: string): string {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const restorations: Record<string, string> = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [enc, char] of Object.entries(restorations)) {
    encoded = encoded.split(enc).join(char);
  }
  return encoded;
}

export function generateCheckMacValue(
  params: AioParams,
  hashKey: string,
  hashIv: string,
  method: 'sha256' | 'md5' = 'sha256',
): string {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue'),
  );
  const sorted = Object.keys(filtered).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash(method).update(encoded, 'utf8').digest('hex').toUpperCase();
}

export function verifyCheckMacValue(
  params: AioParams,
  hashKey: string,
  hashIv: string,
  method: 'sha256' | 'md5' = 'sha256',
): boolean {
  const received = params.CheckMacValue ?? '';
  const calculated = generateCheckMacValue(params, hashKey, hashIv, method);
  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── 日期格式（台灣時間 Asia/Taipei）────────────────────────────

export function getMerchantTradeDate(): string {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(/-/g, '/');
  // → "2026/06/09 14:30:00"
}

// ─── MerchantTradeNo 產生（≤20 英數字，唯一）─────────────────────

export function generateMerchantTradeNo(): string {
  const ts = Date.now().toString(); // 13 digits
  const rand = Math.floor(Math.random() * 9000 + 1000).toString(); // 4 digits
  return `PP${ts}${rand}`; // 2+13+4 = 19 chars
}

// ─── AIO Checkout Params 建構 ────────────────────────────────

interface BuildAioParams {
  merchantTradeNo: string;
  total: number;           // 整數（NT$）
  itemName: string;        // 商品名，多項用 # 連接，最長 400 chars
  choosePayment: 'Credit' | 'CVS' | 'ALL';
  returnUrl: string;       // server-to-server callback
  orderResultUrl: string;  // browser redirect after payment
  clientBackUrl?: string;  // 「返回商店」按鈕 URL
}

export function buildAioParams(
  p: BuildAioParams,
  config: EcpayConfig,
): AioParams {
  const params: AioParams = {
    MerchantID: config.merchantId,
    MerchantTradeNo: p.merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(Math.round(p.total)),
    TradeDesc: encodeURIComponent('卡拍拍訂單'),
    ItemName: p.itemName.slice(0, 400),
    ReturnURL: p.returnUrl,
    OrderResultURL: p.orderResultUrl,
    ChoosePayment: p.choosePayment,
    EncryptType: '1',
    ...(p.clientBackUrl ? { ClientBackURL: p.clientBackUrl } : {}),
    // CVS 超商代碼：3 天有效
    ...(p.choosePayment === 'CVS' ? { StoreExpireSeconds: '259200' } : {}),
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);
  return params;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/lib/ecpay.ts
git commit -m "feat: ecpay payment helper (CheckMacValue + AIO params)"
```

---

## Task 3：ECPay Logistics Helper Library

**Files:**
- Create: `backend/src/lib/ecpay-logistics.ts`

- [ ] **Step 1: 建立 `backend/src/lib/ecpay-logistics.ts`**

```typescript
import { generateCheckMacValue } from './ecpay';
import { getMerchantTradeDate } from './ecpay';

export interface LogisticsConfig {
  merchantId: string;
  hashKey: string;
  hashIv: string;
  isStaging: boolean;
}

export type ShippingType = 'UNIMART' | 'FAMI' | 'HILIFE';

// LogisticsSubType for C2C (不需額外申請 B2C)
const CVS_SUBTYPE: Record<ShippingType, string> = {
  UNIMART: 'UNIMARTC2C',
  FAMI: 'FAMIC2C',
  HILIFE: 'HILIFEC2C',
};

export function getLogisticsConfig(): LogisticsConfig {
  return {
    merchantId: process.env.ECPAY_LOGISTICS_MERCHANT_ID!,
    hashKey: process.env.ECPAY_LOGISTICS_HASH_KEY!,
    hashIv: process.env.ECPAY_LOGISTICS_HASH_IV!,
    isStaging: process.env.ECPAY_IS_STAGING !== 'false',
  };
}

function getLogisticsBaseUrl(isStaging: boolean): string {
  return isStaging
    ? 'https://logistics-stage.ecpay.com.tw'
    : 'https://logistics.ecpay.com.tw';
}

// ─── 門市地圖選取 form params ─────────────────────────────────

export function buildStoreMapParams(opts: {
  shippingType: ShippingType;
  serverReplyUrl: string;   // 後端 store-callback endpoint
  extraData: string;         // pendingCheckoutId，ECPay 原封回傳
}, config: LogisticsConfig): { url: string; params: Record<string, string> } {
  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    LogisticsType: 'CVS',
    LogisticsSubType: CVS_SUBTYPE[opts.shippingType],
    IsCollection: 'Y',
    ServerReplyURL: opts.serverReplyUrl,
    ExtraData: opts.extraData,
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv, 'md5');

  return {
    url: `${getLogisticsBaseUrl(config.isStaging)}/Express/map`,
    params,
  };
}

// ─── 建立物流訂單（Create）────────────────────────────────────

export interface CreateLogisticsOrderParams {
  merchantTradeNo: string;
  goodsAmount: number;
  goodsName: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  receiverStoreId: string;
  shippingType: ShippingType;
  serverReplyUrl: string;  // 物流狀態 callback
}

export interface LogisticsOrderResult {
  allPayLogisticsId: string;
  bookingNote: string;
}

export async function createLogisticsOrder(
  p: CreateLogisticsOrderParams,
  config: LogisticsConfig,
): Promise<LogisticsOrderResult> {
  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: p.merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    LogisticsType: 'CVS',
    LogisticsSubType: CVS_SUBTYPE[p.shippingType],
    GoodsAmount: String(Math.round(p.goodsAmount)),
    IsCollection: 'Y',
    CollectionAmount: String(Math.round(p.goodsAmount)),
    GoodsName: p.goodsName.slice(0, 50),
    SenderName: p.senderName,
    SenderPhone: p.senderPhone,
    ReceiverName: p.receiverName,
    ReceiverCellPhone: p.receiverPhone,
    ReceiverStoreID: p.receiverStoreId,
    ServerReplyURL: p.serverReplyUrl,
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv, 'md5');

  const url = `${getLogisticsBaseUrl(config.isStaging)}/Express/Create`;
  const body = new URLSearchParams(params).toString();

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) throw new Error(`Logistics API HTTP ${resp.status}`);

  const text = await resp.text();
  // 回應格式：key1=value1&key2=value2
  const result = Object.fromEntries(new URLSearchParams(text));
  if (result.RtnCode !== '1') {
    throw new Error(`Logistics API error: ${result.RtnMsg}`);
  }

  return {
    allPayLogisticsId: result.AllPayLogisticsID ?? '',
    bookingNote: result.BookingNote ?? '',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/lib/ecpay-logistics.ts
git commit -m "feat: ecpay logistics helper (store map + order creation)"
```

---

## Task 4：Cart API

**Files:**
- Create: `backend/src/controllers/cart.ts`
- Create: `backend/src/routes/cart.ts`

- [ ] **Step 1: 建立 `backend/src/controllers/cart.ts`**

```typescript
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// GET /api/cart
export async function getCart(req: AuthRequest, res: Response) {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.userId! },
    include: {
      listing: {
        select: {
          id: true, cardName: true, cardImage: true, price: true,
          quantity: true, status: true, condition: true, language: true,
          seller: { select: { username: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
}

// POST /api/cart  body: { listingId, quantity? }
export async function addToCart(req: AuthRequest, res: Response) {
  const { listingId, quantity = 1 } = req.body;
  if (!listingId) {
    res.status(400).json({ error: '缺少 listingId' });
    return;
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'active') {
    res.status(400).json({ error: '商品不存在或已售出' });
    return;
  }
  if (listing.sellerId === req.userId) {
    res.status(400).json({ error: '無法加入自己的商品' });
    return;
  }

  const item = await prisma.cartItem.upsert({
    where: { userId_listingId: { userId: req.userId!, listingId } },
    update: { quantity: Math.min(quantity, listing.quantity) },
    create: { userId: req.userId!, listingId, quantity: Math.min(quantity, listing.quantity) },
    include: { listing: { select: { cardName: true, price: true } } },
  });

  res.status(201).json(item);
}

// DELETE /api/cart/:listingId
export async function removeFromCart(req: AuthRequest, res: Response) {
  const { listingId } = req.params;
  await prisma.cartItem.deleteMany({
    where: { userId: req.userId!, listingId },
  });
  res.json({ ok: true });
}

// DELETE /api/cart
export async function clearCart(req: AuthRequest, res: Response) {
  await prisma.cartItem.deleteMany({ where: { userId: req.userId! } });
  res.json({ ok: true });
}
```

- [ ] **Step 2: 建立 `backend/src/routes/cart.ts`**

```typescript
import { Router } from 'express';
import { getCart, addToCart, removeFromCart, clearCart } from '../controllers/cart';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.get('/', getCart);
router.post('/', addToCart);
router.delete('/:listingId', removeFromCart);
router.delete('/', clearCart);
export default router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/cart.ts backend/src/routes/cart.ts
git commit -m "feat: cart API (add/remove/clear)"
```

---

## Task 5：Checkout API（信用卡 + 超商代碼）

**Files:**
- Create: `backend/src/controllers/checkout.ts`
- Create: `backend/src/routes/checkout.ts`

- [ ] **Step 1: 建立 `backend/src/controllers/checkout.ts`**

```typescript
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  getPaymentConfig, getAioBaseUrl,
  buildAioParams, generateMerchantTradeNo,
  verifyCheckMacValue,
} from '../lib/ecpay';
import {
  getLogisticsConfig, buildStoreMapParams,
  createLogisticsOrder, type ShippingType,
} from '../lib/ecpay-logistics';

const BACKEND_URL = () => process.env.BACKEND_URL!;
const FRONTEND_URL = () => process.env.FRONTEND_URL!;

// ─── POST /api/checkout ──────────────────────────────────────
// body: { paymentMethod: 'credit' | 'cvs', receiverName, receiverPhone }
// Returns: { orderId, ecpayUrl, ecpayParams }
export async function createCheckout(req: AuthRequest, res: Response) {
  const { paymentMethod, receiverName, receiverPhone } = req.body;
  if (!['credit', 'cvs'].includes(paymentMethod)) {
    res.status(400).json({ error: '不支援的付款方式' });
    return;
  }

  // 1. 取購物車
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.userId! },
    include: { listing: true },
  });
  if (cartItems.length === 0) {
    res.status(400).json({ error: '購物車是空的' });
    return;
  }

  // 2. 驗證所有商品仍 active
  const inactive = cartItems.filter(ci => ci.listing.status !== 'active');
  if (inactive.length > 0) {
    res.status(400).json({
      error: `部分商品已售出：${inactive.map(ci => ci.listing.cardName).join('、')}`,
    });
    return;
  }

  // 3. 計算總金額
  const total = cartItems.reduce((sum, ci) => sum + ci.listing.price * ci.quantity, 0);
  const merchantTradeNo = generateMerchantTradeNo();

  // 4. 建立 Order + OrderItem（DB transaction）
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        merchantTradeNo,
        buyerId: req.userId!,
        total,
        paymentMethod,
        receiverName: receiverName || null,
        receiverPhone: receiverPhone || null,
        items: {
          create: cartItems.map(ci => ({
            listingId: ci.listingId,
            quantity: ci.quantity,
            price: ci.listing.price,
          })),
        },
      },
    });
    return o;
  });

  // 5. 建構 AIO params
  const config = getPaymentConfig();
  const itemName = cartItems
    .map(ci => ci.listing.cardName)
    .join('#')
    .slice(0, 400);

  const choosePayment = paymentMethod === 'credit' ? 'Credit' : 'CVS';
  const ecpayParams = buildAioParams({
    merchantTradeNo,
    total,
    itemName,
    choosePayment,
    returnUrl: `${BACKEND_URL()}/api/ecpay/payment-callback`,
    orderResultUrl: `${BACKEND_URL()}/api/ecpay/order-result`,
    clientBackUrl: `${FRONTEND_URL()}/cart`,
  }, config);

  res.json({
    orderId: order.id,
    ecpayUrl: `${getAioBaseUrl(config.isStaging)}/Cashier/AioCheckOut/V5`,
    ecpayParams,
  });
}

// ─── POST /api/checkout/select-store ─────────────────────────
// body: { receiverName, receiverPhone, shippingType: 'UNIMART'|'FAMI'|'HILIFE' }
// Returns: { pendingId, ecpayUrl, ecpayParams }
export async function selectStore(req: AuthRequest, res: Response) {
  const { receiverName, receiverPhone, shippingType } = req.body;
  if (!['UNIMART', 'FAMI', 'HILIFE'].includes(shippingType)) {
    res.status(400).json({ error: '不支援的物流類型' });
    return;
  }
  if (!receiverName || !receiverPhone) {
    res.status(400).json({ error: '請填寫收件人姓名和電話' });
    return;
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.userId! },
    include: { listing: { select: { id: true, cardName: true, price: true } } },
  });
  if (cartItems.length === 0) {
    res.status(400).json({ error: '購物車是空的' });
    return;
  }

  // 建立 PendingCheckout（30 分鐘過期）
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const pending = await prisma.pendingCheckout.create({
    data: {
      userId: req.userId!,
      cartSnapshot: cartItems as any,
      receiverName,
      receiverPhone,
      shippingType,
      expiresAt,
    },
  });

  const config = getLogisticsConfig();
  const { url, params } = buildStoreMapParams({
    shippingType: shippingType as ShippingType,
    serverReplyUrl: `${BACKEND_URL()}/api/ecpay/store-callback`,
    extraData: pending.id,
  }, config);

  res.json({ pendingId: pending.id, ecpayUrl: url, ecpayParams: params });
}

// ─── POST /api/checkout/confirm-store ────────────────────────
// body: { pendingId }
// Returns: { orderId, ecpayUrl, ecpayParams } — 跟信用卡/超商一樣，但改用物流建立訂單
export async function confirmStore(req: AuthRequest, res: Response) {
  const { pendingId } = req.body;
  const pending = await prisma.pendingCheckout.findUnique({ where: { id: pendingId } });

  if (!pending || pending.userId !== req.userId) {
    res.status(400).json({ error: '找不到門市選取記錄' });
    return;
  }
  if (!pending.storeId) {
    res.status(400).json({ error: '尚未選擇門市' });
    return;
  }
  if (pending.expiresAt < new Date()) {
    res.status(400).json({ error: '門市選取已逾時，請重新選擇' });
    return;
  }

  const snapshot = pending.cartSnapshot as any[];
  const total = snapshot.reduce((sum: number, ci: any) => sum + ci.listing.price * ci.quantity, 0);
  const merchantTradeNo = generateMerchantTradeNo();
  const itemName = snapshot.map((ci: any) => ci.listing.cardName).join('#').slice(0, 50);

  // 建立 Order
  const order = await prisma.order.create({
    data: {
      merchantTradeNo,
      buyerId: req.userId!,
      total,
      paymentMethod: 'cvs_cod',
      shippingType: pending.shippingType,
      storeId: pending.storeId,
      storeName: pending.storeName || null,
      receiverName: pending.receiverName,
      receiverPhone: pending.receiverPhone,
      items: {
        create: snapshot.map((ci: any) => ({
          listingId: ci.listingId,
          quantity: ci.quantity,
          price: ci.listing.price,
        })),
      },
    },
  });

  // 建立綠界物流訂單
  const logConfig = getLogisticsConfig();
  try {
    const logResult = await createLogisticsOrder({
      merchantTradeNo,
      goodsAmount: total,
      goodsName: itemName,
      senderName: '卡拍拍',
      senderPhone: process.env.SENDER_PHONE || '0912345678',
      receiverName: pending.receiverName,
      receiverPhone: pending.receiverPhone,
      receiverStoreId: pending.storeId,
      shippingType: pending.shippingType as ShippingType,
      serverReplyUrl: `${BACKEND_URL()}/api/ecpay/logistics-callback`,
    }, logConfig);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        logisticsId: logResult.allPayLogisticsId,
        bookingNote: logResult.bookingNote,
        status: 'paid',            // COD 視為「待出貨」
        paymentStatus: 'pending',  // 實際付款在取貨時
      },
    });
  } catch (err: any) {
    // 物流建立失敗 → Order 仍存在，之後可重試
    console.error('Logistics order creation failed:', err.message);
  }

  // 清空購物車
  await prisma.cartItem.deleteMany({ where: { userId: req.userId! } });
  // 把 Listing 標 sold
  for (const ci of snapshot) {
    await prisma.listing.update({ where: { id: ci.listingId }, data: { status: 'sold' } });
  }
  // 刪除 PendingCheckout
  await prisma.pendingCheckout.delete({ where: { id: pendingId } });

  res.json({ orderId: order.id });
}
```

- [ ] **Step 2: 建立 `backend/src/routes/checkout.ts`**

```typescript
import { Router } from 'express';
import { createCheckout, selectStore, confirmStore } from '../controllers/checkout';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.post('/', createCheckout);
router.post('/select-store', selectStore);
router.post('/confirm-store', confirmStore);
export default router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/checkout.ts backend/src/routes/checkout.ts
git commit -m "feat: checkout API (credit card, CVS code, CVS COD store confirm)"
```

---

## Task 6：ECPay Callbacks

**Files:**
- Create: `backend/src/controllers/ecpay-callbacks.ts`
- Create: `backend/src/routes/ecpay.ts`

- [ ] **Step 1: 建立 `backend/src/controllers/ecpay-callbacks.ts`**

```typescript
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyCheckMacValue, getPaymentConfig } from '../lib/ecpay';

const FRONTEND_URL = () => process.env.FRONTEND_URL!;

// ─── POST /api/ecpay/payment-callback（server-to-server，綠界通知）
export async function paymentCallback(req: Request, res: Response) {
  const params = req.body as Record<string, string>;
  const config = getPaymentConfig();

  // 1. 驗 CheckMacValue（timing-safe）
  if (!verifyCheckMacValue(params, config.hashKey, config.hashIv)) {
    console.error('ECPay payment callback: invalid CheckMacValue');
    res.status(200).type('text/plain').send('0|CheckMacValue Error');
    return;
  }

  // 2. 找訂單
  const order = await prisma.order.findUnique({
    where: { merchantTradeNo: params.MerchantTradeNo },
    include: { items: true },
  });
  if (!order) {
    res.status(200).type('text/plain').send('0|Order Not Found');
    return;
  }

  // 3. 已處理過的 callback 直接回 OK（冪等）
  if (order.paymentStatus === 'paid') {
    res.status(200).type('text/plain').send('1|OK');
    return;
  }

  if (params.RtnCode === '1') {
    // 付款成功
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'paid',
          status: 'paid',
          ecpayTradeNo: params.TradeNo,
          // CVS 超商代碼付款時 PaymentTypeChargeFee / ... 等欄位無需儲存
        },
      });
      // 所有 OrderItem 對應的 Listing 標 sold
      for (const item of order.items) {
        await tx.listing.update({ where: { id: item.listingId }, data: { status: 'sold' } });
      }
      // 清空 CartItem（若買家還沒清）
      await tx.cartItem.deleteMany({ where: { userId: order.buyerId } });
    });

  } else if (['10200047', '10200049'].includes(params.RtnCode)) {
    // 超商代碼：取號成功（尚未付款）
    await prisma.order.update({
      where: { id: order.id },
      data: {
        cvsPaymentCode: params.PaymentNo ?? params.TradeNo,
        cvsExpireDate: params.ExpireDate ?? '',
        status: 'pending_payment',
        ecpayTradeNo: params.TradeNo,
      },
    });
    // 清空購物車（已取號，商品暫時鎖定）
    await prisma.cartItem.deleteMany({ where: { userId: order.buyerId } });
    // Listing 標 reserved（或直接 sold，視業務邏輯）
    for (const item of order.items) {
      await prisma.listing.update({ where: { id: item.listingId }, data: { status: 'sold' } });
    }
  }

  res.status(200).type('text/plain').send('1|OK');
}

// ─── GET+POST /api/ecpay/order-result（瀏覽器跳回，轉址到前端）
export async function orderResult(req: Request, res: Response) {
  // ECPay 可能用 GET 或 POST，統一取 MerchantTradeNo
  const tradeNo = (req.body?.MerchantTradeNo ?? req.query?.MerchantTradeNo ?? '') as string;
  const rtnCode = (req.body?.RtnCode ?? req.query?.RtnCode ?? '0') as string;

  const status = rtnCode === '1' ? 'success' : 'fail';
  res.redirect(`${FRONTEND_URL()}/order-result?tradeNo=${tradeNo}&status=${status}`);
}

// ─── POST /api/ecpay/store-callback（瀏覽器表單 POST，選門市後跳回）
export async function storeCallback(req: Request, res: Response) {
  const { CVSStoreID, CVSStoreName, CVSAddress, ExtraData, LogisticsSubType } = req.body;

  if (!ExtraData || !CVSStoreID) {
    res.status(400).send('Missing required fields');
    return;
  }

  const pending = await prisma.pendingCheckout.findUnique({ where: { id: ExtraData } });
  if (!pending) {
    res.status(400).send('PendingCheckout not found');
    return;
  }

  await prisma.pendingCheckout.update({
    where: { id: ExtraData },
    data: {
      storeId: CVSStoreID,
      storeName: CVSStoreName ?? '',
      storeAddress: CVSAddress ?? '',
    },
  });

  // 跳回前端確認頁
  res.redirect(`${FRONTEND_URL()}/checkout/store-confirm?id=${ExtraData}`);
}

// ─── POST /api/ecpay/logistics-callback（物流狀態通知）
export async function logisticsCallback(req: Request, res: Response) {
  const { AllPayLogisticsID, RtnCode, RtnMsg } = req.body;
  console.log(`Logistics callback: ${AllPayLogisticsID} RtnCode=${RtnCode} ${RtnMsg}`);

  if (RtnCode === '300') {
    // 取貨成功，付款完成
    await prisma.order.updateMany({
      where: { logisticsId: AllPayLogisticsID },
      data: { paymentStatus: 'paid', status: 'completed' },
    });
  }

  res.status(200).type('text/plain').send('1|OK');
}
```

- [ ] **Step 2: 建立 `backend/src/routes/ecpay.ts`**

```typescript
import { Router } from 'express';
import {
  paymentCallback,
  orderResult,
  storeCallback,
  logisticsCallback,
} from '../controllers/ecpay-callbacks';

const router = Router();
// 這些 endpoints 不需要使用者登入（綠界直接呼叫）
router.post('/payment-callback', paymentCallback);
router.get('/order-result', orderResult);
router.post('/order-result', orderResult);
router.post('/store-callback', storeCallback);
router.post('/logistics-callback', logisticsCallback);
export default router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/ecpay-callbacks.ts backend/src/routes/ecpay.ts
git commit -m "feat: ecpay callbacks (payment, order result, store selection, logistics)"
```

---

## Task 7：退款 + 清除 Wallet 相關 Code

**Files:**
- Modify: `backend/src/controllers/auth.ts`
- Modify: `backend/src/controllers/orders.ts`
- Modify: `backend/src/controllers/admin.ts`
- Modify: `backend/src/routes/orders.ts`

- [ ] **Step 1: 移除 `auth.ts` 中所有 wallet**

在 `backend/src/controllers/auth.ts` 做 3 處修改：

**register 函式**：`select` 改為
```typescript
select: { id: true, email: true, username: true, isAdmin: true },
```

**login 函式**：`res.json` 改為
```typescript
res.json({
  user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin },
  token,
});
```

**googleLogin 函式**：同上格式（搜尋 `wallet: user.wallet` 共 2 處，全部移除）

**me 函式**：`select` 改為
```typescript
select: { id: true, email: true, username: true, avatar: true, isAdmin: true, lineUid: true },
```

- [ ] **Step 2: 簡化 `orders.ts`（移除 buyListing，保留 getMyOrders）**

將 `backend/src/controllers/orders.ts` 整個改為：
```typescript
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function getMyOrders(req: AuthRequest, res: Response) {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.userId },
    include: {
      items: {
        include: {
          listing: {
            select: { cardName: true, cardImage: true, condition: true, language: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}

export async function getOrder(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const order = await prisma.order.findFirst({
    where: { id, buyerId: req.userId },
    include: {
      items: {
        include: { listing: true },
      },
    },
  });
  if (!order) {
    res.status(404).json({ error: '訂單不存在' });
    return;
  }
  res.json(order);
}
```

- [ ] **Step 3: 修改 `routes/orders.ts`**

```typescript
import { Router } from 'express';
import { getMyOrders, getOrder } from '../controllers/orders';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.get('/mine', getMyOrders);
router.get('/:id', getOrder);
export default router;
```

- [ ] **Step 4: 在 `admin.ts` 加入 refundOrder**

在 `backend/src/controllers/admin.ts` 末尾加入：

```typescript
import { getPaymentConfig } from '../lib/ecpay';

// POST /api/admin/orders/:id/refund
// body: { note? }
export async function refundOrder(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { note } = req.body;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    res.status(404).json({ error: '訂單不存在' });
    return;
  }
  if (!['paid', 'completed'].includes(order.status)) {
    res.status(400).json({ error: '只有已付款訂單可退款' });
    return;
  }
  if (order.paymentMethod === 'cvs_cod') {
    // CVS COD 是現金，無法自動退款
    await prisma.order.update({
      where: { id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundNote: note || '超商取貨付款，請手動退款給買家',
      },
    });
    for (const item of order.items) {
      await prisma.listing.update({ where: { id: item.listingId }, data: { status: 'active' } });
    }
    res.json({ ok: true, note: '已標記退款，請手動匯款' });
    return;
  }

  if (!order.ecpayTradeNo) {
    res.status(400).json({ error: '找不到綠界交易號' });
    return;
  }

  // 呼叫綠界 DoAction 退款
  const config = getPaymentConfig();
  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: order.merchantTradeNo,
    TradeNo: order.ecpayTradeNo,
    Action: 'R',
    TotalAmount: String(Math.round(order.total)),
  };
  const { generateCheckMacValue } = await import('../lib/ecpay');
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);

  const baseUrl = config.isStaging
    ? 'https://payment-stage.ecpay.com.tw'
    : 'https://payment.ecpay.com.tw';
  const body = new URLSearchParams(params).toString();
  const resp = await fetch(`${baseUrl}/CreditDetail/DoAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await resp.text();
  const result = Object.fromEntries(new URLSearchParams(text));

  if (result.RtnCode !== '1') {
    res.status(400).json({ error: `綠界退款失敗：${result.RtnMsg}` });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundNote: note || null,
      },
    });
    for (const item of order.items) {
      await tx.listing.update({ where: { id: item.listingId }, data: { status: 'active' } });
    }
  });

  res.json({ ok: true });
}
```

在 `backend/src/routes/admin.ts` 加入退款路由（找 `router.` 最後一行之前加）：
```typescript
import { refundOrder } from '../controllers/admin';
router.post('/orders/:id/refund', refundOrder);
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/auth.ts backend/src/controllers/orders.ts \
        backend/src/controllers/admin.ts backend/src/routes/orders.ts backend/src/routes/admin.ts
git commit -m "feat: remove wallet, add refund API"
```

---

## Task 8：後端路由註冊

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: 修改 `backend/src/app.ts`**

在現有 import 後面加：
```typescript
import cartRoutes from './routes/cart';
import checkoutRoutes from './routes/checkout';
import ecpayRoutes from './routes/ecpay';
```

在 `app.use('/api/orders', orderRoutes);` 後面加：
```typescript
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/ecpay', ecpayRoutes);
```

⚠️ ECPay callback body 是 `application/x-www-form-urlencoded`，需確認 `express.urlencoded` middleware 已存在。在 `app.use(express.json())` 後面加：
```typescript
app.use(express.urlencoded({ extended: false }));
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: register cart/checkout/ecpay routes"
```

---

## Task 9：前端型別 + API Clients

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/cart.ts`
- Create: `frontend/src/api/checkout.ts`

- [ ] **Step 1: 修改 `frontend/src/types/index.ts`**

```typescript
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  isAdmin?: boolean;
  lineBound?: boolean;
  // wallet 已移除
}

export interface CartItem {
  id: string;
  listingId: string;
  quantity: number;
  listing: {
    id: string;
    cardName: string;
    cardImage: string;
    price: number;
    quantity: number;
    status: string;
    condition: string;
    language: string;
    seller: { username: string };
  };
}

export interface OrderItem {
  id: string;
  listingId: string;
  quantity: number;
  price: number;
  listing: {
    cardName: string;
    cardImage: string;
    condition: string;
    language: string;
  };
}

export interface Order {
  id: string;
  merchantTradeNo: string;
  total: number;
  paymentMethod: 'credit' | 'cvs' | 'cvs_cod';
  paymentStatus: 'pending' | 'paid' | 'failed';
  status: 'pending_payment' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded';
  ecpayTradeNo?: string;
  cvsPaymentCode?: string;
  cvsExpireDate?: string;
  storeName?: string;
  receiverName?: string;
  refundedAt?: string;
  refundNote?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface Listing {
  id: string;
  cardId: string;
  cardName: string;
  cardGame: 'yugioh' | 'pokemon';
  cardImage: string;
  condition: string;
  price: number;
  quantity: number;
  description?: string;
  language?: string;
  status: string;
  createdAt: string;
  seller: { username: string; avatar?: string };
}

export type Game = 'yugioh' | 'pokemon' | 'all';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP';
```

- [ ] **Step 2: 建立 `frontend/src/api/cart.ts`**

```typescript
import { api } from './client';
import type { CartItem } from '../types';

export const cartApi = {
  get: async (): Promise<CartItem[]> => {
    const { data } = await api.get('/cart');
    return data;
  },
  add: async (listingId: string, quantity = 1): Promise<CartItem> => {
    const { data } = await api.post('/cart', { listingId, quantity });
    return data;
  },
  remove: async (listingId: string): Promise<void> => {
    await api.delete(`/cart/${listingId}`);
  },
  clear: async (): Promise<void> => {
    await api.delete('/cart');
  },
};
```

- [ ] **Step 3: 建立 `frontend/src/api/checkout.ts`**

```typescript
import { api } from './client';

export type PaymentMethod = 'credit' | 'cvs' | 'cvs_cod';
export type ShippingType = 'UNIMART' | 'FAMI' | 'HILIFE';

export interface CheckoutResponse {
  orderId: string;
  ecpayUrl: string;
  ecpayParams: Record<string, string>;
}

export interface SelectStoreResponse {
  pendingId: string;
  ecpayUrl: string;
  ecpayParams: Record<string, string>;
}

export const checkoutApi = {
  create: async (
    paymentMethod: 'credit' | 'cvs',
    receiverName: string,
    receiverPhone: string,
  ): Promise<CheckoutResponse> => {
    const { data } = await api.post('/checkout', { paymentMethod, receiverName, receiverPhone });
    return data;
  },
  selectStore: async (
    receiverName: string,
    receiverPhone: string,
    shippingType: ShippingType,
  ): Promise<SelectStoreResponse> => {
    const { data } = await api.post('/checkout/select-store', {
      receiverName, receiverPhone, shippingType,
    });
    return data;
  },
  confirmStore: async (pendingId: string): Promise<{ orderId: string }> => {
    const { data } = await api.post('/checkout/confirm-store', { pendingId });
    return data;
  },
};

// 動態建立 form 並提交到綠界
export function submitEcpayForm(ecpayUrl: string, ecpayParams: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = ecpayUrl;
  for (const [k, v] of Object.entries(ecpayParams)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/cart.ts frontend/src/api/checkout.ts
git commit -m "feat: frontend types and API clients for cart/checkout"
```

---

## Task 10：AppShell + ListingDetail + Profile（移除 wallet）

**Files:**
- Modify: `frontend/src/components/AppShell.tsx`
- Modify: `frontend/src/pages/ListingDetail.tsx`
- Modify: `frontend/src/pages/Profile.tsx`

- [ ] **Step 1: 修改 `AppShell.tsx`**

找到顯示 `NT${user.wallet.toLocaleString()}` 的那行（約 line 231）移除整個 wallet 顯示區塊。

在 AppShell 的 import 加入：
```typescript
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
```

在頂部 nav icon 區（找到現有 icon 列）加入購物車 icon：
```tsx
{user && (
  <button
    onClick={() => navigate('/cart')}
    style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
  >
    <ShoppingCart size={22} />
    {cartCount > 0 && (
      <span style={{
        position: 'absolute', top: -4, right: -6,
        background: '#8B5CF6', color: '#fff', borderRadius: '50%',
        width: 16, height: 16, fontSize: 10, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cartCount > 9 ? '9+' : cartCount}
      </span>
    )}
  </button>
)}
```

在元件頂部加：
```tsx
const cartCount = useCartStore(s => s.items.length);
```

- [ ] **Step 2: 建立 `frontend/src/stores/cartStore.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../types';
import { cartApi } from '../api/cart';

interface CartState {
  items: CartItem[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (listingId: string) => Promise<void>;
  remove: (listingId: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      fetch: async () => {
        set({ loading: true });
        try {
          const items = await cartApi.get();
          set({ items });
        } finally {
          set({ loading: false });
        }
      },
      add: async (listingId) => {
        await cartApi.add(listingId);
        await get().fetch();
      },
      remove: async (listingId) => {
        await cartApi.remove(listingId);
        set(s => ({ items: s.items.filter(i => i.listingId !== listingId) }));
      },
      clear: async () => {
        await cartApi.clear();
        set({ items: [] });
      },
    }),
    { name: 'pptcg-cart' },
  ),
);
```

- [ ] **Step 3: 修改 `ListingDetail.tsx`**

移除 `ordersApi` import 及 `handleBuy` 函式。

找到顯示餘額和「立即購買」按鈕的區塊，改為：
```tsx
import { useCartStore } from '../stores/cartStore';

// 在元件內加：
const { add: addToCart } = useCartStore();
const [addedToCart, setAddedToCart] = useState(false);

const handleAddToCart = async () => {
  if (!user) { navigate('/login'); return; }
  if (!listing) return;
  try {
    await addToCart(listing.id);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  } catch (err: any) {
    setError(err.response?.data?.error || '加入失敗');
  }
};
```

把「購買按鈕」區塊（含餘額顯示）替換為：
```tsx
{addedToCart ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34D399', fontWeight: 700 }}>
    <CheckCircle2 size={18} /> 已加入購物車
  </div>
) : (
  <button
    onClick={handleAddToCart}
    style={{
      width: '100%', padding: '14px', borderRadius: 16, textAlign: 'center',
      background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff',
      border: 'none', fontWeight: 800, fontSize: 16, cursor: 'pointer',
    }}
    disabled={listing.status !== 'active'}
  >
    {listing.status === 'active' ? '+ 加入購物車' : '已售出'}
  </button>
)}
```

- [ ] **Step 4: 修改 `Profile.tsx`**

搜尋 `帳戶餘額`、`wallet`，找到該區塊並整個移除（約 line 291-298）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AppShell.tsx frontend/src/stores/cartStore.ts \
        frontend/src/pages/ListingDetail.tsx frontend/src/pages/Profile.tsx
git commit -m "feat: remove wallet UI, add cart icon, add-to-cart button"
```

---

## Task 11：購物車頁面

**Files:**
- Create: `frontend/src/pages/Cart.tsx`

- [ ] **Step 1: 建立 `frontend/src/pages/Cart.tsx`**

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Cart() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, loading, fetch, remove } = useCartStore();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch();
  }, [user]);

  const total = items.reduce((sum, i) => sum + i.listing.price * i.quantity, 0);

  if (loading) return <div style={{ paddingTop: 80 }}><LoadingSpinner /></div>;

  return (
    <div style={{ paddingBottom: 128, paddingTop: 20 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <h2 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>
          購物車（{items.length} 件）
        </h2>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#64748B' }}>
            <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontWeight: 600 }}>購物車是空的</p>
            <button
              onClick={() => navigate('/')}
              style={{ marginTop: 16, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              去逛逛 →
            </button>
          </div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                background: 'rgba(255,255,255,0.04)', borderRadius: 14,
                padding: '12px 14px', marginBottom: 10,
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <img
                  src={item.listing.cardImage || '/placeholder.png'}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                  alt={item.listing.cardName}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.listing.cardName}
                  </p>
                  <p style={{ color: '#64748B', fontSize: 12 }}>
                    × {item.quantity}　NT${(item.listing.price * item.quantity).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => remove(item.listingId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <div style={{
              background: 'rgba(139,92,246,0.08)', borderRadius: 14,
              padding: '16px', marginTop: 16, border: '1px solid rgba(139,92,246,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>合計</span>
                <span style={{ color: '#A78BFA', fontWeight: 900, fontSize: 20 }}>
                  NT${total.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                  color: '#fff', fontWeight: 800, fontSize: 16,
                  border: 'none', cursor: 'pointer',
                }}
              >
                前往結帳
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Cart.tsx
git commit -m "feat: cart page"
```

---

## Task 12：結帳頁面

**Files:**
- Create: `frontend/src/pages/Checkout.tsx`

- [ ] **Step 1: 建立 `frontend/src/pages/Checkout.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { checkoutApi, submitEcpayForm, type ShippingType } from '../api/checkout';
import { LoadingSpinner } from '../components/LoadingSpinner';

type PaymentMethod = 'credit' | 'cvs' | 'cvs_cod';

const SHIPPING_LABELS: Record<ShippingType, string> = {
  UNIMART: '7-ELEVEN',
  FAMI: '全家',
  HILIFE: '萊爾富',
};

export function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, fetch } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [shippingType, setShippingType] = useState<ShippingType>('UNIMART');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch();
  }, [user]);

  const total = items.reduce((sum, i) => sum + i.listing.price * i.quantity, 0);

  const handleSubmit = async () => {
    if (!receiverName || !receiverPhone) {
      setError('請填寫收件人姓名和電話');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (paymentMethod === 'cvs_cod') {
        const res = await checkoutApi.selectStore(receiverName, receiverPhone, shippingType);
        // 提交 form 跳到綠界選門市
        submitEcpayForm(res.ecpayUrl, res.ecpayParams);
      } else {
        const res = await checkoutApi.create(paymentMethod, receiverName, receiverPhone);
        // 提交 form 跳到綠界付款頁
        submitEcpayForm(res.ecpayUrl, res.ecpayParams);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '結帳失敗，請稍後再試');
      setLoading(false);
    }
  };

  if (items.length === 0 && !loading) {
    navigate('/cart');
    return null;
  }

  return (
    <div style={{ paddingBottom: 128, paddingTop: 20 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <button onClick={() => navigate('/cart')} style={{ color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: 20 }}>
          ← 返回購物車
        </button>

        <h2 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>結帳</h2>

        {/* 訂單摘要 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ color: '#64748B', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>訂單摘要</p>
          {items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>{i.listing.cardName} ×{i.quantity}</span>
              <span style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 700 }}>NT${(i.listing.price * i.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8', fontWeight: 700 }}>合計</span>
            <span style={{ color: '#A78BFA', fontWeight: 900 }}>NT${total.toLocaleString()}</span>
          </div>
        </div>

        {/* 收件人 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>收件人資訊</p>
          <input
            value={receiverName}
            onChange={e => setReceiverName(e.target.value)}
            placeholder="姓名"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#F1F5F9', marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            value={receiverPhone}
            onChange={e => setReceiverPhone(e.target.value)}
            placeholder="手機號碼（09xx-xxx-xxx）"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#F1F5F9', boxSizing: 'border-box' }}
          />
        </div>

        {/* 付款方式 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>付款方式</p>
          {(['credit', 'cvs', 'cvs_cod'] as PaymentMethod[]).map(m => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input type="radio" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} />
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                {m === 'credit' && '💳 信用卡（一次付清）'}
                {m === 'cvs' && '🏪 超商代碼（3 天內付款）'}
                {m === 'cvs_cod' && '📦 超商取貨付款（到店取貨時付現）'}
              </span>
            </label>
          ))}
        </div>

        {/* 超商取貨：選擇超商品牌 */}
        {paymentMethod === 'cvs_cod' && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>選擇超商</p>
            {(['UNIMART', 'FAMI', 'HILIFE'] as ShippingType[]).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                <input type="radio" value={s} checked={shippingType === s} onChange={() => setShippingType(s)} />
                <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{SHIPPING_LABELS[s]}</span>
              </label>
            ))}
            <p style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
              ✓ 點「前往結帳」後，將進入綠界門市地圖選擇取貨門市
            </p>
          </div>
        )}

        {error && <p style={{ color: '#EF4444', fontWeight: 600, marginBottom: 12 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: loading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
            color: '#fff', fontWeight: 800, fontSize: 16, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '處理中…' : paymentMethod === 'cvs_cod' ? '選擇取貨門市 →' : '前往付款 →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Checkout.tsx
git commit -m "feat: checkout page (credit / CVS / CVS COD)"
```

---

## Task 13：付款結果頁 + 門市確認頁

**Files:**
- Create: `frontend/src/pages/OrderResult.tsx`
- Create: `frontend/src/pages/CheckoutStoreConfirm.tsx`

- [ ] **Step 1: 建立 `frontend/src/pages/OrderResult.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client';
import type { Order } from '../types';

export function OrderResult() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tradeNo = params.get('tradeNo') ?? '';
  const status = params.get('status');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!tradeNo) return;
    // 輪詢訂單狀態（最多 10 秒）
    let tries = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/orders/by-trade-no/${tradeNo}`);
        setOrder(data);
      } catch {
        if (tries++ < 5) setTimeout(poll, 2000);
      }
    };
    poll();
  }, [tradeNo]);

  const isSuccess = status === 'success';

  return (
    <div style={{ paddingBottom: 128, paddingTop: 40 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
        {isSuccess ? (
          <>
            <CheckCircle2 size={56} color="#34D399" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#34D399', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>付款成功！</h2>

            {/* 超商代碼 */}
            {order?.cvsPaymentCode && (
              <div style={{
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 14, padding: '20px', marginBottom: 20, marginTop: 20,
              }}>
                <p style={{ color: '#64748B', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>超商付款代碼</p>
                <p style={{ color: '#34D399', fontWeight: 900, fontSize: 28, letterSpacing: 4 }}>
                  {order.cvsPaymentCode}
                </p>
                {order.cvsExpireDate && (
                  <p style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
                    請於 {order.cvsExpireDate} 前至超商繳款
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <XCircle size={56} color="#EF4444" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#EF4444', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>付款失敗</h2>
            <p style={{ color: '#64748B', marginBottom: 20 }}>請返回購物車重試</p>
          </>
        )}

        {order && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '16px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'left' }}>
            <p style={{ color: '#64748B', fontSize: 12, marginBottom: 10 }}>訂單編號：{order.merchantTradeNo}</p>
            {order.items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#94A3B8', fontSize: 13 }}>{i.listing.cardName} ×{i.quantity}</span>
                <span style={{ color: '#F1F5F9', fontSize: 13 }}>NT${(i.price * i.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/orders/mine')}
          style={{ color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
        >
          查看我的訂單 →
        </button>
      </div>
    </div>
  );
}
```

⚠️ 需在後端 orders routes 加入 `GET /api/orders/by-trade-no/:tradeNo`：

在 `backend/src/controllers/orders.ts` 加入：
```typescript
export async function getOrderByTradeNo(req: AuthRequest, res: Response) {
  const { tradeNo } = req.params;
  const order = await prisma.order.findFirst({
    where: { merchantTradeNo: tradeNo, buyerId: req.userId },
    include: { items: { include: { listing: { select: { cardName: true, cardImage: true, condition: true, language: true } } } } },
  });
  if (!order) { res.status(404).json({ error: '找不到訂單' }); return; }
  res.json(order);
}
```

在 `backend/src/routes/orders.ts` 加入：
```typescript
import { getMyOrders, getOrder, getOrderByTradeNo } from '../controllers/orders';
router.get('/by-trade-no/:tradeNo', getOrderByTradeNo);
```

- [ ] **Step 2: 建立 `frontend/src/pages/CheckoutStoreConfirm.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { checkoutApi } from '../api/checkout';
import { api } from '../api/client';

export function CheckoutStoreConfirm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pendingId = params.get('id') ?? '';
  const [storeInfo, setStoreInfo] = useState<{ storeName: string; storeAddress: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingId) return;
    api.get(`/checkout/pending/${pendingId}`).then(({ data }) => {
      if (data.storeId) {
        setStoreInfo({ storeName: data.storeName, storeAddress: data.storeAddress });
      }
    }).catch(() => setError('找不到選取記錄，請重試'));
  }, [pendingId]);

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const { orderId } = await checkoutApi.confirmStore(pendingId);
      navigate(`/order-result?tradeNo=${orderId}&status=success`);
    } catch (err: any) {
      setError(err.response?.data?.error || '建立訂單失敗');
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 128, paddingTop: 40 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <h2 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>確認取貨門市</h2>

        {storeInfo ? (
          <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 14, padding: '20px', marginBottom: 24, border: '1px solid rgba(139,92,246,0.2)' }}>
            <Store size={24} color="#8B5CF6" style={{ marginBottom: 12 }} />
            <p style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{storeInfo.storeName}</p>
            <p style={{ color: '#64748B', fontSize: 13 }}>{storeInfo.storeAddress}</p>
          </div>
        ) : (
          <p style={{ color: '#64748B' }}>載入門市資訊中…</p>
        )}

        {error && <p style={{ color: '#EF4444', marginBottom: 16 }}>{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={loading || !storeInfo}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: loading || !storeInfo ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
            color: '#fff', fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer',
          }}
        >
          {loading ? '建立訂單中…' : '確認，建立訂單'}
        </button>

        <button onClick={() => navigate('/checkout')} style={{ display: 'block', marginTop: 16, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          ← 重新選擇門市
        </button>
      </div>
    </div>
  );
}
```

需在後端加 `GET /api/checkout/pending/:id`，在 `checkout.ts` 加：
```typescript
export async function getPending(req: AuthRequest, res: Response) {
  const p = await prisma.pendingCheckout.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!p) { res.status(404).json({ error: '找不到' }); return; }
  res.json(p);
}
```
並在 `routes/checkout.ts` 加 `router.get('/pending/:id', getPending);`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/OrderResult.tsx frontend/src/pages/CheckoutStoreConfirm.tsx \
        backend/src/controllers/orders.ts backend/src/controllers/checkout.ts \
        backend/src/routes/orders.ts backend/src/routes/checkout.ts
git commit -m "feat: order result page, store confirm page"
```

---

## Task 14：後台退款 UI

**Files:**
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`

- [ ] **Step 1: 在後台訂單列表加退款按鈕**

在 `AdminDashboard.tsx` 找到訂單相關區塊，加入 refund 函式和按鈕：

```tsx
const handleRefund = async (orderId: string) => {
  if (!confirm('確認退款此訂單？退款後無法復原。')) return;
  try {
    await api.post(`/admin/orders/${orderId}/refund`);
    alert('退款成功');
    // 重新 fetch 訂單列表
  } catch (err: any) {
    alert(err.response?.data?.error || '退款失敗');
  }
};
```

在每筆訂單 row 加入按鈕（當 `status === 'paid' || status === 'completed'`）：
```tsx
{['paid', 'completed'].includes(order.status) && (
  <button
    onClick={() => handleRefund(order.id)}
    style={{
      padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
      background: 'rgba(239,68,68,0.12)', color: '#EF4444',
      border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
    }}
  >
    退款
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/AdminDashboard.tsx
git commit -m "feat: admin refund button"
```

---

## Task 15：App.tsx 路由 + E2E 測試

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 修改 `frontend/src/App.tsx`**

加入新路由（找到現有 Routes）：
```tsx
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { CheckoutStoreConfirm } from './pages/CheckoutStoreConfirm';
import { OrderResult } from './pages/OrderResult';
```

```tsx
<Route path="/cart" element={<Cart />} />
<Route path="/checkout" element={<Checkout />} />
<Route path="/checkout/store-confirm" element={<CheckoutStoreConfirm />} />
<Route path="/order-result" element={<OrderResult />} />
```

- [ ] **Step 2: 設定測試環境變數**

Railway staging 服務加入環境變數（用 CLI）：

```bash
railway variables --set "ECPAY_MERCHANT_ID=3002607" -s pptcg-backend-staging
railway variables --set "ECPAY_HASH_KEY=pwFHCqoQZGmho4w6" -s pptcg-backend-staging
railway variables --set "ECPAY_HASH_IV=EkRm7iFT261dpevs" -s pptcg-backend-staging
railway variables --set "ECPAY_LOGISTICS_MERCHANT_ID=2000132" -s pptcg-backend-staging
railway variables --set "ECPAY_LOGISTICS_HASH_KEY=5294y06JbISpM5x9" -s pptcg-backend-staging
railway variables --set "ECPAY_LOGISTICS_HASH_IV=v77hoKGq4kWxNNIS" -s pptcg-backend-staging
railway variables --set "ECPAY_IS_STAGING=true" -s pptcg-backend-staging
railway variables --set "BACKEND_URL=https://pptcg-backend-staging-production.up.railway.app" -s pptcg-backend-staging
railway variables --set "FRONTEND_URL=https://pptcg-dev.vercel.app" -s pptcg-backend-staging
railway variables --set "SENDER_PHONE=0912345678" -s pptcg-backend-staging
```

- [ ] **Step 3: E2E 測試（信用卡 SimulatePaid）**

1. 登入 `https://pptcg-dev.vercel.app`
2. 找一個 active 商品 → 點「加入購物車」
3. 導航到 `/cart` → 確認商品出現
4. 點「前往結帳」
5. 填收件人資訊，選「信用卡」
6. 點「前往付款」→ 應跳轉到 `payment-stage.ecpay.com.tw`
7. 在綠界測試頁輸入測試信用卡：`4311-9522-2222-2222`，CVV 任意 3 位，有效期任意未來日期，3DS: `1234`
8. 付款成功 → 應跳回 `/order-result?...&status=success`
9. 確認商品 status 變 `sold`

- [ ] **Step 4: E2E 測試（超商代碼 SimulatePaid）**

1. 重複步驟 1-5，選「超商代碼」
2. 跳轉到綠界頁面 → 看到取號代碼
3. 回到 `/order-result` 頁，確認代碼顯示

- [ ] **Step 5: Final commit & push to dev**

```bash
git add frontend/src/App.tsx
git commit -m "feat: register cart/checkout/order-result routes"
git push origin dev
```

等 CI 部署後，觀察 Railway logs 確認 callback 收到 `1|OK`。

---

## 注意事項

- **ECPay callback 必須是 HTTPS 公開 URL**：Railway staging URL 已是 HTTPS，開發環境需用 ngrok
- **MerchantTradeNo 不可重用**：每次結帳都 `generateMerchantTradeNo()` 產生新的
- **callback RtnCode 是字串**：比較時用 `=== '1'`，不是 `=== 1`
- **退款只支援信用卡 DoAction**：CVS COD 是現金，需手動退款
- **正式機切換**：把所有 `ECPAY_*` 環境變數換成正式金鑰，`ECPAY_IS_STAGING=false`
