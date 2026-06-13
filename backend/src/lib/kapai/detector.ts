import { prisma } from '../prisma';
import { isDeal } from './logic';
import { fetchPerfectMarket } from './market';
import { getRawPrice } from './huca-raw';
import { buildText, pushTelegram } from './notifier';
import { loadConfig, type KapaiParams } from './config';

const PKM_GAMES = new Set(['pkmtw', 'pkmjp', 'pkmen']);
const CONCURRENCY = 10; // 並行打卡拍拍/Huca 行情（實測 10 路零失敗、未被擋）

type Listing = Awaited<ReturnType<typeof prisma.kapaiListing.findMany>>[number];

/** 找對應 Huca 卡 id：setCode 相同 + cardNumber 數字對齊（去前導零）。同 setCode 結果快取一輪。 */
const hucaSetCache = new Map<string, { id: number; cardNumber: string }[]>();
async function findHucaCardId(setCode: string, cardNumber: string): Promise<number | null> {
  const num = parseInt(cardNumber, 10);
  if (Number.isNaN(num)) return null;
  let cards = hucaSetCache.get(setCode);
  if (!cards) {
    cards = await prisma.hucaCard.findMany({ where: { setCode }, select: { id: true, cardNumber: true } });
    hucaSetCache.set(setCode, cards);
  }
  return cards.find((c) => parseInt(c.cardNumber, 10) === num)?.id ?? null;
}

/** 評估單筆 listing 是否套利；命中且尚未推過 → 建 alert + 即時推 Telegram，回 true。 */
async function evaluate(l: Listing, params: KapaiParams): Promise<boolean> {
  if (!PKM_GAMES.has(l.game) || l.condition !== 'perfect') return false;

  // 站內 perfect 行情（排除這筆自身）—— siteMin 是共同硬條件
  const market = await fetchPerfectMarket(l.game, l.setCode, l.cardNumber, l.id);

  // 行情基準：日英走 Huca 成交、繁中走站內中位
  let baseline: number | null = null;
  if (l.game === 'pkmjp' || l.game === 'pkmen') {
    const hucaId = await findHucaCardId(l.setCode, l.cardNumber);
    if (hucaId) {
      const raw = await getRawPrice(hucaId);
      if (raw) baseline = raw.rawPriceTwd;
    }
  } else if (market && market.count >= params.minSamples) {
    baseline = market.median;
  }

  if (baseline == null || !isDeal({ price: l.price, baseline, siteMin: market?.siteMin ?? null }, params)) {
    return false;
  }
  // 去重：同一 listing 推過就不再推（行情變動造成的新撿漏才會是新 listingId）
  const existing = await prisma.arbitrageAlert.findUnique({ where: { listingId: l.id } });
  if (existing) return false;
  await prisma.arbitrageAlert.create({
    data: {
      listingId: l.id, cardKey: l.cardKey, game: l.game,
      price: l.price, baseline,
      discount: l.price / baseline, profit: baseline - l.price,
      notified: false,
    },
  });
  // Telegram：偵測到即時全推（免費無配額）。LINE 仍由 pusher 批次處理。
  await pushTelegram(buildText(l, baseline));
  return true;
}

/**
 * 全量重偵測（並行）：對本輪爬到的所有在架 perfect 商品重算行情，
 * 既有掛單因行情變動變成的撿漏也抓得到（去重靠 ArbitrageAlert.listingId 不重推）。
 * - 日英(pkmjp/pkmen)：基準 = Huca 裸卡成交價；繁中(pkmtw)：站內 perfect 中位
 * - 共同：必須比站內現有 perfect 最低更便宜
 * 同卡行情走 market 快取（30 分）避免暴打 API。
 */
export async function detectAndAlert(): Promise<{ detected: number }> {
  const { params } = await loadConfig();
  hucaSetCache.clear();
  const pending = await prisma.kapaiListing.findMany({ where: { processed: false } });
  let detected = 0;
  let idx = 0;
  async function worker() {
    while (idx < pending.length) {
      const l = pending[idx++];
      try {
        if (await evaluate(l, params)) detected++;
      } catch {
        // 單筆失敗不影響整輪
      }
      await prisma.kapaiListing.update({ where: { id: l.id }, data: { processed: true } });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { detected };
}
