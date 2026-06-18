// kapaipai API 連線設定。正式機 Railway-新加坡 IP 被 kapaipai 封 → 改走 Cloudflare Worker 代理。
// KAPAI_API_BASE 未設 → 直連（本機/台灣 IP 可直連）；設了代理網址 → 另帶 KAPAI_PROXY_SECRET 當 Bearer。
const DEFAULT_BASE = 'https://trade.kapaipai.tw/api';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** kapaipai API base（含 /api）。可由 KAPAI_API_BASE 覆寫成代理網址。 */
export function kapaiBase(): string {
  return process.env.KAPAI_API_BASE || DEFAULT_BASE;
}

/** 打 kapaipai 用的 headers：UA + 走代理時附上 Bearer 金鑰。 */
export function kapaiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': UA };
  const secret = process.env.KAPAI_PROXY_SECRET;
  if (secret) h.Authorization = `Bearer ${secret}`;
  return h;
}
