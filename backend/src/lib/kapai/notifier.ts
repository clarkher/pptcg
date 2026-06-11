import { prisma } from '../prisma';
import { linePush } from '../../controllers/line';

interface AlertListing {
  id: number; game: string; name: string; packName: string; cardKey: string;
  condition: string; price: number; sellerId: number; sellerNickname: string; sellerArea: string;
}

/** 推播一筆套利機會給已綁定 LINE 的用戶 */
export async function pushArbitrage(listing: AlertListing, baselineMedian: number): Promise<void> {
  const token = await prisma.setting.findUnique({ where: { key: 'LINE_CHANNEL_ACCESS_TOKEN' } });
  if (!token?.value) return;
  // MVP：全推給所有綁定用戶。
  // 之後分流：join NotifyPreference，用 logic.matchesPreference(
  //   { game: listing.game, price: listing.price, baseline: baselineMedian }, pref) 過濾。
  const users = await prisma.user.findMany({
    where: { lineUid: { not: null } },
    select: { lineUid: true },
  });
  const langMap: Record<string, string> = { pkmjp: '日文', pkmen: '英文', pkmtw: '繁中' };
  const lang = langMap[listing.game] ?? listing.game;
  const text =
    `🚨 套利雷達\n\n${listing.name}\n套系：${listing.packName}\n番號：${listing.cardKey}｜語言：${lang}｜品相：${listing.condition}\n\n` +
    `💰 售價 NT$${listing.price}（台灣行情 NT$${baselineMedian}）\n📉 省 NT$${baselineMedian - listing.price}\n` +
    `賣家：${listing.sellerNickname}（${listing.sellerArea}）\n\n` +
    `https://trade.kapaipai.tw/shop/${listing.sellerId}/${listing.id}`;
  for (const u of users) {
    if (u.lineUid) await linePush(u.lineUid, [{ type: 'text', text }], token.value);
  }
}
