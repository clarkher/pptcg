import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { wishlistApi } from '../api/wishlist';
import { useAuthStore } from '../stores/authStore';
import type { CatalogCard as CatalogCardType, RarityDef } from '../types/catalog';
import { SeriesSetNav } from '../components/SeriesSetNav';
import { CatalogCard } from '../components/CatalogCard';
import { SEOHead } from '../components/SEOHead';

export function Browse() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const [language, setLanguage] = useState('zh');
  const [seriesKey, setSeriesKey] = useState('');
  const [setId, setSetId] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [inStock, setInStock] = useState(false);
  const [cards, setCards] = useState<CatalogCardType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rarities, setRarities] = useState<RarityDef[]>([]);

  useEffect(() => { catalogApi.rarities().then(setRarities).catch(() => setRarities([])); }, []);

  const rarityColor = useMemo(() => {
    const map = new Map(rarities.map((r) => [r.code, r.color]));
    return (code: string | null) => (code && map.get(code)) || '#64748b';
  }, [rarities]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [language, seriesKey, setId, debouncedQ, inStock]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalogApi.cards({ language, seriesKey, setId, q: debouncedQ, inStock, sort: 'price', page, limit: 24 });
      setCards((prev) => (page === 1 ? res.cards : [...prev, ...res.cards]));
      setTotal(res.total);
    } finally { setLoading(false); }
  }, [language, seriesKey, setId, debouncedQ, inStock, page]);

  useEffect(() => { load(); }, [load]);

  const handleWish = async (card: CatalogCardType) => {
    if (!token) { navigate('/login'); return; }
    try {
      await wishlistApi.add(card.id);
      setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, wishlistCount: c.wishlistCount + 1 } : c));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ paddingBottom: 100 }} className="page-enter">
      <SEOHead title="卡牌目錄" description="依系列、套系瀏覽寶可夢卡牌，查看即時價格與庫存。" canonical="/market" />

      <div style={{ padding: '52px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 3, height: 24, borderRadius: 2, background: 'linear-gradient(to bottom,#A78BFA,#6D28D9)' }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>卡牌目錄</h1>
        </div>

        <SeriesSetNav
          language={language} onLanguage={setLanguage}
          seriesKey={seriesKey} onSeries={setSeriesKey}
          setId={setId} onSet={setSetId}
        />

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋卡名 / 卡號..."
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 14, fontSize: 14, color: '#F1F5F9',
                outline: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => setInStock((v) => !v)}
            style={{
              padding: '10px 14px', borderRadius: 14, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: 'none', whiteSpace: 'nowrap',
              background: inStock ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
              color: inStock ? '#34D399' : '#94A3B8',
              outline: inStock ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(255,255,255,0.07)',
            }}>
            {inStock ? '☑' : '☐'} 只看有庫存
          </button>
        </div>

        {!loading && <p style={{ fontSize: 11, color: '#475569', marginBottom: 14, fontWeight: 600 }}>共 {total} 張卡（價格低→高）</p>}
      </div>

      {/* Grid */}
      <div style={{ padding: '0 16px' }}>
        {loading && page === 1 ? (
          <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>載入中...</p>
        ) : cards.length === 0 ? (
          <p style={{ color: '#64748B', textAlign: 'center', padding: 40 }}>🔍 找不到相符卡片</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {cards.map((card) => (
              <CatalogCard
                key={card.id} card={card} rarityColor={rarityColor}
                onClick={() => navigate(`/card/${encodeURIComponent(card.id)}`)}
                onWish={() => handleWish(card)}
              />
            ))}
          </div>
        )}

        {cards.length < total && !loading && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => setPage((p) => p + 1)}
              style={{ padding: '10px 24px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#A78BFA' }}>
              載入更多
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
