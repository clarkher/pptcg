import { prisma } from './prisma';

// 在「某 cardId 庫存可能由 0→正數」之後呼叫。
// 以 cardId 目前 active 庫存總量判定是否已有貨；若有貨，通知所有 notified=false 的敲碗用戶。
export async function runRestockNotify(cardId: string): Promise<number> {
  const agg = await prisma.listing.aggregate({
    where: { cardId, status: 'active' },
    _sum: { quantity: true },
  });
  const totalQty = agg._sum.quantity ?? 0;
  if (totalQty <= 0) return 0;

  const wishes = await prisma.wishlist.findMany({ where: { cardId, notified: false } });
  if (wishes.length === 0) return 0;

  const card = await prisma.pokemonCard.findUnique({ where: { id: cardId } });
  const name = card?.name ?? '卡片';
  const image = card?.imageHigh || card?.image || '';

  await prisma.$transaction([
    prisma.notification.createMany({
      data: wishes.map((w) => ({
        userId: w.userId, type: 'restock', cardId,
        cardName: name, cardImage: image,
        message: `你敲碗的「${name}」補貨了！`,
      })),
    }),
    prisma.wishlist.updateMany({
      where: { cardId, notified: false },
      data: { notified: true },
    }),
  ]);
  return wishes.length;
}
