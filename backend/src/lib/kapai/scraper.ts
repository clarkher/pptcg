import { prisma } from '../prisma';
import { buildCardKey } from './logic';

const LATEST_URL = 'https://trade.kapaipai.tw/api/product/listLatestProduct';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface RawProduct {
  id: number; game: string; productKey: string; price: string; stock: number;
  condition: string; rare: string; packId: string; packCardId: string; packName: string;
  sellerId: number; sellerNickname: string; sellerArea: string; createdTime: string;
}

export async function fetchLatestProducts(): Promise<RawProduct[]> {
  const res = await fetch(LATEST_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`kapai listLatestProduct HTTP ${res.status}`);
  const json: any = await res.json();
  return (json?.data?.products ?? []) as RawProduct[];
}

export async function ingestLatest(): Promise<{ scraped: number; saved: number; skipped: number }> {
  const products = await fetchLatestProducts();
  let saved = 0, skipped = 0;
  for (const p of products) {
    const cardKey = buildCardKey(p.packId, p.packCardId);
    if (!cardKey) { skipped++; continue; }
    const price = parseInt(p.price, 10);
    if (Number.isNaN(price)) { skipped++; continue; }
    const base = {
      game: p.game, cardKey, setCode: p.packId, cardNumber: p.packCardId,
      name: p.productKey, packName: p.packName ?? '', rarity: p.rare ?? '',
      price, stock: p.stock ?? 0, condition: p.condition ?? 'unknown',
      sellerId: p.sellerId ?? 0, sellerNickname: p.sellerNickname ?? '',
      sellerArea: p.sellerArea ?? '', listedAt: new Date(p.createdTime),
    };
    await prisma.kapaiListing.upsert({
      where: { id: p.id },
      update: { price: base.price, stock: base.stock },
      create: { id: p.id, ...base, processed: false },
    });
    saved++;
  }
  return { scraped: products.length, saved, skipped };
}
