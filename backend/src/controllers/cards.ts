import { Request, Response } from 'express';
import axios from 'axios';

export async function searchYugioh(req: Request, res: Response) {
  const { name } = req.query;
  try {
    const url = name
      ? `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name as string)}&num=20&offset=0`
      : `https://db.ygoprodeck.com/api/v7/cardinfo.php?num=20&offset=0&sort=name`;
    const { data } = await axios.get(url);
    const cards = (data.data || []).map((c: any) => ({
      id: String(c.id),
      name: c.name,
      game: 'yugioh',
      image: c.card_images[0]?.image_url_small,
      type: c.type,
      desc: c.desc,
    }));
    res.json(cards);
  } catch {
    res.status(500).json({ error: '查詢遊戲王卡牌失敗' });
  }
}

export async function searchPokemon(req: Request, res: Response) {
  const { name } = req.query;
  try {
    const query = name ? `name:${name}*` : 'supertype:Pokémon';
    const { data } = await axios.get(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=20`
    );
    const cards = (data.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      game: 'pokemon',
      image: c.images?.small,
      type: c.supertype,
      desc: c.flavorText || (c.rules || []).join(' ') || '',
      set: c.set?.name,
    }));
    res.json(cards);
  } catch {
    res.status(500).json({ error: '查詢寶可夢卡牌失敗' });
  }
}
