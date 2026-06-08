import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { aggregateInventory, type InventoryRow } from '../lib/inventory';
import { AuthRequest } from '../middleware/auth';

// 取一批 cardId 的 active 庫存，回 Map<cardId, InventoryRow[]>
async function inventoryByCard(cardIds: string[]): Promise<Map<string, InventoryRow[]>> {
  const map = new Map<string, InventoryRow[]>();
  if (cardIds.length === 0) return map;
  const listings = await prisma.listing.findMany({
    where: { cardId: { in: cardIds }, status: 'active' },
    select: { cardId: true, variant: true, condition: true, price: true, quantity: true },
  });
  for (const l of listings) {
    const arr = map.get(l.cardId) ?? [];
    arr.push(l);
    map.set(l.cardId, arr);
  }
  return map;
}

async function wishlistCountByCard(cardIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (cardIds.length === 0) return map;
  const grouped = await prisma.wishlist.groupBy({
    by: ['cardId'],
    where: { cardId: { in: cardIds } },
    _count: { id: true },
  });
  for (const g of grouped) map.set(g.cardId, g._count.id);
  return map;
}

export async function listCatalogCards(req: Request, res: Response) {
  const {
    language = '', seriesKey = '', setId = '', q = '',
    inStock = '', sort = 'price', page = '1', limit = '24',
  } = req.query as Record<string, string>;

  const where: any = {};
  if (language) where.language = language;
  if (seriesKey) where.seriesKey = seriesKey;
  if (setId) where.setId = setId;
  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: 'insensitive' } },
      { number: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }

  const take = parseInt(limit);
  const skip = (parseInt(page) - 1) * take;

  // 為支援「只看有庫存」與「價格排序」，先抓符合條件的卡（不分頁），
  // 合併庫存彙整後在記憶體排序/篩選/分頁。資料量級為單一套系（數十～數百張），可接受。
  const cards = await prisma.pokemonCard.findMany({ where });
  const ids = cards.map((c) => c.id);
  const [inv, wish] = await Promise.all([inventoryByCard(ids), wishlistCountByCard(ids)]);

  let merged = cards.map((c) => {
    const agg = aggregateInventory(inv.get(c.id) ?? []);
    return {
      id: c.id, name: c.name, number: c.number, image: c.image, imageHigh: c.imageHigh,
      rarity: c.rarity, language: c.language, seriesKey: c.seriesKey, seriesName: c.seriesName,
      setId: c.setId, setName: c.setName,
      minPrice: agg.minPrice, totalQty: agg.totalQty, variantCount: agg.variantCount,
      wishlistCount: wish.get(c.id) ?? 0,
    };
  });

  if (inStock === 'true') merged = merged.filter((m) => m.totalQty > 0);

  merged.sort((a, b) => {
    if (sort === 'price') {
      // 有貨者優先；有貨內依最低價升冪；無貨者排後（依 number）
      const aHas = a.minPrice != null, bHas = b.minPrice != null;
      if (aHas && bHas) return a.minPrice! - b.minPrice!;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    }
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const total = merged.length;
  const pageItems = merged.slice(skip, skip + take);
  res.json({ cards: pageItems, total, page: parseInt(page), pages: Math.ceil(total / take) });
}

export async function getCatalogCard(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  const card = await prisma.pokemonCard.findUnique({ where: { id } });
  if (!card) {
    res.status(404).json({ error: '找不到卡片' });
    return;
  }

  const listings = await prisma.listing.findMany({
    where: { cardId: id, status: 'active' },
    select: { id: true, variant: true, condition: true, price: true, quantity: true },
    orderBy: [{ price: 'asc' }],
  });
  const wishlistCount = await prisma.wishlist.count({ where: { cardId: id } });
  let userWished = false;
  if (req.userId) {
    userWished = (await prisma.wishlist.count({ where: { cardId: id, userId: req.userId } })) > 0;
  }

  res.json({
    ...card,
    variants: listings.map((l) => ({
      listingId: l.id, variant: l.variant, condition: l.condition,
      price: l.price, quantity: l.quantity,
    })),
    wishlistCount, userWished,
  });
}
