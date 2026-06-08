import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// ── Rarity ──
export const listRarities = async (_req: Request, res: Response) => {
  res.json(await prisma.rarity.findMany({ orderBy: { sortOrder: 'asc' } }));
};
export const createRarity = async (req: Request, res: Response) => {
  const { code, label, color, sortOrder } = req.body;
  if (!code || !label) {
    res.status(400).json({ error: '缺少 code/label' });
    return;
  }
  res.status(201).json(await prisma.rarity.create({
    data: { code, label, color: color || '#64748b', sortOrder: sortOrder ?? 0 },
  }));
};
export const updateRarity = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { code, label, color, sortOrder } = req.body;
  res.json(await prisma.rarity.update({
    where: { id },
    data: {
      ...(code !== undefined && { code }),
      ...(label !== undefined && { label }),
      ...(color !== undefined && { color }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
  }));
};
export const deleteRarity = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const r = await prisma.rarity.findUnique({ where: { id } });
  if (!r) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const inUseCount = await prisma.pokemonCard.count({ where: { rarity: r.code } });
  await prisma.rarity.delete({ where: { id } });
  res.json({ ok: true, inUseCount });
};

// ── Condition ──
export const listConditions = async (_req: Request, res: Response) => {
  res.json(await prisma.condition.findMany({ orderBy: { sortOrder: 'asc' } }));
};
export const createCondition = async (req: Request, res: Response) => {
  const { code, label, sortOrder } = req.body;
  if (!code || !label) {
    res.status(400).json({ error: '缺少 code/label' });
    return;
  }
  res.status(201).json(await prisma.condition.create({
    data: { code, label, sortOrder: sortOrder ?? 0 },
  }));
};
export const updateCondition = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { code, label, sortOrder } = req.body;
  res.json(await prisma.condition.update({
    where: { id },
    data: {
      ...(code !== undefined && { code }),
      ...(label !== undefined && { label }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
  }));
};
export const deleteCondition = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const c = await prisma.condition.findUnique({ where: { id } });
  if (!c) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const inUseCount = await prisma.listing.count({ where: { condition: c.code } });
  await prisma.condition.delete({ where: { id } });
  res.json({ ok: true, inUseCount });
};

// ── Series ──
export const listSeriesDefs = async (req: Request, res: Response) => {
  const { language } = req.query as Record<string, string>;
  res.json(await prisma.series.findMany({
    where: language ? { language } : undefined,
    orderBy: [{ language: 'asc' }, { sortOrder: 'asc' }],
  }));
};
export const createSeriesDef = async (req: Request, res: Response) => {
  const { key, name, language, logo, sortOrder } = req.body;
  if (!key || !name || !language) {
    res.status(400).json({ error: '缺少 key/name/language' });
    return;
  }
  res.status(201).json(await prisma.series.create({
    data: { key, name, language, logo: logo || null, sortOrder: sortOrder ?? 0 },
  }));
};
export const updateSeriesDef = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { key, name, language, logo, sortOrder } = req.body;
  res.json(await prisma.series.update({
    where: { id },
    data: {
      ...(key !== undefined && { key }),
      ...(name !== undefined && { name }),
      ...(language !== undefined && { language }),
      ...(logo !== undefined && { logo }),
      ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
    },
  }));
};
export const deleteSeriesDef = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const s = await prisma.series.findUnique({ where: { id } });
  if (!s) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const inUseCount = await prisma.pokemonCard.count({ where: { language: s.language, seriesKey: s.key } });
  await prisma.series.delete({ where: { id } });
  res.json({ ok: true, inUseCount });
};
