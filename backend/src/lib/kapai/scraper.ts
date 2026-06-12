import { prisma } from '../prisma';
import { buildCardKey } from './logic';

const BASE = 'https://trade.kapaipai.tw/api';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// 放量：listProduct 翻頁無效但 pageSize 有效（最新優先）。三個寶可夢 game 各抓一批，合計約 1000。
const PKM_GAMES = ['pkmtw', 'pkmjp', 'pkmen'] as const;
const PAGE_SIZE = 350;

interface RawProduct {
  id: number; game: string; productKey: string; price: string; stock: number;
  condition: string; rare: string; packId: string; packCardId: string; packName: string;
  sellerId: number; sellerNickname: string; sellerArea: string; createdTime: string;
}

export async function fetchLatestProducts(): Promise<RawProduct[]> {
  const all: RawProduct[] = [];
  for (const game of PKM_GAMES) {
    const res = await fetch(`${BASE}/product/listProduct?game=${game}&page=1&pageSize=${PAGE_SIZE}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    const json: any = await res.json();
    all.push(...((json?.data?.products ?? []) as RawProduct[]));
  }
  if (all.length === 0) throw new Error('kapai listProduct 全部失敗');
  return all;
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
