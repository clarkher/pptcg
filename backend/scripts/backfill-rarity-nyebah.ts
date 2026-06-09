/**
 * 從「奶爸工作室」(ptcgtw.shop) 回填繁中卡片稀有度。
 * 原理：api_1 搜尋支援伺服器端 rarity 篩選，回傳的圖檔名 /img/ori/{SET}-{NUM}.ext
 *       正好對應我們的 PokemonCard id `zh:{SET}-{NUM}`。
 * 逐一查每個稀有度代碼 → 解出該稀有度的所有卡 id → 回填我們 rarity 為 null 的卡。
 * 用法：DATABASE_URL=<neon> ts-node scripts/backfill-rarity-nyebah.ts [--override]
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API = 'https://ptcgtw.shop/index_function/api/mysqli_api_1.php';
// 奶爸使用的稀有度縮寫（與我們正規化後的代碼一致）
const RARITIES = ['C', 'U', 'R', 'RR', 'RRR', 'PR', 'TR', 'SR', 'HR', 'UR', 'K', 'A', 'AR', 'SAR', 'S', 'SSR', 'ACE', 'BWR', 'MUR', 'MA', 'CHR', 'CSR', 'H', 'PROMO'];

async function fetchRarity(rarity: string): Promise<string[]> {
  const params = new URLSearchParams({
    type: '搜尋全條件2', name_search: '', ability_search: '', combat_search: '',
    text_search: '', set_name: '', card_type: '', p_color: '', rarity, lan: 'tw',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  const ids = new Set<string>();
  for (const m of text.matchAll(/\/img\/ori\/([A-Za-z0-9]+)-([0-9A-Za-z]+)\.[a-z]+/g)) {
    ids.add(`zh:${m[1]}-${m[2]}`);
  }
  return [...ids];
}

async function main() {
  const override = process.argv.includes('--override');
  const idToRarity = new Map<string, string>();
  for (const r of RARITIES) {
    try {
      const ids = await fetchRarity(r);
      for (const id of ids) idToRarity.set(id, r); // 後查覆蓋前查（罕見衝突時取後者）
      console.log(`  rarity ${r}: ${ids.length} cards from 奶爸`);
    } catch (e) {
      console.log(`  rarity ${r}: fetch failed (${(e as Error).message})`);
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  console.log(`total 奶爸 id→rarity entries: ${idToRarity.size}`);

  // 只回填我們 DB 有、且(預設)rarity 為 null 的卡
  const allIds = [...idToRarity.keys()];
  const existing = await prisma.pokemonCard.findMany({
    where: { id: { in: allIds } },
    select: { id: true, rarity: true },
  });
  let updated = 0, skipped = 0;
  for (const card of existing) {
    if (!override && card.rarity) { skipped++; continue; }
    const newR = idToRarity.get(card.id)!;
    if (card.rarity === newR) { skipped++; continue; }
    await prisma.pokemonCard.update({ where: { id: card.id }, data: { rarity: newR } });
    updated++;
  }
  console.log(`matched in DB: ${existing.length} | updated: ${updated} | skipped: ${skipped}`);
}

main().finally(() => prisma.$disconnect());
