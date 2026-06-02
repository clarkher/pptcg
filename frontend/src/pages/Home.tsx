import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import type { Listing } from '../types';
import { CardItem } from '../components/CardItem';
import { CardSkeleton } from '../components/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.getAll().then(setListings).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 12px' }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
          屁<span style={{ color: '#A78BFA' }}>TCG</span>
        </span>
        {user ? (
          <button onClick={() => navigate('/profile')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)',
            color: '#A78BFA' }}>
            💰 NT${user.wallet.toLocaleString()}
          </button>
        ) : (
          <button onClick={() => navigate('/login')} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            color: '#fff', cursor: 'pointer', border: 'none',
            background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
            登入
          </button>
        )}
      </div>

      {/* Banner */}
      <div style={{ margin: '0 16px', borderRadius: 20, overflow: 'hidden', position: 'relative',
        height: 148, background: 'linear-gradient(135deg,#1E1040 0%,#2A1060 55%,#160B35 100%)' }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 160, height: 160,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.55) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: 120, height: 120,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
            color: 'rgba(196,181,253,0.65)', marginBottom: 6 }}>台灣最屁的卡牌交易平台</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 14 }}>
            買你想要的每一張卡
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/market?game=yugioh')} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: '#EAB308' }}>
              ⚔️ 遊戲王
            </button>
            <button onClick={() => navigate('/market?game=pokemon')} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171' }}>
              ⚡ 寶可夢
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 16px 0' }}>
        {[
          { icon: '🛒', label: '瀏覽市場', sub: '找你要的卡', path: '/market', color: 'rgba(124,58,237,0.15)' },
          { icon: '📋', label: '我的訂單', sub: '購買記錄', path: '/orders', color: 'rgba(16,185,129,0.12)' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
            background: '#111124', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
            textAlign: 'left' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18, background: item.color, flexShrink: 0 }}>
              {item.icon}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>{item.label}</p>
              <p style={{ fontSize: 11, color: '#64748B' }}>{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Listings */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>最新上架</span>
          <button onClick={() => navigate('/market')}
            style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA', background: 'none', border: 'none', cursor: 'pointer' }}>
            全部 →
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0,1,2,3].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', borderRadius: 16,
            background: '#111124', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 8 }}>📭</div>
            <p style={{ color: '#64748B', fontSize: 14 }}>尚無商品</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {listings.slice(0, 6).map(l => <CardItem key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
