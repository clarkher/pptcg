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
  const { id } = req.params as { id: string };
  const order = await prisma.order.findFirst({
    where: { id, buyerId: req.userId },
    include: { items: { include: { listing: true } } },
  });
  if (!order) {
    res.status(404).json({ error: '訂單不存在' });
    return;
  }
  res.json(order);
}

export async function getOrderByTradeNo(req: AuthRequest, res: Response) {
  const { tradeNo } = req.params as { tradeNo: string };
  const order = await prisma.order.findFirst({
    where: { merchantTradeNo: tradeNo, buyerId: req.userId },
    include: {
      items: {
        include: {
          listing: { select: { cardName: true, cardImage: true, condition: true, language: true } },
        },
      },
    },
  });
  if (!order) { res.status(404).json({ error: '找不到訂單' }); return; }
  res.json(order);
}
