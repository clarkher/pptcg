import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  getPaymentConfig, getAioBaseUrl,
  buildAioParams, generateMerchantTradeNo,
} from '../lib/ecpay';
import {
  getLogisticsConfig, buildStoreMapParams,
  createLogisticsOrder, type ShippingType,
} from '../lib/ecpay-logistics';
import {
  reserveStock, releaseStock, releaseExpiredReservations, ReservationError,
} from '../lib/reservation';

const BACKEND_URL = () => process.env.BACKEND_URL!;
const FRONTEND_URL = () => process.env.FRONTEND_URL!;

const RESERVE_HOLD_MS = 30 * 60 * 1000; // 信用卡/取號前的初始預留窗口

// ─── POST /api/checkout ──────────────────────────────────────
// body: { paymentMethod: 'credit' | 'cvs', receiverName, receiverPhone }
export async function createCheckout(req: AuthRequest, res: Response) {
  const { paymentMethod, receiverName, receiverPhone } = req.body;
  if (!['credit', 'cvs'].includes(paymentMethod)) {
    res.status(400).json({ error: '不支援的付款方式' });
    return;
  }

  // 先回收逾時預留（防呆，setInterval 之外多一道）
  await releaseExpiredReservations().catch(() => {});

  const merchantTradeNo = generateMerchantTradeNo();

  let order;
  let cardNames: string[];
  try {
    // 單一 transaction：讀車 → 條件式扣量預留 → 建單 → 清車（避免重複預留 / 孤兒單）
    const result = await prisma.$transaction(async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: { userId: req.userId! },
        include: { listing: true },
      });
      if (cartItems.length === 0) {
        throw new ReservationError([]); // 以空陣列代表空購物車
      }

      await reserveStock(tx, cartItems.map(ci => ({ listingId: ci.listingId, quantity: ci.quantity })));

      const total = cartItems.reduce((sum, ci) => sum + ci.listing.price * ci.quantity, 0);
      const created = await tx.order.create({
        data: {
          merchantTradeNo,
          buyerId: req.userId!,
          total,
          paymentMethod,
          reservationExpiresAt: new Date(Date.now() + RESERVE_HOLD_MS),
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

      await tx.cartItem.deleteMany({ where: { userId: req.userId! } });
      return { created, cardNames: cartItems.map(ci => ci.listing.cardName) };
    });
    order = result.created;
    cardNames = result.cardNames;
  } catch (err) {
    if (err instanceof ReservationError) {
      res.status(400).json({
        error: err.items.length === 0
          ? '購物車是空的'
          : `以下商品庫存不足或已售出：${err.items.join('、')}`,
      });
      return;
    }
    throw err;
  }

  const total = order.total;
  const config = getPaymentConfig();
  const itemName = cardNames.join('#').slice(0, 400);
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
// body: { receiverName, receiverPhone, shippingType }
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

// ─── GET /api/checkout/pending/:id ───────────────────────────
export async function getPending(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  const p = await prisma.pendingCheckout.findFirst({
    where: { id, userId: req.userId },
  });
  if (!p) { res.status(404).json({ error: '找不到' }); return; }
  res.json(p);
}

// ─── POST /api/checkout/confirm-store ────────────────────────
// body: { pendingId }
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

  // 1) transaction：對「目前」庫存條件式扣量預留 → 建單 → 清車（pending 留到物流成功才刪）
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      await reserveStock(tx, snapshot.map((ci: any) => ({ listingId: ci.listingId, quantity: ci.quantity })));
      const created = await tx.order.create({
        data: {
          merchantTradeNo,
          buyerId: req.userId!,
          total,
          paymentMethod: 'cvs_cod',
          // 物流建單前的 crash safety net；建單成功會轉成 'paid'（不再被 sweep）
          reservationExpiresAt: new Date(Date.now() + RESERVE_HOLD_MS),
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
      await tx.cartItem.deleteMany({ where: { userId: req.userId! } });
      return created;
    });
  } catch (err) {
    if (err instanceof ReservationError) {
      res.status(400).json({ error: `以下商品庫存不足或已售出：${err.items.join('、')}` });
      return;
    }
    throw err;
  }

  // 2) 外部物流建單（不在 DB transaction 內）
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

    // 條件式 finalize：只有訂單仍是 pending_payment（沒被 sweep 釋放）才轉 paid
    const upd = await prisma.order.updateMany({
      where: { id: order.id, status: 'pending_payment' },
      data: {
        logisticsId: logResult.allPayLogisticsId,
        bookingNote: logResult.bookingNote,
        status: 'paid',            // COD 視為「待出貨」
        paymentStatus: 'pending',  // 實際付款在取貨時
        reservationExpiresAt: null,
      },
    });
    if (upd.count === 0) {
      res.status(409).json({ error: '訂單已逾時釋放，請重新結帳' });
      return;
    }
    await prisma.pendingCheckout.delete({ where: { id: pendingId } }).catch(() => {});
    res.json({ orderId: order.id, merchantTradeNo });
  } catch (err: any) {
    console.error('Logistics order creation failed:', err.message);
    // 回滾：釋放庫存、訂單作廢、刪除 pending
    await prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id: order!.id }, include: { items: true } });
      const flipped = await tx.order.updateMany({
        where: { id: order!.id, status: 'pending_payment' },
        data: { status: 'cancelled', paymentStatus: 'failed', refundNote: '物流建單失敗', reservationExpiresAt: null },
      });
      if (flipped.count > 0 && o) await releaseStock(tx, o.items);
    });
    await prisma.pendingCheckout.delete({ where: { id: pendingId } }).catch(() => {});
    res.status(502).json({ error: '物流建單失敗，庫存已釋放，請稍後再試' });
  }
}
