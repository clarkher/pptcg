import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function getListings(req: Request, res: Response) {
  const { game, q } = req.query;
  const where: any = { status: 'active' };
  if (game) where.cardGame = game;
  if (q) where.cardName = { contains: q as string, mode: 'insensitive' };
  const listings = await prisma.listing.findMany({
    where,
    include: { seller: { select: { username: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(listings);
}

export async function createListing(req: AuthRequest, res: Response) {
  const { cardId, cardName, cardGame, cardImage, condition, price, quantity, description } = req.body;
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
      condition: condition || 'NM',
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      description,
      sellerId: req.userId!,
    },
    include: { seller: { select: { username: true } } },
  });
  res.status(201).json(listing);
}

export async function getMyListings(req: AuthRequest, res: Response) {
  const listings = await prisma.listing.findMany({
    where: { sellerId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(listings);
}

export async function deleteListing(req: AuthRequest, res: Response) {
  const id = req.params['id'] as string;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    res.status(404).json({ error: '找不到商品' });
    return;
  }
  if (listing.sellerId !== req.userId) {
    res.status(403).json({ error: '無權限' });
    return;
  }
  await prisma.listing.update({ where: { id: id }, data: { status: 'cancelled' } });
  res.json({ ok: true });
}
