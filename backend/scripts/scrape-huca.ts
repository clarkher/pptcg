/**
 * Huca.tw Card & Price Scraper
 *
 * Data source: huca.tw aggregates Snkrdunk (JP) + eBay (EN) prices.
 * TWD market prices are publicly available in JSON-LD on each card page — no login needed.
 * Card IDs on Huca = Snkrdunk product IDs (NOT sequential; must be discovered via set pages).
 *
 * Usage:
 *   ts-node scripts/scrape-huca.ts           # full run: discover + scrape prices (~2hrs)
 *   ts-node scripts/scrape-huca.ts discover  # only discover & register card IDs (~5min)
 *   ts-node scripts/scrape-huca.ts prices    # scrape prices for all known cards (~1.5hrs)
 *   ts-node scripts/scrape-huca.ts refresh   # only re-scrape cards with expired prices (~15min)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── All confirmed set IDs on huca.tw ────────────────────────────────────────
const ALL_SET_IDS = [
  // SV era (Scarlet & Violet) — 2023-present
  'SV1S', 'SV2a', 'SV3', 'SV3a', 'SV4a', 'SV5a',
  'SV6',  'SV6a', 'SV7', 'SV7a', 'SV8',  'SV8a',
  'SV9',  'SV9a', 'SV10', 'SV11W',
  // S era (Sword & Shield) — 2020-2023
  'S1H', 'S1W', 'S2',  'S3',   'S4',   'S4a',
  'S5a', 'S5I', 'S5R', 'S6a',  'S7D',  'S7R',
  'S8',  'S8a', 'S8b', 'S9',   'S10a', 'S10b',
  'S10D','S10P','S11', 'S12',  'S12a',
  // SM era (Sun & Moon) — 2016-2019
  'SM1M','SM1S','SM2L','SM2K','SM3N','SM4a',
  'SM5M','SM5S','SM6', 'SM6a','SM7', 'SM7a',
  'SM8', 'SM8a','SM9', 'SM10','SM10a','SM11','SM11a','SM12',
  // M / XY / BW / DP / CP — classic modern
  'M2','M3','M4',
  'XY1','XY2','XY3','XY4','XY5','XY6',
  'BW1','BW2','DP1','DP2',
  'CP1','CP2','CP3','CP4','CP5','CP6',
  // Promo & Special
  'PROMO','P','A','ADV',
  // Vintage
  'LEGEND','E','E1','E2','E3','E4',
  'PCG','PCG-P','VS','WEB',
  'NEO1','NEO2','NEO3','NEO4',
] as const;

const BASE_URL   = 'https://huca.tw';
const DELAY_MS   = 350; // ~2.8 req/s — respectful rate limit
const BATCH_LOG  = 200; // progress log every N cards
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' },
      });
      if (res.ok) return await res.text();
      if (res.status === 404) return null; // card doesn't exist
    } catch {
      if (attempt < retries - 1) await sleep(600 * (attempt + 1));
    }
  }
  return null;
}

// ─── Phase 1: Discover card IDs from set pages ───────────────────────────────

interface CardRef {
  hucaId:  number;
  slug:    string;
  setCode: string;
}

async function discoverCards(): Promise<CardRef[]> {
  console.log('\n📋 Phase 1: Discovering cards from set pages...');
  const allCards: CardRef[] = [];
  const seen = new Set<number>();

  for (const setCode of ALL_SET_IDS) {
    process.stdout.write(`  ${setCode.padEnd(8)} `);
    const html = await fetchHtml(`${BASE_URL}/sets/${setCode}/`);

    if (!html) {
      console.log('❌ fetch failed');
      await sleep(DELAY_MS);
      continue;
    }

    // Extract /cards/{id}/{slug} hrefs
    const matches = [...html.matchAll(/href="\/cards\/(\d+)\/([^"]*?)"/g)];
    let newCount = 0;

    for (const [, idStr, slug] of matches) {
      const id = parseInt(idStr, 10);
      if (!seen.has(id)) {
        seen.add(id);
        allCards.push({ hucaId: id, slug: slug.replace(/\/$/, ''), setCode });
        newCount++;
      }
    }

    console.log(newCount > 0 ? `✅ ${newCount} cards` : '⚠️  0 cards parsed');
    await sleep(DELAY_MS);
  }

  console.log(`\n  📊 Total unique cards discovered: ${allCards.length}`);
  return allCards;
}

// ─── Phase 2: Scrape price data from individual card pages ───────────────────

interface PriceData {
  nameZh:          string;
  sku:             string;
  cardNumber:      string;
  lowPriceTwd:     number | null;
  highPriceTwd:    number | null;
  offerCount:      number | null;
  priceValidUntil: Date   | null;
}

function extractPriceData(html: string): PriceData | null {
  // JSON-LD is always present on valid card pages — no login needed for price
  const ldMatch = html.match(/<script id="json-ld-product"[^>]*>([\s\S]*?)<\/script>/);
  if (!ldMatch) return null;

  try {
    const data = JSON.parse(ldMatch[1]);
    if (!data.name || !data.sku) return null;

    const offers = data.offers ?? {};

    // Extract card number from SKU:
    //   "pkmn-tcg-SV9a-084"  → "084"
    //   "pkmn-tcg-M2-110"    → "110"
    //   "pkmn-tcg-en-SM183"  → "SM183"
    //   "pkmn-tcg-PCG-P-001" → "001"
    const afterPrefix = data.sku.replace(/^pkmn-tcg-/, '');
    const parts       = afterPrefix.split('-');
    const cardNumber  = parts[parts.length - 1] ?? '';

    return {
      nameZh:          data.name,
      sku:             data.sku,
      cardNumber,
      lowPriceTwd:     offers.lowPrice     != null ? Math.round(offers.lowPrice)     : null,
      highPriceTwd:    offers.highPrice    != null ? Math.round(offers.highPrice)    : null,
      offerCount:      offers.offerCount   != null ? Math.round(offers.offerCount)   : null,
      priceValidUntil: offers.priceValidUntil ? new Date(offers.priceValidUntil)      : null,
    };
  } catch {
    return null;
  }
}

async function scrapePrices(cards: CardRef[]) {
  console.log(`\n💰 Phase 2: Scraping prices for ${cards.length} cards...`);
  let saved = 0, noPriceData = 0, fetchError = 0;
  const startTime = Date.now();

  for (let i = 0; i < cards.length; i++) {
    if (i > 0 && i % BATCH_LOG === 0) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const eta     = ((cards.length - i) * DELAY_MS / 60000).toFixed(1);
      console.log(`  [${i}/${cards.length}] saved=${saved} noData=${noPriceData} err=${fetchError} | ${elapsed}min elapsed, ~${eta}min left`);
    }

    const { hucaId, slug, setCode } = cards[i];
    const html = await fetchHtml(`${BASE_URL}/cards/${hucaId}/`);

    if (!html) {
      fetchError++;
      await sleep(DELAY_MS);
      continue;
    }

    const priceData = extractPriceData(html);

    if (!priceData) {
      // Card page exists but no JSON-LD product data (e.g. redirected or unusual format)
      noPriceData++;
      await sleep(DELAY_MS);
      continue;
    }

    try {
      await prisma.hucaCard.upsert({
        where:  { id: hucaId },
        update: {
          nameZh:          priceData.nameZh,
          sku:             priceData.sku,
          cardNumber:      priceData.cardNumber,
          slug,
          lowPriceTwd:     priceData.lowPriceTwd,
          highPriceTwd:    priceData.highPriceTwd,
          offerCount:      priceData.offerCount,
          priceValidUntil: priceData.priceValidUntil,
          priceUpdatedAt:  new Date(),
        },
        create: {
          id:              hucaId,
          setCode,
          cardNumber:      priceData.cardNumber,
          nameZh:          priceData.nameZh,
          sku:             priceData.sku,
          slug,
          lowPriceTwd:     priceData.lowPriceTwd,
          highPriceTwd:    priceData.highPriceTwd,
          offerCount:      priceData.offerCount,
          priceValidUntil: priceData.priceValidUntil,
          priceUpdatedAt:  new Date(),
        },
      });
      saved++;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // Duplicate SKU — same card registered under multiple IDs; update by ID only (no sku change)
        await prisma.hucaCard.update({
          where: { id: hucaId },
          data: {
            lowPriceTwd: priceData.lowPriceTwd, highPriceTwd: priceData.highPriceTwd,
            offerCount: priceData.offerCount, priceValidUntil: priceData.priceValidUntil,
            priceUpdatedAt: new Date(),
          },
        }).catch(() => {}); // if row doesn't exist yet, silently skip
        noPriceData++;
      } else {
        fetchError++;
        console.error(`\n  ⚠️  DB error for ID ${hucaId}:`, e?.message ?? e);
      }
    }
    await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n  ✅ Done in ${elapsed}min — saved=${saved} noData=${noPriceData} fetchError=${fetchError}`);
}

// Refresh mode: only re-scrape cards with expired or missing prices
async function getStaleCards(): Promise<CardRef[]> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const stale = await prisma.hucaCard.findMany({
    where: {
      OR: [
        { priceValidUntil: null },
        { priceValidUntil: { lt: tomorrow } },
        { priceUpdatedAt:  null },
      ],
    },
    select: { id: true, slug: true, setCode: true },
  });
  return stale.map(c => ({ hucaId: c.id, slug: c.slug, setCode: c.setCode }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2] ?? 'full'; // 'full' | 'discover' | 'prices' | 'refresh'
  console.log('🦑 Huca Card & Price Scraper');
  console.log(`   Mode: ${mode}`);
  console.log('━'.repeat(50));

  const runStart = Date.now();

  if (mode === 'refresh') {
    // Only re-scrape stale/expired prices — no full discovery needed
    const stale = await getStaleCards();
    console.log(`  ♻️  Stale cards to refresh: ${stale.length}`);
    if (stale.length > 0) await scrapePrices(stale);
  } else {
    // Full or partial run
    const cards = await discoverCards();

    if (mode !== 'discover') {
      await scrapePrices(cards);
    } else {
      // discover-only: upsert HucaCard stubs without price data
      console.log(`\n  💾 Registering ${cards.length} card stubs (no prices)...`);
      for (const { hucaId, slug, setCode } of cards) {
        await prisma.hucaCard.upsert({
          where:  { id: hucaId },
          update: { slug, setCode },
          create: { id: hucaId, setCode, cardNumber: '', nameZh: '', sku: '', slug },
        });
      }
      console.log('  ✅ Stubs registered.');
    }
  }

  // ─── Summary ──────────────────────────────────────────────────
  const [total, withPrice, highLiquidity] = await Promise.all([
    prisma.hucaCard.count(),
    prisma.hucaCard.count({ where: { lowPriceTwd: { not: null } } }),
    prisma.hucaCard.count({ where: { offerCount: { gte: 10 } } }),
  ]);

  const totalMin = ((Date.now() - runStart) / 60000).toFixed(1);
  console.log('\n' + '━'.repeat(50));
  console.log(`🎉 Finished in ${totalMin}min`);
  console.log(`   📦 Total cards in DB : ${total}`);
  console.log(`   💰 Cards with prices : ${withPrice}`);
  console.log(`   🔥 High liquidity (≥10 sales) : ${highLiquidity}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
