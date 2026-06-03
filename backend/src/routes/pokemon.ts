import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Search Pokemon cards from DB
router.get('/search', async (req: Request, res: Response) => {
  const { q = '', setId, rarity, page = '1', limit = '24' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (q.trim()) where.name = { contains: q.trim(), mode: 'insensitive' };
  if (setId) where.setId = setId;
  if (rarity) where.rarity = rarity;

  const [cards, total] = await Promise.all([
    prisma.pokemonCard.findMany({
      where, skip, take: parseInt(limit),
      orderBy: [{ releaseDate: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, number: true,
        imageSmall: true, imageLarge: true,
        rarity: true, setId: true, setName: true,
        setSeries: true, releaseDate: true, types: true, hp: true,
      },
    }),
    prisma.pokemonCard.count({ where }),
  ]);

  res.json({ cards, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// Get all sets (for filter dropdown)
router.get('/sets', async (_req: Request, res: Response) => {
  const sets = await prisma.pokemonCard.findMany({
    distinct: ['setId'],
    select: { setId: true, setName: true, setSeries: true, releaseDate: true },
    orderBy: { releaseDate: 'desc' },
  });
  res.json(sets);
});

// Get DB stats
router.get('/stats', async (_req: Request, res: Response) => {
  const [total, sets] = await Promise.all([
    prisma.pokemonCard.count(),
    prisma.pokemonCard.findMany({ distinct: ['setId'], select: { setId: true } }),
  ]);
  res.json({ total, sets: sets.length });
});

export default router;
