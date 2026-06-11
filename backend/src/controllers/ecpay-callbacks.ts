import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyCheckMacValue, getPaymentConfig } from '../lib/ecpay';
import { releaseOrderReservation, parseEcpayExpireDate } from '../lib/reservation';

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

  // 3. 冪等：已付款直接回 OK
  if (order.paymentStatus === 'paid') {
    res.status(200).type('text/plain').send('1|OK');
    return;
  }

  if (params.RtnCode === '1') {
    // 付款成功 → 只 finalize（庫存已於結帳時預留，購物車已於結帳時清空）。
    // 預留窗口 = 綠界付款期限，故不會在釋放後才收到成功，無需重新扣量。
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'paid',
        status: 'paid',
        ecpayTradeNo: params.TradeNo ?? null,
        reservationExpiresAt: null,
      },
    });
  } else if (['10100073', '10200047', '10200049', '2'].includes(params.RtnCode)) {
    // 超商代碼：取號成功（尚未付款）→ 記代碼，並把預留延長為綠界實際 ExpireDate。
    // 庫存已於結帳時預留，不再重複扣量、不清車。
    await prisma.order.update({
      where: { id: order.id },
      data: {
        cvsPaymentCode: params.PaymentNo ?? params.CodeNo ?? params.TradeNo ?? null,
        cvsExpireDate: params.ExpireDate ?? null,
        status: 'pending_payment',
        ecpayTradeNo: params.TradeNo ?? null,
        reservationExpiresAt: parseEcpayExpireDate(params.ExpireDate),
      },
    });
  } else {
    // 付款失敗 → 釋放預留庫存（競態安全，只釋放一次）
    await releaseOrderReservation(order.id);
  }

  res.status(200).type('text/plain').send('1|OK');
}

// ─── GET+POST /api/ecpay/order-result（瀏覽器跳回，轉址到前端）
export async function orderResult(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, string>;
  const query = (req.query ?? {}) as Record<string, string>;
  const tradeNo = body.MerchantTradeNo ?? query.MerchantTradeNo ?? '';
  const rtnCode = body.RtnCode ?? query.RtnCode ?? '0';
  const status = rtnCode === '1' ? 'success' : 'fail';
  res.redirect(`${FRONTEND_URL()}/order-result?tradeNo=${encodeURIComponent(tradeNo)}&status=${status}`);
}

// ─── POST /api/ecpay/store-callback（選門市後，綠界表單 POST 跳回）
export async function storeCallback(req: Request, res: Response) {
  const { CVSStoreID, CVSStoreName, CVSAddress, ExtraData } = req.body as Record<string, string>;

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

  res.redirect(`${FRONTEND_URL()}/checkout/store-confirm?id=${encodeURIComponent(ExtraData)}`);
}

// ─── POST /api/ecpay/logistics-callback（物流狀態通知）
export async function logisticsCallback(req: Request, res: Response) {
  const { AllPayLogisticsID, RtnCode, RtnMsg } = req.body as Record<string, string>;
  console.log(`Logistics callback: ${AllPayLogisticsID} RtnCode=${RtnCode} ${RtnMsg ?? ''}`);

  // 取貨成功（RtnCode 300 = 已取貨）→ COD 視為完成
  if (RtnCode === '300' && AllPayLogisticsID) {
    await prisma.order.updateMany({
      where: { logisticsId: AllPayLogisticsID },
      data: { paymentStatus: 'paid', status: 'completed' },
    });
  }

  res.status(200).type('text/plain').send('1|OK');
}
