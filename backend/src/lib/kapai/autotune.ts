import { prisma } from '../prisma';
import { computeAutotune, type AutotuneAction } from './logic';
import { loadConfig, saveConfig } from './config';
import { notify } from './notifier';

const ACTION_ZH: Record<AutotuneAction, string> = {
  loosen: '放寬門檻一步',
  tighten: '收緊門檻一步',
  hold: '維持不變',
};

/** 盤點報告文字（純組字串）。 */
export function buildAutotuneReport(
  total: number,
  listingCnt: number,
  surgeCnt: number,
  action: AutotuneAction,
  s: { priceSurgeRatio: number; volSurgeRatio: number; discountThreshold: number; minProfit: number }
): string {
  return (
    `📊 卡報報每日盤點\n` +
    `過去24h通知 ${total} 則（新掛單${listingCnt}／跳漲${surgeCnt}）\n` +
    `動作：${ACTION_ZH[action]}\n` +
    `跳漲軌現值：漲價×${s.priceSurgeRatio} 熱度×${s.volSurgeRatio} 折扣${Math.round(s.discountThreshold * 100)}% 省≥${s.minProfit}`
  );
}

/**
 * 每日盤點：數過去 24h 兩軌通知，<low 放寬 / >high 收緊跳漲軌門檻，並推 Telegram 盤點報告。
 * 由 cron 每天台灣 00:00 觸發。autotune.enabled 關閉則跳過（仍不推報告）。
 */
export async function runDailyAutotune(): Promise<{ count: number; action: AutotuneAction | 'disabled' }> {
  const cfg = await loadConfig();
  if (!cfg.autotune.enabled) return { count: 0, action: 'disabled' };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total, surgeCnt] = await Promise.all([
    prisma.arbitrageAlert.count({ where: { pushedAt: { gte: since } } }),
    prisma.arbitrageAlert.count({ where: { pushedAt: { gte: since }, source: 'surge' } }),
  ]);

  const { action, next } = computeAutotune(cfg.surge, total, cfg.autotune.lowThreshold, cfg.autotune.highThreshold);
  if (action !== 'hold') {
    await saveConfig({ ...cfg, surge: next });
  }
  await notify(buildAutotuneReport(total, total - surgeCnt, surgeCnt, action, next));
  return { count: total, action };
}
