import { prisma } from '../prisma';
import { buildCardKey, listingChanged } from './logic';
import { loadConfig, pickScrapeWindow, getTaiwanHour } from './config';
import { kapaiBase, kapaiHeaders } from './kapai-http';
// 各 game 抓量改由後台 config 分時段定義（listProduct 翻頁無效但 pageSize 有效、最新優先）。

interface RawProduct {
  id: number; game: string; productKey: string; price: string; stock: number;
  condition: string; rare: string; packId: string; packCardId: string; packName: string;
  sellerId: number; sellerNickname: string; sellerArea: string; createdTime: string;
  description: string;
}

export async function fetchLatestProducts(): Promise<RawProduct[]> {
  const { scrapeWindows } = await loadConfig();
  const w = pickScrapeWindow(scrapeWindows, getTaiwanHour());
  const sizes: Record<string, number> = { pkmtw: w.pkmtw, pkmjp: w.pkmjp, pkmen: w.pkmen };
  const all: RawProduct[] = [];
  for (const [game, size] of Object.entries(sizes)) {
    const res = await fetch(`${kapaiBase()}/product/listProduct?game=${game}&page=1&pageSize=${size}`, { headers: kapaiHeaders() });
    if (!res.ok) continue;
    const json: any = await res.json();
    all.push(...((json?.data?.products ?? []) as RawProduct[]));
  }
  if (all.length === 0) throw new Error('kapai listProduct 全部失敗');
  return all;
}

export async function ingestLatest(): Promise<{ scraped: number; saved: number; skipped: number; unchanged: number }> {
  const products = await fetchLatestProducts();
  // 先過濾出有效掛單
  const valid = products
    .map((p) => ({ p, cardKey: buildCardKey(p.packId, p.packCardId), price: parseInt(p.price, 10) }))
    .filter((x): x is { p: RawProduct; cardKey: string; price: number } => !!x.cardKey && !Number.isNaN(x.price));
  const skipped = products.length - valid.length;

  // 批次讀現有 price/stock，只寫「新出現或價/量有變」的，沒變的整列跳過（省 DB 寫入）
  const existingRows = await prisma.kapaiListing.findMany({
    where: { id: { in: valid.map((x) => x.p.id) } },
    select: { id: true, price: true, stock: true },
  });
  const existing = new Map(existingRows.map((r) => [r.id, r]));

  let saved = 0, unchanged = 0;
  for (const { p, cardKey, price } of valid) {
    const stock = p.stock ?? 0;
    if (!listingChanged(existing.get(p.id), { price, stock })) { unchanged++; continue; }
    const base = {
      game: p.game, cardKey, setCode: p.packId, cardNumber: p.packCardId,
      name: p.productKey, packName: p.packName ?? '', rarity: p.rare ?? '',
      description: p.description ?? '',
      price, stock, condition: p.condition ?? 'unknown',
      sellerId: p.sellerId ?? 0, sellerNickname: p.sellerNickname ?? '',
      sellerArea: p.sellerArea ?? '', listedAt: new Date(p.createdTime),
    };
    await prisma.kapaiListing.upsert({
      where: { id: p.id },
      // processed:false → 進入比價；只有新上架/變價的才會走到這（其餘跳過不寫）
      update: { price: base.price, stock: base.stock, description: base.description, processed: false },
      create: { id: p.id, ...base, processed: false },
    });
    saved++;
  }
  return { scraped: products.length, saved, skipped, unchanged };
}
