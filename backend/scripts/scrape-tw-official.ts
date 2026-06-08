/**
 * 爬取「官方繁中訓練家網站」超級進化(Mega Evolution)系列卡片 → upsert PokemonCard
 *
 * 背景：tcgdex 繁中只到 SV10，缺整個超級進化系列，故改爬官方站。
 * 來源：https://asia.pokemon-card.com/tw/card-search/
 *   - 列表頁：/list/?expansionCodes={CODE}&pageNo={N}（HTML 內含 detail 連結，每頁 20 張）
 *   - 稀有度過濾：同 URL 加 &rarity[]={id}（官方詳情頁不顯示稀有度，只能靠此反查）
 *   - 詳情頁：/detail/{numericId}/（務必尾斜線）→ <title>卡名</title>、.collectorNumber「001/063」
 *   - 卡圖：https://asia.pokemon-card.com/tw/card-img/tw{8碼補零id}.png
 *
 * id 維持既有慣例 zh:{setId}-{number}（setId=expansion code，number=收錄編號），與 tcgdex 繁中相容。
 *
 * 用法：
 *   DATABASE_URL=<neon> npx ts-node scripts/scrape-tw-official.ts            # 全部 Mega，先爬→快取→寫 DB
 *   DATABASE_URL=<neon> npx ts-node scripts/scrape-tw-official.ts --only=M1S # 只跑一套（驗證）
 *   DATABASE_URL=<neon> npx ts-node scripts/scrape-tw-official.ts --refresh  # 忽略快取，重爬官方站
 *   DATABASE_URL=<neon> npx ts-node scripts/scrape-tw-official.ts --no-scrape# 只用既有快取寫 DB（跑第二個 DB 時用，禮貌不重爬）
 */
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const SITE = 'https://asia.pokemon-card.com';
const BASE = `${SITE}/tw/card-search`;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DELAY = 150; // ms，禮貌爬：每請求間隔
const MAX_PAGES = 30; // 單一 expansion×rarity 的分頁上限保險
const CACHE_FILE = path.join(__dirname, '.cache', 'mega-cards.json');

const SERIES_KEY = 'me';
const SERIES_NAME = '超級進化系列';

// 超級進化 expansion（code、顯示名、發售日）。發售日為已知/最佳估計，僅供套系排序，
// 列表 orderBy releaseDate desc → 越新越前。M1S/M1L 確認 2025-08-15（台灣）。
const MEGA_SETS: { code: string; name: string; date: string }[] = [
  { code: 'M5', name: '擴充包「深淵之瞳」', date: '2026-03-20' },
  { code: 'M4', name: '擴充包「忍者飛旋」', date: '2026-02-20' },
  { code: 'MJ', name: 'New Trainer Journey', date: '2026-01-16' },
  { code: 'M3', name: '擴充包「虛無歸零」', date: '2025-12-19' },
  { code: 'MC', name: '初階牌組 100對戰收藏', date: '2025-12-05' },
  { code: 'M2a', name: '高級擴充包「超級進化夢想ex」', date: '2025-11-21' },
  { code: 'M2', name: '擴充包「烈獄狂火X」', date: '2025-10-24' },
  { code: 'MBG', name: '挑戰牌組「超級耿鬼ex」', date: '2025-09-27' },
  { code: 'MBD', name: '挑戰牌組「超級蒂安希ex」', date: '2025-09-26' },
  { code: 'M1L', name: '擴充包「超級勇氣」', date: '2025-08-15' },
  { code: 'M1S', name: '擴充包「超級交響樂」', date: '2025-08-15' },
  { code: 'M-P', name: '特典卡 超級進化', date: '2025-08-15' },
];

// 官方稀有度過濾 id → 縮寫（與 seed-refdata RARITY_MAP code 對齊）。11=無標記 → null。
const RARITY_BY_ID: Record<number, string | null> = {
  1: 'C', 2: 'U', 3: 'R', 4: 'RR', 5: 'RRR', 6: 'PR', 7: 'TR', 8: 'SR',
  9: 'HR', 10: 'UR', 11: null, 12: 'K', 13: 'A', 14: 'AR', 15: 'SAR',
  16: 'S', 17: 'SSR', 18: 'ACE', 19: 'BWR', 20: 'MUR', 21: 'MA',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err: any) {
      if (attempt === retries) throw new Error(`fetch failed ${url}: ${err.message}`);
      await sleep(DELAY * 4 * attempt); // 退避重試
    }
  }
  throw new Error('unreachable');
}

// 取某 expansion（可選 rarity 過濾）所有詳情頁 numericId。分頁直到沒有新 id。
async function collectDetailIds(code: string, rarityId?: number): Promise<number[]> {
  const seen: number[] = [];
  const set = new Set<number>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let url = `${BASE}/list/?expansionCodes=${encodeURIComponent(code)}`;
    if (rarityId) url += `&rarity%5B%5D=${rarityId}`;
    url += `&pageNo=${page}`;
    const html = await fetchHtml(url);
    const ids = [...html.matchAll(/\/tw\/card-search\/detail\/(\d+)/g)].map((m) => Number(m[1]));
    const fresh = ids.filter((id) => !set.has(id));
    if (fresh.length === 0) break; // 沒有新卡 → 到底
    fresh.forEach((id) => { set.add(id); seen.push(id); });
    await sleep(DELAY);
  }
  return seen;
}

type ParsedCard = {
  id: string; cid: number; setId: string; setName: string; releaseDate: string;
  number: string; name: string; image: string; setLogo: string | null; rarity: string | null;
};

// id 慣例 zh:{setId}-{number}；但部分套系（MC/M2a/M-P 等多牌組商品）同一收錄編號會對應多張
// 不同卡（不同卡圖），編號非唯一 → 對「該套系內編號重複者」附加詳情頁唯一 id 去重，
// 一般套系維持乾淨 id。純依資料判定，不依迭代順序，故重跑結果穩定。
function assignIds(cards: ParsedCard[]): ParsedCard[] {
  const count = new Map<string, number>();
  for (const c of cards) {
    const key = `${c.setId}|${c.number}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  for (const c of cards) {
    const dup = (count.get(`${c.setId}|${c.number}`) ?? 0) > 1;
    c.id = dup ? `zh:${c.setId}-${c.number}-${c.cid}` : `zh:${c.setId}-${c.number}`;
  }
  return cards;
}

async function parseDetail(
  cid: number, set: { code: string; name: string; date: string }, rarity: string | null,
): Promise<ParsedCard | null> {
  const html = await fetchHtml(`${BASE}/detail/${cid}/`);
  const $ = cheerio.load(html);

  const name = $('title').first().text().replace(/\s*\|\s*訓練家網站\s*$/, '').trim();
  const collector = $('.collectorNumber').first().text().trim(); // 例 "001/063" 或 "012/M-P"
  const number = (collector.split('/')[0] || '').trim();
  if (!name || !number) return null; // 解析失敗 → 跳過（呼叫端記錄）

  const markSrc = $('.expansionSymbol img').first().attr('src') || null;
  const setLogo = markSrc ? (markSrc.startsWith('http') ? markSrc : `${SITE}${markSrc}`) : null;
  const image = `${SITE}/tw/card-img/tw${String(cid).padStart(8, '0')}.png`;

  return {
    id: `zh:${set.code}-${number}`, // 暫定，最終由 assignIds 統一指派
    cid, setId: set.code, setName: set.name, releaseDate: set.date,
    number, name, image, setLogo, rarity,
  };
}

async function scrapeSet(set: { code: string; name: string; date: string }): Promise<ParsedCard[]> {
  process.stdout.write(`\n📦 ${set.code} ${set.name}\n`);

  // 1) 反查每張卡稀有度（官方詳情頁不含稀有度，只能逐稀有度過濾列表）
  const rarityByDetailId = new Map<number, string | null>();
  for (const [idStr, label] of Object.entries(RARITY_BY_ID)) {
    const rid = Number(idStr);
    const ids = await collectDetailIds(set.code, rid);
    if (ids.length) {
      ids.forEach((id) => rarityByDetailId.set(id, label));
      process.stdout.write(`   rarity ${label ?? '無標記'}: ${ids.length}\n`);
    }
    await sleep(DELAY);
  }

  // 2) 完整卡清單（不過濾），稀有度取上面反查、查無則 null
  const allIds = await collectDetailIds(set.code);
  process.stdout.write(`   → ${allIds.length} cards total，逐張解析詳情…\n`);

  // 3) 逐張詳情頁解析
  const cards: ParsedCard[] = [];
  let failed = 0;
  for (const cid of allIds) {
    try {
      const card = await parseDetail(cid, set, rarityByDetailId.get(cid) ?? null);
      if (card) cards.push(card); else failed++;
    } catch (err: any) {
      failed++;
      process.stdout.write(`   ⚠️  detail ${cid} 失敗: ${err.message}\n`);
    }
    await sleep(DELAY);
  }
  process.stdout.write(`   ✅ 解析 ${cards.length} 張${failed ? `（${failed} 失敗/跳過）` : ''}\n`);
  return cards;
}

async function scrapeAll(only?: string): Promise<ParsedCard[]> {
  const sets = only ? MEGA_SETS.filter((s) => s.code === only) : MEGA_SETS;
  if (only && sets.length === 0) throw new Error(`未知 expansion code: ${only}`);
  const out: ParsedCard[] = [];
  for (const set of sets) out.push(...(await scrapeSet(set)));
  return out;
}

async function upsertCards(cards: ParsedCard[]) {
  // 本腳本完整掌管超級進化系列：先清掉「本次寫入的套系」既有列（避免改 id 規則後殘留孤兒列），
  // 再整批 create。只刪本次出現的 setId，--only 時不動其他套系。
  const setIds = [...new Set(cards.map((c) => c.setId))];
  const del = await prisma.pokemonCard.deleteMany({
    where: { language: 'zh', seriesKey: SERIES_KEY, setId: { in: setIds } },
  });
  if (del.count) console.log(`   清除既有 ${del.count} 列（套系 ${setIds.join(',')}）`);

  const result = await prisma.pokemonCard.createMany({
    data: cards.map((c) => ({
      id: c.id, language: 'zh', setId: c.setId, setName: c.setName,
      seriesKey: SERIES_KEY, seriesName: SERIES_NAME, setLogo: c.setLogo,
      releaseDate: c.releaseDate, number: c.number, name: c.name,
      image: c.image, imageHigh: c.image, rarity: c.rarity,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  const noScrape = args.includes('--no-scrape');
  const refresh = args.includes('--refresh');

  let cards: ParsedCard[];
  if (noScrape || (!refresh && fs.existsSync(CACHE_FILE))) {
    cards = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    // 舊快取可能無 cid，從卡圖 tw{8碼}.png 還原
    for (const c of cards) {
      if (c.cid == null) c.cid = Number(c.image.match(/tw0*(\d+)\.png/)?.[1] ?? 0);
    }
    if (only) cards = cards.filter((c) => c.setId === only);
    console.log(`📂 使用快取 ${CACHE_FILE}（${cards.length} 張）`);
  } else {
    cards = await scrapeAll(only);
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cards, null, 2));
    console.log(`\n💾 已快取 ${cards.length} 張 → ${CACHE_FILE}`);
  }

  assignIds(cards); // 指派最終唯一 id（重複編號者附加詳情 id）

  console.log(`\n⬆️  寫入 DB（${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? '?'}）…`);
  const saved = await upsertCards(cards);

  // 摘要
  const bySet = new Map<string, number>();
  const byRarity = new Map<string, number>();
  for (const c of cards) {
    bySet.set(c.setId, (bySet.get(c.setId) ?? 0) + 1);
    const r = c.rarity ?? '(無)';
    byRarity.set(r, (byRarity.get(r) ?? 0) + 1);
  }
  console.log(`\n🎉 upsert ${saved} 張 Mega 卡`);
  console.log('   套系:', [...bySet.entries()].map(([k, v]) => `${k}=${v}`).join(' '));
  console.log('   稀有度:', [...byRarity.entries()].map(([k, v]) => `${k}=${v}`).join(' '));
  const total = await prisma.pokemonCard.count({ where: { seriesKey: SERIES_KEY, language: 'zh' } });
  console.log(`   DB 內 ${SERIES_NAME} 共 ${total} 張`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
