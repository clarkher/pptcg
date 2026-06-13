import { prisma } from '../prisma';
import { buildCardKey } from './logic';
import { loadConfig, pickScrapeWindow, getTaiwanHour } from './config';

const BASE = 'https://trade.kapaipai.tw/api';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// 各 game 抓量改由後台 config 分時段定義（listProduct 翻頁無效但 pageSize 有效、最新優先）。

interface RawProduct {
  id: number; game: string; productKey: string; price: string; stock: number;
  condition: string; rare: string; packId: string; packCardId: string; packName: string;
  sellerId: number; sellerNickname: string; sellerArea: string; createdTime: string;
}

export async function fetchLatestProducts(): Promise<RawProduct[]> {
  const { scrapeWindows } = await loadConfig();
  const w = pickScrapeWindow(scrapeWindows, getTaiwanHour());
  const sizes: Record<string, number> = { pkmtw: w.pkmtw, pkmjp: w.pkmjp, pkmen: w.pkmen };
  const all: RawProduct[] = [];
  for (const [game, size] of Object.entries(sizes)) {
    const res = await fetch(`${BASE}/product/listProduct?game=${game}&page=1&pageSize=${size}`, { headers: { 'User-Agent': UA } });
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
      // processed:false → 全量重偵測：既有卡每輪重新進入比價（行情變動造成的撿漏也抓得到）
      update: { price: base.price, stock: base.stock, processed: false },
      create: { id: p.id, ...base, processed: false },
    });
    saved++;
  }
  return { scraped: products.length, saved, skipped };
}
