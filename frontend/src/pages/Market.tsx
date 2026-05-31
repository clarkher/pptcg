import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import type { Listing, Game } from '../types';
import { CardItem } from '../components/CardItem';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/LoadingSpinner';

const GAME_TABS: { label: string; value: Game }[] = [
  { label: '全部', value: 'all' },
  { label: '遊戲王', value: 'yugioh' },
  { label: '寶可夢', value: 'pokemon' },
];

export function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGame = (searchParams.get('game') as Game) || 'all';
  const [game, setGame] = useState<Game>(initialGame);
  const [q, setQ] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params: { game?: string; q?: string } = {};
      if (game !== 'all') params.game = game;
      if (q.trim()) params.q = q.trim();
      const data = await listingsApi.getAll(params);
      setListings(data);
    } finally {
      setLoading(false);
    }
  }, [game, q]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleGameChange = (g: Game) => {
    setGame(g);
    if (g !== 'all') setSearchParams({ game: g });
    else setSearchParams({});
  };

  return (
    <div className="pb-24">
      <Header title="卡牌市場" />

      <div className="px-4 pt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋卡牌名稱..."
            className="w-full bg-[#16213E] border border-[#0F3460] rounded-xl pl-9 pr-4 py-3 text-slate-100 focus:outline-none focus:border-violet-500 transition-colors text-sm"
          />
        </div>

        {/* Game filter tabs */}
        <div className="flex gap-2">
          {GAME_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleGameChange(tab.value)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                game === tab.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#16213E] text-slate-400 border border-[#0F3460]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-slate-500">找到 {listings.length} 件商品</p>
        )}

        {/* Grid */}
        {loading ? (
          <LoadingSpinner />
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <p>找不到相關商品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listings.map((listing) => (
              <CardItem key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
