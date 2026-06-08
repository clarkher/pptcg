import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { runRestockNotify } from '../lib/restock';
import { aggregateInventory, becameRestocked, type InventoryRow } from '../lib/inventory';

// 取某 cardId 目前 active 庫存總量
async function cardTotalQty(cardId: string): Promise<number> {
  const agg = await prisma.listing.aggregate({ where: { cardId, status: 'active' }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

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

// ── Inventory (後台庫存，補貨觸發) ──────────────────────────

export async function adminCreateInventory(req: AuthRequest, res: Response) {
  const { cardId, cardName, cardGame, cardImage, language, variant, condition, price, quantity, description } = req.body;
  if (!cardId || price === undefined) {
    res.status(400).json({ error: '缺少必要資料' });
    return;
  }
  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  if (!card) {
    res.status(400).json({ error: 'cardId 對不到目錄卡，請先建立目錄卡' });
    return;
  }

  const prevTotal = await cardTotalQty(cardId);
  const listing = await prisma.listing.create({
    data: {
      cardId,
      cardName: cardName || card.name,
      cardGame: cardGame || 'pokemon',
      cardImage: cardImage || card.imageHigh || card.image || '',
      language: language || card.language,
      variant: variant || '標準',
      condition: condition || 'NM',
      price: parseFloat(price),
      quantity: parseInt(quantity) || 0,
      description: description || '',
      sellerId: req.userId!,
      status: 'active',
    },
  });
  const nextTotal = await cardTotalQty(cardId);
  if (becameRestocked(prevTotal, nextTotal)) await runRestockNotify(cardId);
  res.status(201).json(listing);
}

export async function adminUpdateInventory(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  const { price, quantity, variant, condition, status } = req.body;
  const before = await prisma.listing.findUnique({ where: { id } });
  if (!before) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  const prevTotal = await cardTotalQty(before.cardId);
  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) }),
      ...(variant !== undefined && { variant }),
      ...(condition !== undefined && { condition }),
      ...(status !== undefined && { status }),
    },
  });
  const nextTotal = await cardTotalQty(updated.cardId);
  if (becameRestocked(prevTotal, nextTotal)) await runRestockNotify(updated.cardId);
  res.json(updated);
}

export async function adminDeleteInventory(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  await prisma.listing.delete({ where: { id } });
  res.json({ ok: true });
}

// ── Catalog 管理（所有卡 + 庫存 + 敲碗數）──────────────────

export async function adminCatalog(req: AuthRequest, res: Response) {
  const { language = '', seriesKey = '', setId = '', q = '', hasWishlist = '', inStock = '', page = '1', limit = '40' } =
    req.query as Record<string, string>;
  const where: any = {};
  if (language) where.language = language;
  if (seriesKey) where.seriesKey = seriesKey;
  if (setId) where.setId = setId;
  if (q.trim()) where.OR = [
    { name: { contains: q.trim(), mode: 'insensitive' } },
    { number: { contains: q.trim(), mode: 'insensitive' } },
  ];

  const cards = await prisma.pokemonCard.findMany({ where, orderBy: [{ setId: 'asc' }, { number: 'asc' }] });
  const ids = cards.map((c) => c.id);

  const listings = ids.length ? await prisma.listing.findMany({
    where: { cardId: { in: ids }, status: 'active' },
    select: { id: true, cardId: true, variant: true, condition: true, price: true, quantity: true },
  }) : [];
  const wishGrouped = ids.length ? await prisma.wishlist.groupBy({
    by: ['cardId'], where: { cardId: { in: ids } }, _count: { id: true },
  }) : [];

  const invMap = new Map<string, InventoryRow[]>();
  const listingMap = new Map<string, typeof listings>();
  for (const l of listings) {
    const arr = invMap.get(l.cardId) ?? []; arr.push(l as any); invMap.set(l.cardId, arr);
    const larr = listingMap.get(l.cardId) ?? []; larr.push(l); listingMap.set(l.cardId, larr);
  }
  const wishMap = new Map(wishGrouped.map((g) => [g.cardId, g._count.id]));

  let merged = cards.map((c) => {
    const agg = aggregateInventory(invMap.get(c.id) ?? []);
    return {
      id: c.id, name: c.name, number: c.number, image: c.image, imageHigh: c.imageHigh,
      rarity: c.rarity, language: c.language, seriesKey: c.seriesKey, seriesName: c.seriesName,
      setId: c.setId, setName: c.setName,
      inventory: listingMap.get(c.id) ?? [],
      ...agg,
      wishlistCount: wishMap.get(c.id) ?? 0,
    };
  });

  if (hasWishlist === 'true') merged = merged.filter((m) => m.wishlistCount > 0);
  if (inStock === 'true') merged = merged.filter((m) => m.totalQty > 0);
  if (inStock === 'false') merged = merged.filter((m) => m.totalQty === 0);

  const take = parseInt(limit); const skip = (parseInt(page) - 1) * take;
  res.json({ cards: merged.slice(skip, skip + take), total: merged.length, page: parseInt(page), pages: Math.ceil(merged.length / take) });
}

export async function adminCardWishlist(req: AuthRequest, res: Response) {
  const { cardId } = req.query as Record<string, string>;
  if (!cardId) {
    res.status(400).json({ error: '缺少 cardId' });
    return;
  }
  const list = await prisma.wishlist.findMany({
    where: { cardId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { username: true, email: true } } },
  });
  res.json(list);
}

// 敲碗總覽：跨卡彙整，依敲碗人數排序
export async function adminWishlistOverview(_req: AuthRequest, res: Response) {
  const grouped = await prisma.wishlist.groupBy({
    by: ['cardId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const cardIds = grouped.map((g) => g.cardId);
  if (cardIds.length === 0) {
    res.json([]);
    return;
  }

  const cards = await prisma.pokemonCard.findMany({ where: { id: { in: cardIds } } });
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  // Wishlist 自帶 denormalized 卡資訊，作為目錄查不到時的 fallback
  const wlInfo = await prisma.wishlist.findMany({
    where: { cardId: { in: cardIds } },
    distinct: ['cardId'],
    select: { cardId: true, cardName: true, cardImage: true, language: true },
  });
  const wlMap = new Map(wlInfo.map((w) => [w.cardId, w]));
  const stock = await prisma.listing.groupBy({
    by: ['cardId'],
    where: { cardId: { in: cardIds }, status: 'active' },
    _sum: { quantity: true },
  });
  const stockMap = new Map(stock.map((s) => [s.cardId, s._sum.quantity ?? 0]));

  res.json(grouped.map((g) => {
    const c = cardMap.get(g.cardId);
    const w = wlMap.get(g.cardId);
    return {
      cardId: g.cardId,
      cardName: c?.name ?? w?.cardName ?? '',
      cardImage: c?.imageHigh || c?.image || w?.cardImage || '',
      language: c?.language ?? w?.language ?? '',
      rarity: c?.rarity ?? null,
      setName: c?.setName ?? '',
      seriesKey: c?.seriesKey ?? '',
      setId: c?.setId ?? '',
      wishlistCount: g._count.id,
      totalQty: stockMap.get(g.cardId) ?? 0,
    };
  }));
}

// ── Catalog 卡片資料編輯/新增/孤兒檢查 ────────────────────

const CARD_FIELDS = ['name','number','rarity','image','imageHigh','seriesKey','seriesName','setId','setName','types','hp','supertype'] as const;

export async function adminUpdateCard(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  const data: any = {};
  for (const f of CARD_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
  const card = await prisma.pokemonCard.update({ where: { id }, data });
  res.json(card);
}

export async function adminCreateCard(req: AuthRequest, res: Response) {
  const { id, language, setId, setName, seriesKey, seriesName, number, name, image } = req.body;
  if (!id || !language || !setId || !seriesKey || !number || !name) {
    res.status(400).json({ error: '缺少必要欄位 (id/language/setId/seriesKey/number/name)' });
    return;
  }
  const exists = await prisma.pokemonCard.findUnique({ where: { id } });
  if (exists) {
    res.status(409).json({ error: 'id 已存在' });
    return;
  }
  const data: any = { id, language, setId, setName: setName || '', seriesKey, seriesName: seriesName || '', number, name, image: image || '' };
  for (const f of ['imageHigh','rarity','hp','types','supertype'] as const) if (req.body[f] !== undefined) data[f] = req.body[f];
  const card = await prisma.pokemonCard.create({ data });
  res.status(201).json(card);
}

export async function adminOrphanListings(_req: AuthRequest, res: Response) {
  const listings = await prisma.listing.findMany({ select: { id: true, cardId: true, cardName: true } });
  const ids = [...new Set(listings.map((l) => l.cardId))];
  const cards = await prisma.pokemonCard.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const known = new Set(cards.map((c) => c.id));
  res.json(listings.filter((l) => !known.has(l.cardId)));
}

// ── Settings (LINE credentials, etc.) ─────────────────────────

// Sensitive keys whose values are masked in GET response
const MASKED_KEYS = new Set(['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN']);

export async function adminGetSettings(_req: AuthRequest, res: Response) {
  const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  res.json(settings.map(s => ({
    key: s.key,
    value: MASKED_KEYS.has(s.key) ? (s.value ? '••••••' + s.value.slice(-4) : '') : s.value,
    updatedAt: s.updatedAt,
    hasValue: !!s.value,
  })));
}

export async function adminUpsertSetting(req: AuthRequest, res: Response) {
  const key = req.params.key as string;
  const { value } = req.body;
  if (!key || value === undefined) { res.status(400).json({ error: 'key and value required' }); return; }
  const setting = await prisma.setting.upsert({
    where: { key: key },
    update: { value: String(value) },
    create: { key: key, value: String(value) },
  });
  res.json({ key: setting.key, updatedAt: setting.updatedAt });
}

// Generate a 6-char binding code for LINE account linking
export async function adminGenLineBindToken(req: AuthRequest, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

  // Expire old tokens for this user
  await prisma.lineBindToken.deleteMany({ where: { userId } });

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await prisma.lineBindToken.create({ data: { code, userId, expiresAt } });

  res.json({ code, expiresAt });
}
