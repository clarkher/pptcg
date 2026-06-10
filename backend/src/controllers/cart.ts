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

  const qty = Math.max(1, Math.min(Number(quantity) || 1, listing.quantity));
  const item = await prisma.cartItem.upsert({
    where: { userId_listingId: { userId: req.userId!, listingId } },
    update: { quantity: qty },
    create: { userId: req.userId!, listingId, quantity: qty },
    include: { listing: { select: { cardName: true, price: true } } },
  });

  res.status(201).json(item);
}

// DELETE /api/cart/:listingId
export async function removeFromCart(req: AuthRequest, res: Response) {
  const { listingId } = req.params as { listingId: string };
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
