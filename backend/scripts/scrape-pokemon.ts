/**
 * 爬取 Pokemon TCG 卡牌資料庫
 * 資料來源: api.pokemontcg.io (免費，無需 API key)
 * 範圍: 2020-01-01 至今
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'https://api.pokemontcg.io/v2';

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json() as Promise<any>;
}

async function getSets() {
  // Get all sets released 2020+
  const sets: any[] = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(`${BASE}/sets?pageSize=250&page=${page}`);
    for (const s of data.data) {
      if (s.releaseDate && s.releaseDate >= '2020-01-01') {
        sets.push(s);
      }
    }
    if (data.page * data.pageSize >= data.totalCount) break;
    page++;
  }
  // Sort by date asc
  sets.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return sets;
}

async function getCardsForSet(setId: string, setName: string) {
  const cards: any[] = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(
      `${BASE}/cards?q=set.id:${setId}&pageSize=250&page=${page}&select=id,name,number,images,rarity,set,hp,types,supertype`
    );
    cards.push(...data.data);
    if (data.page * data.pageSize >= data.totalCount) break;
    page++;
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }
  return cards;
}

async function main() {
  console.log('🔍 Fetching sets from 2020+...');
  const sets = await getSets();
  console.log(`📦 Found ${sets.length} sets`);

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const set of sets) {
    process.stdout.write(`  ${set.releaseDate} | ${set.name} (${set.total} cards)... `);

    try {
      const cards = await getCardsForSet(set.id, set.name);

      let saved = 0;
      for (const card of cards) {
        try {
          await prisma.pokemonCard.upsert({
            where: { id: card.id },
            update: {
              name: card.name,
              imageSmall: card.images?.small ?? '',
              imageLarge: card.images?.large ?? '',
              rarity: card.rarity ?? null,
              setName: card.set?.name ?? set.name,
              setSeries: card.set?.series ?? '',
              setLogo: card.set?.images?.logo ?? null,
              releaseDate: card.set?.releaseDate ?? set.releaseDate,
              hp: card.hp ?? null,
              types: card.types ? JSON.stringify(card.types) : null,
              supertype: card.supertype ?? null,
            },
            create: {
              id: card.id,
              name: card.name,
              number: card.number ?? '',
              imageSmall: card.images?.small ?? '',
              imageLarge: card.images?.large ?? '',
              rarity: card.rarity ?? null,
              setId: set.id,
              setName: card.set?.name ?? set.name,
              setSeries: card.set?.series ?? '',
              setLogo: card.set?.images?.logo ?? null,
              releaseDate: card.set?.releaseDate ?? set.releaseDate,
              hp: card.hp ?? null,
              types: card.types ? JSON.stringify(card.types) : null,
              supertype: card.supertype ?? null,
            },
          });
          saved++;
        } catch {
          totalSkipped++;
        }
      }
      console.log(`✅ ${saved} cards`);
      totalSaved += saved;
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  const total = await prisma.pokemonCard.count();
  console.log(`\n🎉 Done! Saved ${totalSaved} cards (${totalSkipped} skipped)`);
  console.log(`📊 Total in DB: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
