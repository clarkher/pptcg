import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export interface StockItem {
  listingId: string;
  quantity: number;
}

/** 庫存不足時拋出，帶上對不到貨的商品名給前端顯示。 */
export class ReservationError extends Error {
  constructor(public items: string[]) {
    super(`庫存不足或已售出：${items.join('、')}`);
    this.name = 'ReservationError';
  }
}

type Tx = Prisma.TransactionClient;

/**
 * 在 transaction 內條件式扣量（預留）。任一筆庫存不足即拋 ReservationError，
 * 交由呼叫端的 interactive transaction 整筆回滾。扣到 0 的列標記為 sold。
 * 條件式 updateMany（WHERE quantity>=需求）取得列鎖 → 並發結帳不會超賣。
 */
export async function reserveStock(tx: Tx, items: StockItem[]): Promise<void> {
  const failed: string[] = [];
  for (const it of items) {
    if (it.quantity <= 0) continue;
    const r = await tx.listing.updateMany({
      where: { id: it.listingId, status: 'active', quantity: { gte: it.quantity } },
      data: { quantity: { decrement: it.quantity } },
    });
    if (r.count === 0) {
      const l = await tx.listing.findUnique({
        where: { id: it.listingId },
        select: { cardName: true },
      });
      failed.push(l?.cardName ?? '商品');
    }
  }
  if (failed.length) throw new ReservationError(failed);
  await tx.listing.updateMany({
    where: { id: { in: items.map((i) => i.listingId) }, quantity: { lte: 0 } },
    data: { status: 'sold' },
  });
}

/** 在 transaction 內回補庫存（釋放/退款）。回補後 quantity>0 → status active。 */
export async function releaseStock(tx: Tx, items: StockItem[]): Promise<void> {
  for (const it of items) {
    if (it.quantity <= 0) continue;
    await tx.listing.updateMany({
      where: { id: it.listingId },
      data: { quantity: { increment: it.quantity }, status: 'active' },
    });
  }
}

/**
 * 釋放單筆訂單的預留：只有仍 pending_payment 且未付款者才回補。
 * 用條件式 updateMany 把 order 翻成 cancelled（取得列鎖），count>0 才回補 →
 * 逾時 sweep 與付款失敗回呼並發時不會重複回補。
 * @returns 是否實際釋放
 */
export async function releaseOrderReservation(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return false;

    const flipped = await tx.order.updateMany({
      where: { id: orderId, status: 'pending_payment', paymentStatus: { not: 'paid' } },
      data: { status: 'cancelled', paymentStatus: 'failed' },
    });
    if (flipped.count === 0) return false; // 已被其他流程處理

    await releaseStock(tx, order.items);
    return true;
  });
}

/**
 * 釋放所有逾時的預留訂單，並清掉過期的 PendingCheckout（COD 選門市快照，未預留庫存）。
 * 由 index.ts 的 setInterval 與結帳進入點呼叫。
 * @returns 釋放的訂單數
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: 'pending_payment',
      paymentStatus: { not: 'paid' },
      reservationExpiresAt: { lt: now },
    },
    select: { id: true },
  });

  let released = 0;
  for (const o of expired) {
    if (await releaseOrderReservation(o.id)) released++;
  }

  await prisma.pendingCheckout.deleteMany({ where: { expiresAt: { lt: now } } });
  return released;
}

/**
 * 解析綠界 CVS 取號回呼的 ExpireDate（"yyyy/MM/dd HH:mm:ss"）。
 * 解析失敗則 fallback 為 now + 3 天。
 */
export function parseEcpayExpireDate(raw: string | null | undefined, now: Date = new Date()): Date {
  const fallback = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (!raw) return fallback;
  const d = new Date(raw.replace(/-/g, '/'));
  if (isNaN(d.getTime())) return fallback;
  return d;
}
