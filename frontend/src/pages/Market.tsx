import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import type { Listing, Game } from '../types';
import { CardItem } from '../components/CardItem';
import { CardSkeleton } from '../components/LoadingSpinner';

const TABS: { label: string; value: Game; emoji: string }[] = [
  { label: '全部', value: 'all', emoji: '🃏' },
  { label: '遊戲王', value: 'yugioh', emoji: '⚔️' },
  { label: '寶可夢', value: 'pokemon', emoji: '⚡' },
];

export function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [game, setGame] = useState<Game>((searchParams.get('game') as Game) || 'all');
  const [q, setQ] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: { game?: string; q?: string } = {};
      if (game !== 'all') params.game = game;
      if (q.trim()) params.q = q.trim();
      setListings(await listingsApi.getAll(params));
    } finally {
      setLoading(false);
    }
  }, [game, q]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleTab = (g: Game) => {
    setGame(g);
    setSearchParams(g !== 'all' ? { game: g } : {});
  };

  return (
    <div className="pb-28 page-enter">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-black tracking-tight text-white mb-4">卡牌市場</h1>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none"
            stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋卡牌名稱..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
            style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'inherit' }}
            onFocus={(e) => (e.target.style.border = '1px solid rgba(167,139,250,0.5)')}
            onBlur={(e) => (e.target.style.border = '1px solid rgba(255,255,255,0.07)')}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const active = game === tab.value;
            return (
              <button key={tab.value} onClick={() => handleTab(tab.value)}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={active
                  ? { background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', border: '1px solid transparent' }
                  : { background: '#111124', color: '#64748B', border: '1px solid rgba(255,255,255,0.06)' }}>
                {tab.emoji} {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4">
        {!loading && (
          <p className="text-xs text-slate-600 mb-3 font-medium">
            共 {listings.length} 件商品
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4 opacity-30">🔍</div>
            <p className="text-slate-400 font-semibold">找不到相符商品</p>
            <p className="text-slate-600 text-sm mt-1">換個關鍵字試試看</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {listings.map((l) => <CardItem key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
