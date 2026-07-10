import { prisma } from '../prisma';
import { computeSurge, pickSurgeDeal, analyzeNote } from './logic';
import { fetchSurgeSeries } from './huca-raw';
import { fetchPerfectSnapshot } from './market';
import { buildText, notify, type AlertListing } from './notifier';
import { loadConfig } from './config';

const CONCURRENCY = 10; // 與主偵測一致：並行 10 路打 Huca/卡拍拍

/** 由 HucaCard 的 setCode+番號，還原卡拍拍 packId/packCardId/game（取番號數字對齊的最近一筆掛單）。 */
async function findKapaiCard(setCode: string, cardNumber: string) {
  const num = parseInt(cardNumber, 10);
  if (Number.isNaN(num)) return null;
  const rows = await prisma.kapaiListing.findMany({
    where: { setCode },
    orderBy: { scrapedAt: 'desc' },
    select: { game: true, cardNumber: true, cardKey: true },
  });
  const hit = rows.find((r) => parseInt(r.cardNumber, 10) === num);
  return hit ? { game: hit.game, packId: setCode, packCardId: hit.cardNumber, cardKey: hit.cardKey } : null;
}

/**
 * 行情跳漲撿漏（並行）：掃高價值美日卡的 Huca 成交序列，
 * 「漲價＋熱度」雙跳漲者，回抓卡拍拍目前最低 perfect 掛單，用 surge 專用門檻判套利。
 * 命中 → upsert 掛單 + 建 ArbitrageAlert(source='surge') + 即時推 Telegram（LINE 走批次）。
 * 去重靠 ArbitrageAlert.listingId unique；單卡失敗不影響整輪。
 */
export async function detectSurges(): Promise<{ scanned: number; surged: number; detected: number }> {
  const { params, surge } = await loadConfig();
  if (!surge.enabled) return { scanned: 0, surged: 0, detected: 0 };

  const cards = await prisma.hucaCard.findMany({
    where: { rawPriceTwd: { gte: surge.minBaseline }, snkrdunkId: { not: null } },
    select: { snkrdunkId: true, setCode: true, cardNumber: true },
  });

  let surged = 0;
  let detected = 0;
  let idx = 0;
  async function worker() {
    while (idx < cards.length) {
      const c = cards[idx++];
      try {
        const series = await fetchSurgeSeries(c.snkrdunkId!);
        const s = computeSurge(series, surge, Date.now());
        if (!s.surged || s.recentMedianTwd < surge.minBaseline) continue;
        surged++;

        const map = await findKapaiCard(c.setCode, c.cardNumber);
        if (!map) continue;
        const listings = await fetchPerfectSnapshot(map.game, map.packId, map.packCardId);
        if (!listings || listings.length === 0) continue;

        const deal = pickSurgeDeal(listings, s.recentMedianTwd, {
          discountThreshold: surge.discountThreshold,
          minProfit: surge.minProfit,
          minMarketValue: surge.minBaseline,
          minSamples: params.minSamples,
        });
        if (!deal) continue;

        const l = deal.listing;
        // 備註「隨機出貨」= 買到的不是這張卡 → 不推
        if (analyzeNote(l.description).suppress) continue;
        const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
        if (existing) continue; // 兩軌去重：已建過就不重複

        await prisma.kapaiListing.upsert({
          where: { id: l.id },
          update: { price: l.price, stock: l.stock, processed: true },
          create: {
            id: l.id, game: l.game, cardKey: map.cardKey, setCode: l.packId, cardNumber: l.packCardId,
            name: l.productKey, packName: l.packName, rarity: l.rare, description: l.description ?? '', price: l.price, stock: l.stock,
            condition: l.condition, sellerId: l.sellerId, sellerNickname: l.sellerNickname,
            sellerArea: l.sellerArea, listedAt: l.createdTime ? new Date(l.createdTime) : new Date(),
            processed: true,
          },
        });
        await prisma.arbitrageAlert.create({
          data: {
            listingId: l.id, cardKey: map.cardKey, game: l.game, price: l.price,
            baseline: s.recentMedianTwd, discount: deal.discount, profit: deal.profit,
            source: 'surge', notified: false,
          },
        });
        const alertListing: AlertListing = {
          id: l.id, game: l.game, name: l.productKey, packName: l.packName, cardKey: map.cardKey,
          condition: l.condition, price: l.price, sellerId: l.sellerId,
          sellerNickname: l.sellerNickname, sellerArea: l.sellerArea, description: l.description ?? '',
        };
        await notify(buildText(alertListing, s.recentMedianTwd, { surge: true }));
        detected++;
      } catch {
        // 單卡失敗不影響整輪
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { scanned: cards.length, surged, detected };
}
