import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function buyListing(req: AuthRequest, res: Response) {
  const { listingId, quantity } = req.body;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'active') {
    res.status(400).json({ error: '商品不存在或已售出' });
    return;
  }
  if (listing.sellerId === req.userId) {
    res.status(400).json({ error: '無法購買自己的商品' });
    return;
  }
  const qty = parseInt(quantity) || 1;
  const total = listing.price * qty;
  const buyer = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!buyer || buyer.wallet < total) {
    res.status(400).json({ error: `餘額不足，需要 NT$${total}，目前 NT$${buyer?.wallet ?? 0}` });
    return;
  }
  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        listingId,
        buyerId: req.userId!,
        sellerId: listing.sellerId,
        quantity: qty,
        total,
      },
    }),
    prisma.listing.update({ where: { id: listingId }, data: { status: 'sold' } }),
    prisma.user.update({ where: { id: req.userId }, data: { wallet: { decrement: total } } }),
    prisma.user.update({ where: { id: listing.sellerId }, data: { wallet: { increment: total } } }),
  ]);
  res.status(201).json(order);
}

export async function getMyOrders(req: AuthRequest, res: Response) {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.userId },
    include: {
      listing: true,
      seller: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}
