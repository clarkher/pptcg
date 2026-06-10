/**
 * 一次性資料修正：購物體驗/庫存改版後，庫存唯一真實來源改為 Listing.quantity。
 * 舊模型下「任何成交都把整筆標 sold、但 quantity 不變」，因此既有 status='sold'
 * 的列可能仍帶著正數 quantity。本腳本把它們歸 0，避免日後（例如舊單退款）被
 * releaseStock 以錯誤數量復活。
 *
 * 對 staging 與 prod 兩個 Neon 各跑一次：
 *   DATABASE_URL=<該庫 url> npx ts-node scripts/fix-sold-listing-quantity.ts
 * 冪等，可重複執行。
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const r = await prisma.listing.updateMany({
    where: { status: 'sold', quantity: { gt: 0 } },
    data: { quantity: 0 },
  });
  console.log(`✔ 已將 ${r.count} 筆 sold listing 的 quantity 歸 0`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
