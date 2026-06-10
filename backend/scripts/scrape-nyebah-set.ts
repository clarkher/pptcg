/**
 * 從「奶爸工作室」補指定套系的卡（含 imagehub 實卡圖的新卡，如 M5 高稀有度）。
 * 與 scrape-nyebah-fill.ts 差異：不限 /img/ori/ 官圖 —— 用 api_2 的 setCode+號數 對應，
 * 圖採 api_1 回傳的第一張（官圖或奶爸 imagehub 實卡圖皆可）。
 * 用法：DATABASE_URL=<neon> ts-node scripts/scrape-nyebah-set.ts M5 [M4 ...]
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API1 = 'https://ptcgtw.shop/index_function/api/mysqli_api_1.php';
const API2 = 'https://ptcgtw.shop/index_function/api/mysqli_api_2.php';
const RARITIES = ['C', 'U', 'R', 'RR', 'RRR', 'PR', 'TR', 'SR', 'HR', 'UR', 'K', 'A', 'AR', 'SAR', 'S', 'SSR', 'ACE', 'BWR', 'MUR', 'MA'];
const UA = { 'User-Agent': 'Mozilla/5.0' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api1BySetRarity(set: string, rarity: string): Promise<{ vid: string; img: string }[]> {
  const params = new URLSearchParams({
    type: '搜尋全條件2', name_search: '', ability_search: '', combat_search: '',
    text_search: '', set_name: set, card_type: '', p_color: '', rarity, lan: 'tw',
  });
  const t = await (await fetch(`${API1}?${params}`, { headers: UA })).text();
  const parts = t.split('|');
  const out: { vid: string; img: string }[] = [];
  for (let i = 1; i < parts.length - 1; i++) {
    if (!/^[0-9]+$/.test(parts[i])) continue;
    const img = (parts[i + 1] || '').split('※')[0];
    if (/^https?:\/\//.test(img)) out.push({ vid: parts[i], img });
  }
  return out;
}

async function api2Detail(vid: string): Promise<{ setCode: string; num: string; name: string } | null> {
  const t = await (await fetch(`${API2}?type=${encodeURIComponent('找圖資料')}&lan=tw&variant_id=${vid}`, { headers: UA })).text();
  const s = t.split('|');
  const setCode = (s[3] || '').trim();
  const num = (s[4] || '').trim().split('/')[0];
  const name = (s[5] || '').trim();
  if (!setCode || !num || !name) return null;
  return { setCode, num, name };
}

async function fillSet(set: string) {
  console.log(`=== ${set} ===`);
  const ex = await prisma.pokemonCard.findMany({ where: { language: 'zh', setId: set }, select: { number: true, rarity: true, seriesKey: true, seriesName: true, setName: true } });
  const exNums = new Map(ex.filter((c) => /^[0-9]+$/.test(c.number)).map((c) => [parseInt(c.number), c]));
  const width = ex.reduce((w, c) => Math.max(w, c.number.length), 3);
  const meta = ex[0] ?? null;

  let added = 0, updated = 0, skipped = 0;
  for (const r of RARITIES) {
    const rows = await api1BySetRarity(set, r);
    await sleep(150);
    for (const row of rows) {
      const d = await api2Detail(row.vid);
      await sleep(150);
      if (!d || d.setCode !== set || !/^[0-9]+$/.test(d.num)) { skipped++; continue; }
      const n = parseInt(d.num);
      const pnum = String(n).padStart(width, '0');
      const id = `zh:${set}-${pnum}`;
      const existing = exNums.get(n);
      if (existing) {
        // 已有此卡：只在 rarity 缺漏時補
        if (!existing.rarity) {
          await prisma.pokemonCard.update({ where: { id }, data: { rarity: r } }).catch(() => null);
          updated++;
        } else skipped++;
        continue;
      }
      await prisma.pokemonCard.create({
        data: {
          id, language: 'zh', setId: set,
          setName: meta?.setName ?? set,
          seriesKey: meta?.seriesKey ?? (set.startsWith('M') ? 'me' : 'sv'),
          seriesName: meta?.seriesName ?? (set.startsWith('M') ? '超級進化系列' : '朱&紫系列'),
          number: pnum, name: d.name, image: row.img, imageHigh: row.img, rarity: r,
        },
      }).catch(() => { skipped++; return null; });
      exNums.set(n, { number: pnum, rarity: r, seriesKey: '', seriesName: '', setName: '' });
      added++;
      console.log(`  + ${id} ${d.name} (${r})`);
    }
  }
  console.log(`${set} done: added ${added}, rarity-updated ${updated}, skipped ${skipped}`);
}

async function main() {
  const sets = process.argv.slice(2).filter((s) => /^[A-Za-z0-9-]+$/.test(s));
  if (!sets.length) { console.error('usage: ts-node scripts/scrape-nyebah-set.ts <SET> [SET...]'); process.exit(1); }
  for (const s of sets) await fillSet(s);
}

main().finally(() => prisma.$disconnect());
