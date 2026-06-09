/**
 * 從「奶爸工作室」(ptcgtw.shop) 補滿繁中缺漏的卡（含稀有度＋卡名＋繁中官圖）。
 * 只補有繁中官圖 `/img/ori/{SET}-{NUM}` 的真·繁中卡，跳過英文 placeholder。
 * Phase A: api_1 逐稀有度 → 收集 {id, variant_id, rarity, setCode, number, img}
 * Phase B: 用 DB 既有同套卡推得 seriesKey/seriesName/setName
 * Phase C: 對「我們缺的」卡呼叫 api_2 取繁中卡名 → upsert PokemonCard
 * 用法：DATABASE_URL=<neon> ts-node scripts/scrape-nyebah-fill.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API1 = 'https://ptcgtw.shop/index_function/api/mysqli_api_1.php';
const API2 = 'https://ptcgtw.shop/index_function/api/mysqli_api_2.php';
const RARITIES = ['C', 'U', 'R', 'RR', 'RRR', 'PR', 'TR', 'SR', 'HR', 'UR', 'K', 'A', 'AR', 'SAR', 'S', 'SSR', 'ACE', 'BWR', 'MUR', 'MA', 'CHR', 'CSR'];
const UA = { 'User-Agent': 'Mozilla/5.0' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface NB { id: string; vid: string; rarity: string; code: string; num: string; img: string }

function seriesFromCode(code: string): { key: string; name: string } {
  if (/^M/.test(code)) return { key: 'me', name: '超級進化系列' };
  if (/^SV/i.test(code)) return { key: 'sv', name: '朱&紫系列' };
  return { key: 'swsh', name: '劍＆盾' };
}

async function gatherMissing(): Promise<NB[]> {
  const map = new Map<string, NB>();
  for (const r of RARITIES) {
    const u = `${API1}?type=${encodeURIComponent('搜尋全條件2')}&name_search=&set_name=&card_type=&p_color=&rarity=${r}&lan=tw`;
    const t = await (await fetch(u, { headers: UA })).text();
    const parts = t.split('|');
    for (let i = 1; i < parts.length - 1; i++) {
      if (!/^[0-9]+$/.test(parts[i])) continue;
      const vid = parts[i];
      const url = (parts[i + 1] || '').split('※')[0];
      const m = url.match(/\/img\/ori\/([A-Za-z0-9]+)-([0-9A-Za-z]+)\.[a-z]+/);
      if (m) map.set(`zh:${m[1]}-${m[2]}`, { id: `zh:${m[1]}-${m[2]}`, vid, rarity: r, code: m[1], num: m[2], img: url });
    }
    console.log(`  api_1 rarity ${r}: total mapped ${map.size}`);
    await sleep(150);
  }
  return [...map.values()];
}

async function fetchName(vid: string): Promise<string | null> {
  const u = `${API2}?type=${encodeURIComponent('找圖資料')}&lan=tw&variant_id=${vid}`;
  const t = await (await fetch(u, { headers: UA })).text();
  const s = t.split('|');
  // s[5] = 繁中卡名（依奶爸格式：card_type|color|setCode|num|繁中名|jp|en|img|...）
  const name = (s[5] || '').trim();
  return name || null;
}

async function main() {
  console.log('Phase A: gather 奶爸 繁中 cards...');
  const all = await gatherMissing();

  // 既有卡：以 (setId, 數值號碼) 為鍵去重（忽略補零差異），並記錄每套號碼字串寬度
  const ex = await prisma.pokemonCard.findMany({ where: { language: 'zh' }, select: { setId: true, number: true } });
  const exKey = new Set(ex.map((c) => `${c.setId}:${parseInt(c.number)}`));
  const exWidth = new Map<string, number>();
  for (const c of ex) {
    const w = c.number.length;
    if (!exWidth.has(c.setId) || w > (exWidth.get(c.setId) || 0)) exWidth.set(c.setId, w);
  }
  const numericNum = (s: string) => /^[0-9]+$/.test(s);
  const missing = all.filter((c) => !(numericNum(c.num) && exKey.has(`${c.code}:${parseInt(c.num)}`)));
  console.log(`奶爸 繁中 cards: ${all.length} | already have (numeric match): ${all.length - missing.length} | to add: ${missing.length}`);

  // Phase B: set meta from existing DB cards
  const codes = [...new Set(missing.map((c) => c.code))];
  const setMeta = new Map<string, { seriesKey: string; seriesName: string; setName: string }>();
  for (const code of codes) {
    const sample = await prisma.pokemonCard.findFirst({ where: { language: 'zh', setId: code }, select: { seriesKey: true, seriesName: true, setName: true } });
    if (sample) setMeta.set(code, { seriesKey: sample.seriesKey, seriesName: sample.seriesName, setName: sample.setName });
    else { const s = seriesFromCode(code); setMeta.set(code, { seriesKey: s.key, seriesName: s.name, setName: code }); }
  }

  // 將號碼補零到該套既有寬度（避免與既有卡格式不一致 / 日後重複），預設寬度 3
  const padNum = (code: string, num: string) => (numericNum(num) ? num.padStart(exWidth.get(code) || 3, '0') : num);

  // Phase C: api_2 name + upsert
  console.log('Phase C: fetch names + upsert...');
  let added = 0, failed = 0;
  for (let i = 0; i < missing.length; i++) {
    const c = missing[i];
    try {
      const name = await fetchName(c.vid);
      if (!name) { failed++; continue; }
      const meta = setMeta.get(c.code)!;
      const pnum = padNum(c.code, c.num);
      const id = `zh:${c.code}-${pnum}`;
      await prisma.pokemonCard.upsert({
        where: { id },
        update: { rarity: c.rarity, image: c.img, imageHigh: c.img, name },
        create: {
          id, language: 'zh', setId: c.code, setName: meta.setName,
          seriesKey: meta.seriesKey, seriesName: meta.seriesName,
          number: pnum, name, image: c.img, imageHigh: c.img, rarity: c.rarity,
        },
      });
      added++;
      if (added % 200 === 0) console.log(`  added ${added}/${missing.length}`);
    } catch {
      failed++;
    }
    await sleep(180);
  }
  console.log(`done. added/updated: ${added} | failed: ${failed}`);
}

main().finally(() => prisma.$disconnect());
