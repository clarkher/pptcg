import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import type { Listing, Game } from '../types';
import { CardGrid } from '../components/CardGrid';
import { SEOHead } from '../components/SEOHead';

const TABS: { label: string; value: Game; emoji: string; color: string }[] = [
  { label: '全部', value: 'all', emoji: '🃏', color: '#A78BFA' },
  { label: '遊戲王', value: 'yugioh', emoji: '⚔️', color: '#FBBF24' },
  { label: '寶可夢', value: 'pokemon', emoji: '⚡', color: '#F472B6' },
];

export function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [game, setGame] = useState<Game>((searchParams.get('game') as Game) || 'all');
  const [q, setQ] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (game !== 'all') p.game = game;
      if (q.trim()) p.q = q.trim();
      setListings(await listingsApi.getAll(p));
    } finally { setLoading(false); }
  }, [game, q]);

  useEffect(() => { load(); }, [load]);

  const gameTitleMap: Record<string, string> = {
    all: '所有卡牌',
    pokemon: '寶可夢卡牌',
    yugioh: '遊戲王卡牌',
  };
  const gameTitle = gameTitleMap[game] || '所有卡牌';
  const marketDesc = `在屁TCG 瀏覽${gameTitle}交易市場。${q ? `搜尋「${q}」相關` : ''}閃卡、稀有卡、二手卡安全買賣，快速成交。`;

  return (
    <div style={{ paddingBottom: 100 }} className="page-enter">
      <SEOHead
        title={q ? `「${q}」搜尋結果 - ${gameTitle}市場` : `${gameTitle}市場`}
        description={marketDesc}
        canonical="/market"
      />

      {/* Header */}
      <div style={{ padding: '52px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 3, height: 24, borderRadius: 2, background: 'linear-gradient(to bottom, #A78BFA, #6D28D9)' }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>卡牌市場</h1>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <svg style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, color: '#6B7280',
          }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜尋卡牌名稱..."
            style={{
              width: '100%', paddingLeft: 44, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
              borderRadius: 16, fontSize: 14, color: '#F1F5F9', outline: 'none',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              fontFamily: 'inherit', boxSizing: 'border-box',
              backdropFilter: 'blur(12px)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.45)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
          />
        </div>

        {/* Game tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {TABS.map(tab => {
            const active = game === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setGame(tab.value);
                  setSearchParams(tab.value !== 'all' ? { game: tab.value } : {});
                }}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 14, fontSize: 12, fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                  background: active
                    ? 'linear-gradient(135deg,#7C3AED,#4F46E5)'
                    : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : '#64748B',
                  outline: active ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: active ? '0 0 20px rgba(124,58,237,0.4)' : 'none',
                }}
              >
                {tab.emoji} {tab.label}
              </button>
            );
          })}
        </div>

        {!loading && (
          <p style={{ fontSize: 11, color: '#475569', marginBottom: 14, fontWeight: 600, letterSpacing: 0.3 }}>
            共 {listings.length} 件商品
          </p>
        )}
      </div>

      {/* Grid */}
      <div style={{ padding: '0 16px' }}>
        <CardGrid listings={listings} loading={loading}
          emptyText="找不到相符商品" emptySubText="換個關鍵字試試看" emptyIcon="🔍" />
      </div>
    </div>
  );
}
