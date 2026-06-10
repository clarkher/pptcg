import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { clampCartSet } from '../lib/inventory';

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
  if (listing.quantity <= 0) {
    res.status(400).json({ error: '商品已售完' });
    return;
  }
  if (listing.sellerId === req.userId) {
    res.status(400).json({ error: '無法加入自己的商品' });
    return;
  }

  // 原子累加（再次加入不再覆寫成 1）；用 DB increment 避免快速連點的 lost update，
  // 之後再夾到庫存上限。
  const addQty = Math.max(1, Math.floor(Number(quantity)) || 1);
  const key = { userId_listingId: { userId: req.userId!, listingId } };

  let item = await prisma.cartItem.upsert({
    where: key,
    update: { quantity: { increment: addQty } },
    create: { userId: req.userId!, listingId, quantity: clampCartSet(addQty, listing.quantity) },
    include: { listing: { select: { cardName: true, price: true } } },
  });
  if (item.quantity > listing.quantity) {
    item = await prisma.cartItem.update({
      where: key,
      data: { quantity: listing.quantity },
      include: { listing: { select: { cardName: true, price: true } } },
    });
  }

  res.status(201).json(item);
}

// PATCH /api/cart/:listingId  body: { quantity }  設定絕對數量（購物車步進器）
export async function setCartQuantity(req: AuthRequest, res: Response) {
  const { listingId } = req.params as { listingId: string };
  const { quantity } = req.body;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'active') {
    res.status(400).json({ error: '商品不存在或已售出' });
    return;
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_listingId: { userId: req.userId!, listingId } },
  });
  if (!existing) {
    res.status(404).json({ error: '購物車沒有此商品' });
    return;
  }

  const qty = clampCartSet(Number(quantity), listing.quantity);
  const item = await prisma.cartItem.update({
    where: { userId_listingId: { userId: req.userId!, listingId } },
    data: { quantity: qty },
    include: { listing: { select: { cardName: true, price: true } } },
  });

  res.json(item);
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
