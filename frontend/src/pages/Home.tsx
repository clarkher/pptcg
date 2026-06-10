import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList } from 'lucide-react';
import { listingsApi } from '../api/listings';
import type { Listing } from '../types';
import { CardGrid } from '../components/CardGrid';
import { useAuthStore } from '../stores/authStore';
import { SEOHead } from '../components/SEOHead';
import heroBanner from '../assets/hero-banner.png';
import brandLogo from '../assets/brand-logo.png';
import yugiohIcon from '../assets/game-icons/yugioh-icon.png';
import pokemonIcon from '../assets/game-icons/pokemon-icon.png';

const QUICK_ACTIONS = [
  {
    Icon: ShoppingCart,
    label: '瀏覽市場', sub: '探索卡牌商品',
    path: '/market',
    gradient: 'linear-gradient(135deg, rgba(109,40,236,0.15), rgba(109,40,217,0.08))',
    border: 'rgba(109,40,236,0.2)',
    glow: 'rgba(109,40,236,0.12)',
  },
  {
    Icon: ClipboardList,
    label: '我的訂單', sub: '購買記錄',
    path: '/orders',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))',
    border: 'rgba(16,185,129,0.18)',
    glow: 'rgba(16,185,129,0.1)',
  },
];

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.getAll().then(setListings).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom: 100 }} className="page-enter">
      <SEOHead
        canonical="/"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "屁TCG",
          "alternateName": "pipi cards",
          "url": "https://pipicards.com",
          "description": "台灣寶可夢卡牌交易平台，提供閃卡、稀有卡的安全買賣服務",
          "potentialAction": {
            "@type": "SearchAction",
            "target": { "@type": "EntryPoint", "urlTemplate": "https://pipicards.com/market?q={search_term_string}" },
            "query-input": "required name=search_term_string"
          }
        }}
      />

      {/* Mobile Header */}
      <div className="mobile-only-header" style={{
        alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 16px',
      }}>
        <img
          src={brandLogo}
          alt="屁TCG"
          style={{
            height: 36, width: 'auto',
            filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.5))',
          }}
        />
        {!user && (
          <button onClick={() => navigate('/login')} style={{
            padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 800,
            color: '#fff', cursor: 'pointer', border: 'none',
            background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
            boxShadow: '0 0 16px rgba(109,40,236,0.4)',
          }}>
            登入
          </button>
        )}
      </div>

      {/* Hero Banner */}
      <div style={{
        margin: '0 16px', borderRadius: 24, overflow: 'hidden',
        position: 'relative', height: 200, background: '#0d0a1f',
        boxShadow: '0 8px 32px rgba(109,40,236,0.2), 0 2px 8px rgba(0,0,0,0.5)',
      }}>
        <img src={heroBanner} alt="" aria-hidden style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 35%', opacity: 0.75,
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(135deg, rgba(10,5,30,0.82) 0%, rgba(20,10,50,0.45) 50%, rgba(8,4,20,0.70) 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 40px rgba(109,40,236,0.15)',
        }} />
        <div style={{
          position: 'relative', height: '100%', display: 'flex',
          flexDirection: 'column', justifyContent: 'center', padding: '0 24px',
        }}>
          <p style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase',
            color: 'rgba(167,139,250,0.8)', marginBottom: 8,
          }}>台灣最屁的卡牌交易平台</p>
          <h2 style={{
            fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.2,
            marginBottom: 16, letterSpacing: -0.5,
            textShadow: '0 0 30px rgba(167,139,250,0.4)',
          }}>
            買你想要的<br />每一張卡
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/market?game=yugioh')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: 'pointer',
              background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)',
              color: '#FBBF24', backdropFilter: 'blur(8px)',
            }}>
              <img src={yugiohIcon} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
              遊戲王
            </button>
            <button onClick={() => navigate('/market?game=pokemon')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: 'pointer',
              background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.35)',
              color: '#F472B6', backdropFilter: 'blur(8px)',
            }}>
              <img src={pokemonIcon} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
              寶可夢
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 16px 0' }}>
        {QUICK_ACTIONS.map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            borderRadius: 20, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12,
            background: item.gradient, border: `1px solid ${item.border}`,
            cursor: 'pointer', textAlign: 'left',
            backdropFilter: 'blur(12px)',
            boxShadow: `0 4px 20px ${item.glow}`,
            transition: 'all 0.15s ease',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 14, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)', flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8',
            }}>
              <item.Icon size={20} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9', marginBottom: 2 }}>{item.label}</p>
              <p style={{ fontSize: 11, color: '#64748B' }}>{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Latest Listings */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: 'linear-gradient(to bottom, #00e5ff, #6D28D9)' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9', letterSpacing: -0.3 }}>最新上架</span>
          </div>
          <button onClick={() => navigate('/market')} style={{
            fontSize: 12, fontWeight: 700, color: '#8B5CF6', background: 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
          }}>
            全部 →
          </button>
        </div>
        <CardGrid listings={listings} loading={loading} limit={6}
          emptyText="尚無商品" emptySubText="店長正在上架中，請稍候" />
      </div>
    </div>
  );
}
