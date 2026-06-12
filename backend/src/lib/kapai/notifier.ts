import { prisma } from '../prisma';
import { linePush } from '../../controllers/line';

interface AlertListing {
  id: number; game: string; name: string; packName: string; cardKey: string;
  condition: string; price: number; sellerId: number; sellerNickname: string; sellerArea: string;
}

async function setting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

function buildText(listing: AlertListing, baselineMedian: number): string {
  const langMap: Record<string, string> = { pkmjp: '日文', pkmen: '英文', pkmtw: '繁中' };
  const lang = langMap[listing.game] ?? listing.game;
  // 基準來源：日英=Huca 裸卡成交價、繁中=卡拍拍站內 perfect 行情
  const src = listing.game === 'pkmtw' ? '站內行情' : 'Huca成交價';
  return (
    `🚨 套利雷達\n\n${listing.name}\n套系：${listing.packName}\n番號：${listing.cardKey}｜語言：${lang}\n\n` +
    `💰 售價 NT$${listing.price}（${src} NT$${baselineMedian}）\n📉 省 NT$${baselineMedian - listing.price}\n` +
    `賣家：${listing.sellerNickname}（${listing.sellerArea}）\n\n` +
    `https://trade.kapaipai.tw/shop/${listing.sellerId}/${listing.id}`
  );
}

/** Telegram 推播到設定的群組/頻道（免費、無配額）。 */
export async function pushTelegram(text: string): Promise<boolean> {
  const token = await setting('TELEGRAM_BOT_TOKEN');
  const chatId = await setting('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 推一筆套利機會：Telegram（群組，免費無配額）＋ LINE（綁定用戶）並行。 */
export async function pushArbitrage(listing: AlertListing, baselineMedian: number): Promise<void> {
  const text = buildText(listing, baselineMedian);

  // Telegram — 主力（免費無配額）
  await pushTelegram(text);

  // LINE — 綁定用戶（有月配額）
  const lineToken = await setting('LINE_CHANNEL_ACCESS_TOKEN');
  if (lineToken) {
    const users = await prisma.user.findMany({ where: { lineUid: { not: null } }, select: { lineUid: true } });
    for (const u of users) {
      if (u.lineUid) await linePush(u.lineUid, [{ type: 'text', text }], lineToken);
    }
  }
}
