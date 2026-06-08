import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const RARITIES: { code: string; label: string; color: string; sortOrder: number }[] = [
  { code: 'C', label: '普通 Common', color: '#94a3b8', sortOrder: 10 },
  { code: 'U', label: '罕見 Uncommon', color: '#0891b2', sortOrder: 20 },
  { code: 'R', label: '稀有 Rare', color: '#16a34a', sortOrder: 30 },
  { code: 'RR', label: 'Double Rare', color: '#2563eb', sortOrder: 40 },
  { code: 'AR', label: 'Art Rare', color: '#db2777', sortOrder: 50 },
  { code: 'SR', label: 'Super Rare', color: '#9333ea', sortOrder: 60 },
  { code: 'SAR', label: 'Special Art Rare', color: '#db2777', sortOrder: 70 },
  { code: 'UR', label: 'Ultra Rare', color: '#f59e0b', sortOrder: 80 },
];

const CONDITIONS: { code: string; label: string; sortOrder: number }[] = [
  { code: 'NM', label: '近完美 NM', sortOrder: 10 },
  { code: 'LP', label: '輕微磨損 LP', sortOrder: 20 },
  { code: 'MP', label: '中度磨損 MP', sortOrder: 30 },
  { code: 'HP', label: '重度磨損 HP', sortOrder: 40 },
];

async function main() {
  for (const r of RARITIES) {
    await prisma.rarity.upsert({ where: { code: r.code }, update: {}, create: r });
  }
  const usedRarities = await prisma.pokemonCard.findMany({
    where: { rarity: { not: null } },
    distinct: ['rarity'],
    select: { rarity: true },
  });
  let order = 100;
  for (const { rarity } of usedRarities) {
    if (!rarity) continue;
    await prisma.rarity.upsert({
      where: { code: rarity },
      update: {},
      create: { code: rarity, label: rarity, color: '#64748b', sortOrder: order++ },
    });
  }

  for (const c of CONDITIONS) {
    await prisma.condition.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  const seriesRows = await prisma.pokemonCard.groupBy({
    by: ['language', 'seriesKey', 'seriesName'],
    _count: { id: true },
  });
  let sOrder = 0;
  for (const s of seriesRows) {
    await prisma.series.upsert({
      where: { language_key: { language: s.language, key: s.seriesKey } },
      update: { name: s.seriesName },
      create: { language: s.language, key: s.seriesKey, name: s.seriesName, sortOrder: sOrder++ },
    });
  }

  console.log('refdata seeded');
}

main().finally(() => prisma.$disconnect());
