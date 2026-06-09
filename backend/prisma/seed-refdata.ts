import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// tcgdex 原始稀有度字串（含 ja/zh 大小寫差異）→ 縮寫 / 中文 / 顏色 / 階級排序
// 多個原始值可映射到同一縮寫（如 Rare/Rare Holo→R）。'None' 視為 null。
const RARITY_MAP: { raw: string[]; code: string; label: string; color: string; sortOrder: number }[] = [
  { raw: ['Common'], code: 'C', label: '普通', color: '#9ca3af', sortOrder: 10 },
  { raw: ['Uncommon'], code: 'U', label: '非普通', color: '#6b7280', sortOrder: 20 },
  { raw: ['Rare'], code: 'R', label: '稀有', color: '#16a34a', sortOrder: 30 },
  { raw: ['Rare Holo', 'Holo Rare'], code: 'R', label: '稀有', color: '#16a34a', sortOrder: 30 },
  { raw: ['Promo'], code: 'PR', label: 'Promo 促銷', color: '#0ea5e9', sortOrder: 35 },
  { raw: ['Radiant Rare'], code: 'K', label: '輝耀', color: '#f59e0b', sortOrder: 40 },
  { raw: ['Amazing Rare'], code: 'A', label: '驚奇', color: '#06b6d4', sortOrder: 42 },
  { raw: ['Double Rare', 'Double rare'], code: 'RR', label: '雙稀有', color: '#2563eb', sortOrder: 50 },
  { raw: ['Rare Holo V'], code: 'V', label: 'V', color: '#2563eb', sortOrder: 52 },
  { raw: ['Rare Holo VMAX'], code: 'VMAX', label: 'VMAX', color: '#1d4ed8', sortOrder: 54 },
  { raw: ['Rare Holo VSTAR'], code: 'VSTAR', label: 'VSTAR', color: '#1d4ed8', sortOrder: 56 },
  { raw: ['ACE SPEC Rare'], code: 'ACE', label: 'ACE SPEC', color: '#dc2626', sortOrder: 58 },
  { raw: ['Trainer Gallery Rare Holo'], code: 'TG', label: '訓練家畫廊', color: '#7c3aed', sortOrder: 60 },
  { raw: ['Classic Collection'], code: 'CLF', label: '經典收藏', color: '#a16207', sortOrder: 62 },
  { raw: ['Black White Rare'], code: 'BWR', label: '黑白稀有', color: '#111827', sortOrder: 64 },
  { raw: ['Illustration Rare', 'Illustration rare'], code: 'AR', label: '異圖', color: '#db2777', sortOrder: 70 },
  { raw: ['Rare Ultra', 'Ultra Rare'], code: 'SR', label: '超稀有', color: '#9333ea', sortOrder: 72 },
  { raw: ['Shiny Rare', 'Rare Shiny'], code: 'S', label: '色違', color: '#22d3ee', sortOrder: 74 },
  { raw: ['MEGA_ATTACK_RARE'], code: 'MAR', label: '超級異攻', color: '#ea580c', sortOrder: 78 },
  { raw: ['Special Illustration Rare', 'Special illustration rare'], code: 'SAR', label: '特殊異圖', color: '#e11d48', sortOrder: 80 },
  { raw: ['Shiny Ultra Rare'], code: 'SSR', label: '色違超稀有', color: '#c026d3', sortOrder: 82 },
  { raw: ['Hyper Rare'], code: 'UR', label: '金卡', color: '#f59e0b', sortOrder: 90 },
  { raw: ['Rare Rainbow'], code: 'HR', label: '彩虹稀有', color: '#fb7185', sortOrder: 92 },
  { raw: ['Rare Secret'], code: 'UR', label: '金卡', color: '#f59e0b', sortOrder: 90 },
  { raw: ['Mega Hyper Rare'], code: 'UR', label: '金卡', color: '#f59e0b', sortOrder: 90 },
  // 官方繁中訓練家網站（超級進化系列）稀有度縮寫，本身已是縮寫故 raw=code（只建參照列、不轉換）
  { raw: ['RRR'], code: 'RRR', label: '三重稀有', color: '#1d4ed8', sortOrder: 51 },
  { raw: ['TR'], code: 'TR', label: '訓練家稀有', color: '#7c3aed', sortOrder: 61 },
  { raw: ['MA'], code: 'MA', label: '超級異攻', color: '#ea580c', sortOrder: 79 },
  { raw: ['MUR'], code: 'MUR', label: '超級金卡', color: '#f59e0b', sortOrder: 94 },
];

// 中文品相分級
const CONDITIONS: { code: string; label: string; sortOrder: number }[] = [
  { code: '全新', label: '全新（未拆/抽出即套）', sortOrder: 10 },
  { code: '近全新', label: '近全新', sortOrder: 20 },
  { code: '輕微磨損', label: '輕微磨損', sortOrder: 30 },
  { code: '中度磨損', label: '中度磨損', sortOrder: 40 },
  { code: '重度磨損', label: '重度磨損', sortOrder: 50 },
];

async function main() {
  // 1. 正規化目錄稀有度：tcgdex 原始字串 → 縮寫
  for (const m of RARITY_MAP) {
    for (const raw of m.raw) {
      if (raw === m.code) continue;
      const r = await prisma.pokemonCard.updateMany({ where: { rarity: raw }, data: { rarity: m.code } });
      if (r.count) console.log(`  rarity '${raw}' → '${m.code}': ${r.count} cards`);
    }
  }
  // 'None' → null
  const none = await prisma.pokemonCard.updateMany({ where: { rarity: 'None' }, data: { rarity: null } });
  if (none.count) console.log(`  rarity 'None' → null: ${none.count} cards`);

  // 2. 重建 Rarity 參照表（dedupe by code）
  const seen = new Set<string>();
  for (const m of RARITY_MAP) {
    if (seen.has(m.code)) continue;
    seen.add(m.code);
    await prisma.rarity.upsert({
      where: { code: m.code },
      update: { label: m.label, color: m.color, sortOrder: m.sortOrder },
      create: { code: m.code, label: m.label, color: m.color, sortOrder: m.sortOrder },
    });
  }
  // 移除舊的全名/雜項 Rarity 列（保留正規化後的縮寫）
  const validCodes = [...seen];
  const removed = await prisma.rarity.deleteMany({ where: { code: { notIn: validCodes } } });
  if (removed.count) console.log(`  removed ${removed.count} legacy rarity rows`);

  // 3. 中文品相：清掉舊的英文縮寫，建中文分級
  await prisma.condition.deleteMany({ where: { code: { notIn: CONDITIONS.map((c) => c.code) } } });
  for (const c of CONDITIONS) {
    await prisma.condition.upsert({ where: { code: c.code }, update: { label: c.label, sortOrder: c.sortOrder }, create: c });
  }

  // 4. 系列：從目錄 distinct (language, seriesKey, seriesName) 匯入
  const seriesRows = await prisma.pokemonCard.groupBy({ by: ['language', 'seriesKey', 'seriesName'], _count: { id: true } });
  let sOrder = 0;
  for (const s of seriesRows) {
    await prisma.series.upsert({
      where: { language_key: { language: s.language, key: s.seriesKey } },
      update: { name: s.seriesName },
      create: { language: s.language, key: s.seriesKey, name: s.seriesName, sortOrder: sOrder++ },
    });
  }

  console.log('refdata seeded (rarity normalized + 中文 conditions)');
}

main().finally(() => prisma.$disconnect());
