import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { scanArbitrage } from '../lib/kapai/scan';

/** 立即掃描當前卡拍拍套利機會（不推、不存，純檢視） */
export async function adminKapaiScan(_req: AuthRequest, res: Response) {
  try {
    const result = await scanArbitrage();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: `掃描失敗：${e?.message ?? e}` });
  }
}

/** Huca 行情純檢視（分頁/搜尋/篩選/排序 + 統計） */
export async function adminHucaCards(req: AuthRequest, res: Response) {
  const { q = '', setCode = '', hasPrice = 'true', sort = 'offers', page = '1', limit = '50' } =
    req.query as Record<string, string>;
  const where: any = {};
  if (setCode) where.setCode = setCode;
  if (hasPrice === 'true') where.lowPriceTwd = { not: null };
  if (q.trim()) where.OR = [
    { nameZh: { contains: q.trim(), mode: 'insensitive' } },
    { sku: { contains: q.trim(), mode: 'insensitive' } },
  ];
  const orderBy: any =
    sort === 'price' ? { lowPriceTwd: 'asc' } :
    sort === 'offers' ? { offerCount: 'desc' } : { priceUpdatedAt: 'desc' };
  const take = parseInt(limit, 10); const skip = (parseInt(page, 10) - 1) * take;
  const [cards, total, withPrice, highLiq] = await Promise.all([
    prisma.hucaCard.findMany({ where, orderBy, take, skip }),
    prisma.hucaCard.count({ where }),
    prisma.hucaCard.count({ where: { lowPriceTwd: { not: null } } }),
    prisma.hucaCard.count({ where: { offerCount: { gte: 10 } } }),
  ]);
  res.json({ cards, total, withPrice, highLiq, page: parseInt(page, 10), pages: Math.ceil(total / take) });
}
