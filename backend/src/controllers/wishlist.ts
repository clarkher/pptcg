import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function addWishlist(req: AuthRequest, res: Response) {
  const { cardId, variant = null } = req.body;
  if (!cardId) {
    res.status(400).json({ error: '缺少 cardId' });
    return;
  }
  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  if (!card) {
    res.status(404).json({ error: '找不到卡片' });
    return;
  }

  const existing = await prisma.wishlist.findFirst({ where: { userId: req.userId!, cardId, variant } });
  if (existing) {
    // 重新敲碗 = 重新武裝通知：若先前已通知過，reset notified 讓下次補貨再次觸發
    if (existing.notified) {
      const rearmed = await prisma.wishlist.update({ where: { id: existing.id }, data: { notified: false } });
      res.status(200).json(rearmed);
      return;
    }
    res.status(200).json(existing);
    return;
  }

  const wl = await prisma.wishlist.create({
    data: {
      userId: req.userId!, cardId, variant,
      cardName: card.name, cardImage: card.imageHigh || card.image, language: card.language,
    },
  });
  res.status(201).json(wl);
}

export async function removeWishlist(req: AuthRequest, res: Response) {
  const { cardId, variant = null } = req.body;
  await prisma.wishlist.deleteMany({ where: { userId: req.userId!, cardId, variant } });
  res.json({ ok: true });
}

export async function myWishlist(req: AuthRequest, res: Response) {
  res.json(await prisma.wishlist.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  }));
}
