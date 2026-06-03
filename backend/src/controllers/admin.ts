import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// ── Listings ──────────────────────────────────────────────

export async function adminGetListings(_req: AuthRequest, res: Response) {
  const listings = await prisma.listing.findMany({
    include: { seller: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(listings);
}

export async function adminCreateListing(req: AuthRequest, res: Response) {
  const { cardId, cardName, cardGame, cardImage, language, condition, price, quantity, description } = req.body;
  if (!cardId || !cardName || !cardGame || price === undefined) {
    res.status(400).json({ error: '缺少必要資料' });
    return;
  }
  const listing = await prisma.listing.create({
    data: {
      cardId,
      cardName,
      cardGame,
      cardImage: cardImage || '',
      language: language || 'en',
      condition: condition || 'NM',
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      description: description || '',
      sellerId: req.userId!,
      status: 'active',
    },
    include: { seller: { select: { username: true } } },
  });
  res.status(201).json(listing);
}

export async function adminUpdateListing(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  const { cardName, cardGame, cardImage, condition, price, quantity, description, status } = req.body;
  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...(cardName !== undefined && { cardName }),
      ...(cardGame !== undefined && { cardGame }),
      ...(cardImage !== undefined && { cardImage }),
      ...(condition !== undefined && { condition }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
    },
    include: { seller: { select: { username: true } } },
  });
  res.json(listing);
}

export async function adminDeleteListing(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  await prisma.listing.delete({ where: { id } });
  res.json({ ok: true });
}

// ── Orders ────────────────────────────────────────────────

export async function adminGetOrders(_req: AuthRequest, res: Response) {
  const orders = await prisma.order.findMany({
    include: {
      listing: true,
      buyer: { select: { username: true, email: true } },
      seller: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}

export async function adminUpdateOrder(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  const { status } = req.body;
  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      listing: true,
      buyer: { select: { username: true, email: true } },
    },
  });
  res.json(order);
}

// ── Stats ─────────────────────────────────────────────────

export async function adminGetStats(_req: AuthRequest, res: Response) {
  const [totalListings, activeListings, totalOrders, pendingOrders, totalUsers] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'active' } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.user.count(),
  ]);
  const revenue = await prisma.order.aggregate({
    where: { status: { in: ['completed', 'shipped'] } },
    _sum: { total: true },
  });
  res.json({
    totalListings, activeListings, totalOrders, pendingOrders,
    totalUsers, revenue: revenue._sum.total ?? 0,
  });
}
