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

const BACKEND_URL = () => process.env.BACKEND_URL!;
const FRONTEND_URL = () => process.env.FRONTEND_URL!;

// ─── POST /api/checkout ──────────────────────────────────────
// body: { paymentMethod: 'credit' | 'cvs', receiverName, receiverPhone }
export async function createCheckout(req: AuthRequest, res: Response) {
  const { paymentMethod, receiverName, receiverPhone } = req.body;
  if (!['credit', 'cvs'].includes(paymentMethod)) {
    res.status(400).json({ error: '不支援的付款方式' });
    return;
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.userId! },
    include: { listing: true },
  });
  if (cartItems.length === 0) {
    res.status(400).json({ error: '購物車是空的' });
    return;
  }

  const inactive = cartItems.filter(ci => ci.listing.status !== 'active');
  if (inactive.length > 0) {
    res.status(400).json({
      error: `部分商品已售出：${inactive.map(ci => ci.listing.cardName).join('、')}`,
    });
    return;
  }

  const total = cartItems.reduce((sum, ci) => sum + ci.listing.price * ci.quantity, 0);
  const merchantTradeNo = generateMerchantTradeNo();

  const order = await prisma.order.create({
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

  const config = getPaymentConfig();
  const itemName = cartItems.map(ci => ci.listing.cardName).join('#').slice(0, 400);
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
    console.error('Logistics order creation failed:', err.message);
  }

  await prisma.cartItem.deleteMany({ where: { userId: req.userId! } });
  for (const ci of snapshot) {
    await prisma.listing.update({ where: { id: ci.listingId }, data: { status: 'sold' } });
  }
  await prisma.pendingCheckout.delete({ where: { id: pendingId } });

  res.json({ orderId: order.id, merchantTradeNo });
}
