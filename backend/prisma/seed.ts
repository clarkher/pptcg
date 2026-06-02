import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  // Admin / seller account
  const pw = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pptcg.tw' },
    update: { isAdmin: true },
    create: { email: 'admin@pptcg.tw', username: '屁TCG店長', password: pw, wallet: 0, isAdmin: true },
  });

  // Test buyer
  const buyerPw = await bcrypt.hash('buyer1234', 10);
  await prisma.user.upsert({
    where: { email: 'buyer@pptcg.tw' },
    update: {},
    create: { email: 'buyer@pptcg.tw', username: '測試買家', password: buyerPw, wallet: 5000 },
  });

  // Some listings (Yu-Gi-Oh & Pokémon)
  const cards = [
    {
      cardId: 'blue-eyes',
      cardName: '青眼白龍 Blue-Eyes White Dragon',
      cardGame: 'yugioh',
      cardImage: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
      condition: 'NM',
      price: 350,
      description: '日版 一版 卡況極美 幾乎無磨痕',
    },
    {
      cardId: 'dark-magician',
      cardName: '黑魔術師 Dark Magician',
      cardGame: 'yugioh',
      cardImage: 'https://images.ygoprodeck.com/images/cards/46986414.jpg',
      condition: 'LP',
      price: 180,
      description: '英版 輕微角磨 正常遊玩品',
    },
    {
      cardId: 'exodia',
      cardName: '封印の左腕 Exodia Left Arm',
      cardGame: 'yugioh',
      cardImage: 'https://images.ygoprodeck.com/images/cards/07902349.jpg',
      condition: 'NM',
      price: 280,
      description: '日版 絕版 近全新品相',
    },
    {
      cardId: 'charizard-vstar',
      cardName: '噴火龍 VSTAR S12a 中文版',
      cardGame: 'pokemon',
      cardImage: 'https://images.pokemontcg.io/swsh12pt5/18_hires.png',
      condition: 'NM',
      price: 1200,
      description: '中文版 閃卡 未使用 近全新',
    },
    {
      cardId: 'pikachu-promo',
      cardName: '皮卡丘 VMAX 彩虹閃 S4',
      cardGame: 'pokemon',
      cardImage: 'https://images.pokemontcg.io/swsh4/188_hires.png',
      condition: 'LP',
      price: 850,
      description: '日版 輕微角磨 品相良好',
    },
    {
      cardId: 'mewtwo-gx',
      cardName: '超夢 GX SM68 Promo',
      cardGame: 'pokemon',
      cardImage: 'https://images.pokemontcg.io/smp/SM68_hires.png',
      condition: 'NM',
      price: 600,
      description: '英版 宣傳卡 全新未使用',
    },
    {
      cardId: 'blue-eyes-alt',
      cardName: '青眼白龍（另一形態）',
      cardGame: 'yugioh',
      cardImage: 'https://images.ygoprodeck.com/images/cards/23995346.jpg',
      condition: 'MP',
      price: 120,
      description: '中度磨損 可當遊玩用卡',
    },
    {
      cardId: 'umbreon-vmax',
      cardName: '月亮伊布 VMAX 彩虹閃 s6a',
      cardGame: 'pokemon',
      cardImage: 'https://images.pokemontcg.io/swsh6/215_hires.png',
      condition: 'NM',
      price: 2200,
      description: '日版 頂級彩虹閃 全新未使用 強烈推薦收藏',
    },
  ];

  for (const card of cards) {
    const exists = await prisma.listing.findFirst({ where: { cardId: card.cardId, sellerId: admin.id } });
    if (!exists) {
      await prisma.listing.create({
        data: { ...card, sellerId: admin.id, quantity: 1, status: 'active' },
      });
    }
  }

  console.log(`✅ Seeded ${cards.length} listings`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
