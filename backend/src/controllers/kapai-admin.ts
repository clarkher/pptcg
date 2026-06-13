import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { scanArbitrage } from '../lib/kapai/scan';
import { pushTelegram } from '../lib/kapai/notifier';
import { loadConfig, saveConfig, type KapaiConfig } from '../lib/kapai/config';

const APP_ENV = () => process.env.APP_ENV ?? 'production';

/** 取得卡報報引擎設定 + 環境（前端據 env 決定唯讀） */
export async function adminGetKapaiConfig(_req: AuthRequest, res: Response) {
  res.json({ env: APP_ENV(), config: await loadConfig() });
}

/** 更新卡報報引擎設定（測試機唯讀，後端層也擋） */
export async function adminPutKapaiConfig(req: AuthRequest, res: Response) {
  if (APP_ENV() === 'staging') {
    res.status(403).json({ error: '測試機唯讀，實際請在正式機設定' });
    return;
  }
  const b = req.body;
  if (!b || !Array.isArray(b.scrapeWindows) || b.scrapeWindows.length === 0) {
    res.status(400).json({ error: '至少要有一個爬取時段' }); return;
  }
  for (const w of b.scrapeWindows) {
    if (typeof w.startHour !== 'number' || w.startHour < 0 || w.startHour > 23) {
      res.status(400).json({ error: '時段起始時必須是 0–23' }); return;
    }
    for (const g of ['pkmtw', 'pkmjp', 'pkmen'] as const) {
      if (typeof w[g] !== 'number' || w[g] < 0) {
        res.status(400).json({ error: `爬取量必須是 ≥ 0 的數字（${g}）` }); return;
      }
    }
  }
  const saved = await saveConfig(b as KapaiConfig);
  res.json({ env: APP_ENV(), config: saved });
}

/** 用已填的 TELEGRAM_BOT_TOKEN 自動抓最近對話的 chat_id 存起來，並發測試訊息 */
export async function adminTelegramSetup(_req: AuthRequest, res: Response) {
  const tokenRow = await prisma.setting.findUnique({ where: { key: 'TELEGRAM_BOT_TOKEN' } });
  if (!tokenRow?.value) { res.status(400).json({ error: '請先填入並儲存 TELEGRAM_BOT_TOKEN' }); return; }
  const token = tokenRow.value;
  let j: any;
  try {
    j = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json();
  } catch (e: any) {
    res.status(502).json({ error: `連 Telegram 失敗：${e?.message ?? e}` }); return;
  }
  if (!j?.ok) { res.status(400).json({ error: `Telegram API：${j?.description ?? 'token 可能錯誤'}` }); return; }
  const updates: any[] = j.result ?? [];
  const chat = updates
    .map((u) => u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat)
    .filter(Boolean)
    .pop();
  if (!chat) {
    res.status(400).json({ error: '抓不到對話。請先在「已加入 bot 的群組」或私訊 bot 發一則訊息，再點一次。' });
    return;
  }
  await prisma.setting.upsert({
    where: { key: 'TELEGRAM_CHAT_ID' },
    update: { value: String(chat.id) },
    create: { key: 'TELEGRAM_CHAT_ID', value: String(chat.id) },
  });
  const ok = await pushTelegram('✅ 卡報報 Telegram 連線成功！之後套利機會會推到這裡。');
  res.json({ ok, chatId: chat.id, chatName: chat.title ?? chat.username ?? chat.first_name ?? '' });
}

/** 立即掃描當前卡拍拍套利機會（不推、不存，純檢視） */
export async function adminKapaiScan(_req: AuthRequest, res: Response) {
  try {
    const result = await scanArbitrage();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: `掃描失敗：${e?.message ?? e}` });
  }
}

/** Huca 行情純檢視（分頁/搜尋/篩選/排序 + 統計） */
export async function adminHucaCards(req: AuthRequest, res: Response) {
  const { q = '', setCode = '', hasPrice = 'true', sort = 'offers', page = '1', limit = '50' } =
    req.query as Record<string, string>;
  const where: any = {};
  if (setCode) where.setCode = setCode;
  if (hasPrice === 'true') where.lowPriceTwd = { not: null };
  if (q.trim()) where.OR = [
    { nameZh: { contains: q.trim(), mode: 'insensitive' } },
    { sku: { contains: q.trim(), mode: 'insensitive' } },
  ];
  const orderBy: any =
    sort === 'price' ? { lowPriceTwd: 'asc' } :
    sort === 'offers' ? { offerCount: 'desc' } : { priceUpdatedAt: 'desc' };
  const take = parseInt(limit, 10); const skip = (parseInt(page, 10) - 1) * take;
  const [cards, total, withPrice, highLiq] = await Promise.all([
    prisma.hucaCard.findMany({ where, orderBy, take, skip }),
    prisma.hucaCard.count({ where }),
    prisma.hucaCard.count({ where: { lowPriceTwd: { not: null } } }),
    prisma.hucaCard.count({ where: { offerCount: { gte: 10 } } }),
  ]);
  res.json({ cards, total, withPrice, highLiq, page: parseInt(page, 10), pages: Math.ceil(total / take) });
}
