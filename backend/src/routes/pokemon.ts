import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Search cards — filtered by language + series + set + name
router.get('/search', async (req: Request, res: Response) => {
  const {
    q = '', language = '', seriesKey = '', setId = '',
    page = '1', limit = '24',
  } = req.query as Record<string, string>;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};

  if (language) where.language = language;
  if (seriesKey) where.seriesKey = seriesKey;
  if (setId) where.setId = setId;
  if (q.trim()) where.name = { contains: q.trim(), mode: 'insensitive' };

  const [cards, total] = await Promise.all([
    prisma.pokemonCard.findMany({
      where, skip, take: parseInt(limit),
      orderBy: [{ releaseDate: 'desc' }, { number: 'asc' }],
    }),
    prisma.pokemonCard.count({ where }),
  ]);

  res.json({ cards, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// Get series list grouped by language
router.get('/series', async (req: Request, res: Response) => {
  const { language = 'en' } = req.query as Record<string, string>;

  const series = await prisma.pokemonCard.groupBy({
    by: ['seriesKey', 'seriesName', 'language'],
    where: { language },
    _count: { id: true },
    orderBy: { seriesKey: 'asc' },
  });

  res.json(series.map(s => ({
    key: s.seriesKey,
    name: s.seriesName,
    language: s.language,
    count: s._count.id,
  })));
});

// Get sets within a series + language
router.get('/sets', async (req: Request, res: Response) => {
  const { language = 'en', seriesKey = '' } = req.query as Record<string, string>;

  const where: any = { language };
  if (seriesKey) where.seriesKey = seriesKey;

  const sets = await prisma.pokemonCard.groupBy({
    by: ['setId', 'setName', 'setLogo', 'releaseDate', 'language', 'seriesKey'],
    where,
    _count: { id: true },
    orderBy: { releaseDate: 'desc' },
  });

  res.json(sets.map(s => ({
    id: s.setId, name: s.setName, logo: s.setLogo,
    releaseDate: s.releaseDate, language: s.language,
    seriesKey: s.seriesKey, count: s._count.id,
  })));
});

// Stats
router.get('/stats', async (_req: Request, res: Response) => {
  const [en, ja, zh] = await Promise.all([
    prisma.pokemonCard.count({ where: { language: 'en' } }),
    prisma.pokemonCard.count({ where: { language: 'ja' } }),
    prisma.pokemonCard.count({ where: { language: 'zh' } }),
  ]);
  res.json({ en, ja, zh, total: en + ja + zh });
});

export default router;
