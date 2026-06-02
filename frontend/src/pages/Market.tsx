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

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '52px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 16 }}>卡牌市場</h1>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, color: '#64748B' }} fill="none" stroke="currentColor"
            strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋卡牌名稱..."
            style={{
              width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
              borderRadius: 14, fontSize: 14, color: '#F1F5F9', outline: 'none',
              background: '#111124', border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Game tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {TABS.map(tab => {
            const active = game === tab.value;
            return (
              <button key={tab.value} onClick={() => {
                setGame(tab.value);
                setSearchParams(tab.value !== 'all' ? { game: tab.value } : {});
              }} style={{
                flex: 1, padding: '8px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                background: active ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : '#111124',
                color: active ? '#fff' : '#64748B',
                outline: active ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>
                {tab.emoji} {tab.label}
              </button>
            );
          })}
        </div>

        {!loading && (
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 12, fontWeight: 500 }}>
            共 {listings.length} 件商品
          </p>
        )}
      </div>

      {/* Grid */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0,1,2,3,4,5].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 12 }}>🔍</div>
            <p style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>找不到相符商品</p>
            <p style={{ color: '#475569', fontSize: 13 }}>換個關鍵字試試看</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {listings.map(l => <CardItem key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
