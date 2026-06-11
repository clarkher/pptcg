import { prisma } from '../prisma';

// 從 Huca 背後的 Snkrdunk 在售明細，算「純裸卡」市價（排除 PSA/BGS 鑑定卡）
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const JPY_TWD = 0.21;        // 日圓→台幣近期匯率
const RAW_GRADE_KEY = '18';  // Snkrdunk chart 裸卡主品相 grade key（22=PSA10/23=PSA9）
const RECENT_DAYS = 30;      // 取近 N 天成交

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * snkrdunk_id → 純裸卡「成交」市價（TWD 中位數）。
 * 用 get_snkrdunk_chart.php 的成交走勢（非在售掛單），key 18=裸卡。
 * 回 null 表近期無裸卡成交紀錄（如聖灰那種零成交、只有人亂掛單的卡）。
 */
export async function fetchRawPrice(snkrdunkId: number): Promise<{ rawPriceTwd: number; sampleCount: number } | null> {
  const res = await fetch(`https://huca.tw/api/get_snkrdunk_chart.php?snkrdunk_id=${snkrdunkId}&mode=all`, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const json: any = await res.json();
  const series: [number, number][] = json?.[RAW_GRADE_KEY] ?? [];
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent = series.filter(([ts]) => ts >= cutoff).map(([, p]) => p).filter((p) => typeof p === 'number' && p > 0);
  if (recent.length < 3) return null; // 近期裸卡成交不足 → 無可靠市價（擋掉零成交的亂掛卡）
  return { rawPriceTwd: Math.round(median(recent) * JPY_TWD), sampleCount: recent.length };
}

/** 取卡的 snkrdunk_id（DB 沒存就從 Huca API 抓並回填）。 */
export async function getSnkrdunkId(hucaCardId: number): Promise<number | null> {
  const card = await prisma.hucaCard.findUnique({ where: { id: hucaCardId }, select: { snkrdunkId: true } });
  if (card?.snkrdunkId) return card.snkrdunkId;
  const res = await fetch(`https://huca.tw/api/get_card_details.php?id=${hucaCardId}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const json: any = await res.json();
  const sidRaw = json?.card?.snkrdunk_id;
  const sid = sidRaw != null ? parseInt(String(sidRaw), 10) : NaN;
  if (Number.isNaN(sid)) return null;
  await prisma.hucaCard.update({ where: { id: hucaCardId }, data: { snkrdunkId: sid } }).catch(() => {});
  return sid;
}

/** 更新單卡裸卡市價（抓 + 存 DB）。回 null 表無法取得。 */
export async function updateRawPrice(hucaCardId: number): Promise<{ rawPriceTwd: number; sampleCount: number } | null> {
  const sid = await getSnkrdunkId(hucaCardId);
  if (!sid) return null;
  const r = await fetchRawPrice(sid);
  if (!r) return null;
  await prisma.hucaCard.update({
    where: { id: hucaCardId },
    data: { rawPriceTwd: r.rawPriceTwd, rawSampleCount: r.sampleCount, rawUpdatedAt: new Date() },
  });
  return r;
}

/** 取得卡的裸卡市價：DB 有且 24h 內新鮮則用 DB，否則即時抓並存。 */
export async function getRawPrice(hucaCardId: number): Promise<{ rawPriceTwd: number; sampleCount: number } | null> {
  const card = await prisma.hucaCard.findUnique({
    where: { id: hucaCardId },
    select: { rawPriceTwd: true, rawSampleCount: true, rawUpdatedAt: true },
  });
  const fresh = card?.rawUpdatedAt && Date.now() - card.rawUpdatedAt.getTime() < 24 * 60 * 60 * 1000;
  if (fresh && card?.rawPriceTwd != null && card?.rawSampleCount != null) {
    return { rawPriceTwd: card.rawPriceTwd, sampleCount: card.rawSampleCount };
  }
  return updateRawPrice(hucaCardId);
}
