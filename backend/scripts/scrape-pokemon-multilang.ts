/**
 * 多語言 Pokemon TCG 爬蟲
 * EN: pokemontcg.io (2020+)
 * JA: api.tcgdex.net/v2/ja (2020+)
 * ZH: api.tcgdex.net/v2/zh-tw (現有中文版)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Series key mapping ───────────────────────────────────────
// Normalize series name to a short key for grouping
function seriesKeyOf(series: string): string {
  const s = series.toLowerCase();
  if (s.includes('scarlet') || s.includes('violet') || s.includes('スカーレット') || s.includes('朱') || s.includes('sv')) return 'sv';
  if (s.includes('sword') || s.includes('shield') || s.includes('ソード') || s.includes('シールド') || s.includes('swsh') || s.includes('劍')) return 'swsh';
  if (s.includes('sun') || s.includes('moon') || s.includes('サン') || s.includes('ムーン') || s.includes('太陽') || s.includes('月亮') || s.includes('sm')) return 'sm';
  if (s.includes('black') || s.includes('white') || s.includes('xy') || s.includes('bw')) return 'bw';
  return s.replace(/[^a-z0-9]/g, '').slice(0, 8);
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'pptcg-scraper/1.0' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}

// ─── ENGLISH: pokemontcg.io ──────────────────────────────────
async function scrapeEnglish() {
  console.log('\n🇬🇧 Scraping English cards (pokemontcg.io)...');

  // Get all sets from 2020+
  const sets: any[] = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(`https://api.pokemontcg.io/v2/sets?pageSize=250&page=${page}`);
    if (!data) break;
    for (const s of data.data) {
      if (s.releaseDate && s.releaseDate >= '2020-01-01') sets.push(s);
    }
    if (data.page * data.pageSize >= data.totalCount) break;
    page++;
  }
  sets.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  console.log(`  Found ${sets.length} EN sets from 2020+`);

  let total = 0;
  for (const set of sets) {
    process.stdout.write(`  ${set.releaseDate} | ${set.name}... `);
    const key = seriesKeyOf(set.series || '');
    let cards: any[] = [];
    let p = 1;
    while (true) {
      const data = await fetchJson(`https://api.pokemontcg.io/v2/cards?q=set.id:${set.id}&pageSize=250&page=${p}`);
      if (!data?.data?.length) break;
      cards.push(...data.data);
      if (data.page * data.pageSize >= data.totalCount) break;
      p++;
      await new Promise(r => setTimeout(r, 80));
    }

    let saved = 0;
    for (const card of cards) {
      await prisma.pokemonCard.upsert({
        where: { id: `en:${card.id}` },
        update: {
          name: card.name, image: card.images?.large || card.images?.small || '',
          imageHigh: card.images?.large || null, rarity: card.rarity || null,
          hp: card.hp || null, types: card.types ? JSON.stringify(card.types) : null,
          supertype: card.supertype || null,
        },
        create: {
          id: `en:${card.id}`, language: 'en',
          setId: set.id, setName: set.name,
          seriesKey: key, seriesName: set.series || set.name,
          setLogo: set.images?.logo || null,
          releaseDate: set.releaseDate,
          number: card.number || '',
          name: card.name,
          image: card.images?.large || card.images?.small || '',
          imageHigh: card.images?.large || null,
          rarity: card.rarity || null,
          hp: card.hp || null,
          types: card.types ? JSON.stringify(card.types) : null,
          supertype: card.supertype || null,
        },
      });
      saved++;
    }
    console.log(`✅ ${saved}`);
    total += saved;
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`  🇬🇧 Total EN: ${total}`);
}

// ─── JAPANESE: api.tcgdex.net ────────────────────────────────
async function scrapeJapanese() {
  console.log('\n🇯🇵 Scraping Japanese cards (TCGdex)...');

  const setsData = await fetchJson('https://api.tcgdex.net/v2/ja/sets');
  if (!setsData || !Array.isArray(setsData)) { console.log('  Failed to fetch JA sets'); return; }

  // Filter to modern sets (2020+) by checking common modern prefixes
  const modernPrefixes = ['S', 'SV', 'V', 'SM10', 'SM11', 'SM12'];
  const sets = setsData.filter(s => {
    const id = s.id || '';
    return modernPrefixes.some(p => id.startsWith(p)) ||
      (s.releaseDate && s.releaseDate >= '2020-01-01');
  });
  console.log(`  Found ${sets.length} JA modern sets`);

  let total = 0;
  for (const set of sets) {
    const setDetail = await fetchJson(`https://api.tcgdex.net/v2/ja/sets/${set.id}`);
    if (!setDetail) continue;

    const cards = setDetail.cards || [];
    if (!cards.length) continue;

    const key = seriesKeyOf(set.id + ' ' + (set.name || ''));
    const seriesName = set.id.startsWith('SV') ? 'スカーレット＆バイオレット' :
                       set.id.startsWith('S') ? 'ソード＆シールド' : set.name || '';

    process.stdout.write(`  ${set.id} | ${set.name}... `);

    let saved = 0;
    for (const cardRef of cards) {
      const cardId = cardRef.id || `${set.id}-${cardRef.localId}`;
      const cardDetail = await fetchJson(`https://api.tcgdex.net/v2/ja/cards/${cardId}`);
      if (!cardDetail?.name) { continue; }

      const imageBase = cardDetail.image ? `${cardDetail.image}/high.jpg` : '';
      const imageLow = cardDetail.image ? `${cardDetail.image}/low.jpg` : '';

      await prisma.pokemonCard.upsert({
        where: { id: `ja:${cardId}` },
        update: { name: cardDetail.name, image: imageBase || imageLow, imageHigh: imageBase || null,
          rarity: cardDetail.rarity || null, hp: cardDetail.hp ? String(cardDetail.hp) : null,
          types: cardDetail.types ? JSON.stringify(cardDetail.types) : null,
          supertype: cardDetail.supertype || null,
        },
        create: {
          id: `ja:${cardId}`, language: 'ja',
          setId: set.id, setName: set.name || set.id,
          seriesKey: key, seriesName,
          setLogo: set.logo || null,
          releaseDate: set.releaseDate || null,
          number: cardRef.localId || cardDetail.localId || '',
          name: cardDetail.name,
          image: imageBase || imageLow,
          imageHigh: imageBase || null,
          rarity: cardDetail.rarity || null,
          hp: cardDetail.hp ? String(cardDetail.hp) : null,
          types: cardDetail.types ? JSON.stringify(cardDetail.types) : null,
          supertype: cardDetail.supertype || null,
        },
      });
      saved++;
      await new Promise(r => setTimeout(r, 30));
    }
    console.log(`✅ ${saved}`);
    total += saved;
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`  🇯🇵 Total JA: ${total}`);
}

// ─── TRADITIONAL CHINESE: api.tcgdex.net ─────────────────────
async function scrapeChinese() {
  console.log('\n🇹🇼 Scraping Traditional Chinese cards (TCGdex)...');

  const setsData = await fetchJson('https://api.tcgdex.net/v2/zh-tw/sets');
  if (!setsData || !Array.isArray(setsData)) { console.log('  Failed'); return; }

  const sets = [...new Map(setsData.map(s => [s.id, s])).values()];
  console.log(`  Found ${sets.length} unique ZH-TW sets`);

  let total = 0;
  for (const set of sets) {
    const setDetail = await fetchJson(`https://api.tcgdex.net/v2/zh-tw/sets/${set.id}`);
    if (!setDetail) continue;

    const cards = setDetail.cards || [];
    if (!cards.length) continue;

    const key = seriesKeyOf(set.id + ' ' + (set.name || '') + ' ' + (setDetail.serie?.name || ''));
    const seriesName = setDetail.serie?.name || set.name || '';

    process.stdout.write(`  ${set.id} | ${set.name}... `);

    let saved = 0;
    for (const cardRef of cards) {
      const cardId = cardRef.id || `${set.id}-${cardRef.localId}`;
      const cardDetail = await fetchJson(`https://api.tcgdex.net/v2/zh-tw/cards/${cardId}`);
      if (!cardDetail?.name) continue;

      const imageBase = cardDetail.image ? `${cardDetail.image}/high.jpg` : '';
      const imageLow = cardDetail.image ? `${cardDetail.image}/low.jpg` : '';

      await prisma.pokemonCard.upsert({
        where: { id: `zh:${cardId}` },
        update: { name: cardDetail.name, image: imageBase || imageLow,
          rarity: cardDetail.rarity || null, hp: cardDetail.hp ? String(cardDetail.hp) : null },
        create: {
          id: `zh:${cardId}`, language: 'zh',
          setId: set.id, setName: set.name || set.id,
          seriesKey: key, seriesName,
          setLogo: set.logo || null,
          releaseDate: setDetail.releaseDate || null,
          number: cardRef.localId || '',
          name: cardDetail.name,
          image: imageBase || imageLow,
          imageHigh: imageBase || null,
          rarity: cardDetail.rarity || null,
          hp: cardDetail.hp ? String(cardDetail.hp) : null,
          types: cardDetail.types ? JSON.stringify(cardDetail.types) : null,
        },
      });
      saved++;
      await new Promise(r => setTimeout(r, 30));
    }
    console.log(`✅ ${saved}`);
    total += saved;
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`  🇹🇼 Total ZH: ${total}`);
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('🚀 PPTCG Pokemon Card Multi-Language Scraper');
  console.log('━'.repeat(50));

  const start = Date.now();

  await scrapeEnglish();
  await scrapeJapanese();
  await scrapeChinese();

  const [en, ja, zh, total] = await Promise.all([
    prisma.pokemonCard.count({ where: { language: 'en' } }),
    prisma.pokemonCard.count({ where: { language: 'ja' } }),
    prisma.pokemonCard.count({ where: { language: 'zh' } }),
    prisma.pokemonCard.count(),
  ]);

  const mins = ((Date.now() - start) / 60000).toFixed(1);
  console.log('\n' + '━'.repeat(50));
  console.log(`🎉 Done in ${mins}min!`);
  console.log(`   🇬🇧 EN: ${en} | 🇯🇵 JA: ${ja} | 🇹🇼 ZH: ${zh}`);
  console.log(`   📊 Total: ${total} cards`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
