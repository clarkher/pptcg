// kapaipai 反向代理：正式機 Railway-新加坡 IP 被 kapaipai 擋，改由此 Worker（Cloudflare egress）轉打。
// 只轉發 GET /api/* 到 trade.kapaipai.tw，需 Bearer PROXY_SECRET，非開放代理。
const TARGET_ORIGIN = 'https://trade.kapaipai.tw';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 無需授權的健康檢查（不碰 kapaipai）
    if (url.pathname === '/_ping') {
      return new Response('pong', { status: 200 });
    }

    if (!env.PROXY_SECRET || request.headers.get('Authorization') !== `Bearer ${env.PROXY_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 僅允許轉發 kapaipai API 路徑，避免變成開放代理
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    const target = TARGET_ORIGIN + url.pathname + url.search;
    let upstream;
    try {
      upstream = await fetch(target, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'upstream fetch failed', detail: String(e) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};
