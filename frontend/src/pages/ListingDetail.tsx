import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import { ordersApi } from '../api/orders';
import type { Listing } from '../types';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEOHead } from '../components/SEOHead';
import { useAuthStore } from '../stores/authStore';
import cardPlaceholder from '../assets/card-placeholder.png';

const COND_LABEL: Record<string, string> = { NM: '近全新', LP: '輕微磨損', MP: '中度磨損', HP: '重度磨損' };
const COND_COLOR: Record<string, string> = { NM: '#34D399', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171' };

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    listingsApi.getAll().then((all) => {
      setListing(all.find((l) => l.id === id) ?? null);
      setLoading(false);
    });
  }, [id]);

  const handleBuy = async () => {
    if (!user) { navigate('/login'); return; }
    if (!listing) return;
    setBuying(true);
    setError('');
    try {
      await ordersApi.buy(listing.id, 1);
      await refreshUser();
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || '購買失敗，請稍後再試');
    } finally {
      setBuying(false);
    }
  };

  if (loading) return <div style={{ paddingTop: 80 }}><LoadingSpinner /></div>;
  if (!listing) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }}>❓</div>
      <p style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 12 }}>找不到此商品</p>
      <button onClick={() => navigate(-1)} style={{ color: '#8B5CF6', fontSize: 14, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>← 返回</button>
    </div>
  );

  const condColor = COND_COLOR[listing.condition] ?? COND_COLOR['NM'];

  const COND_FULL: Record<string, string> = { NM: '近全新', LP: '輕微磨損', MP: '中度磨損', HP: '重度磨損' };
  const gameLabel = listing.cardGame === 'pokemon' ? '寶可夢' : '遊戲王';
  const condLabel = COND_FULL[listing.condition] || listing.condition;
  const listingDesc = `${listing.cardName}（${gameLabel}／${condLabel}）NT$${listing.price}，由 @${listing.seller.username} 在屁TCG 上架。安全快速卡牌交易平台。`;

  return (
    <div style={{ paddingBottom: 128 }} className="page-enter">
      <SEOHead
        title={`${listing.cardName} - ${gameLabel}卡牌`}
        description={listingDesc}
        canonical={`/listing/${listing.id}`}
        ogImage={listing.cardImage || undefined}
        ogType="product"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": listing.cardName,
          "description": listingDesc,
          "image": listing.cardImage,
          "offers": {
            "@type": "Offer",
            "priceCurrency": "TWD",
            "price": listing.price,
            "availability": listing.status === 'active'
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            "seller": { "@type": "Person", "name": listing.seller.username }
          }
        }}
      />

      {/* Back nav */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '48px 16px 12px',
        background: 'rgba(6,6,15,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 34, height: 34, borderRadius: 12, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#94A3B8', cursor: 'pointer', fontSize: 16,
        }}>←</button>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.cardName}
        </p>
      </div>

      {/* Card image hero */}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        background: `radial-gradient(ellipse at center, rgba(88,28,220,0.18) 0%, rgba(6,6,15,0.9) 65%)`,
        overflow: 'hidden',
      }}>
        {/* Animated glow behind card */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at center, ${condColor}20 0%, transparent 60%)`,
        }} />
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {listing.cardImage ? (
          <img
            src={listing.cardImage}
            alt={listing.cardName}
            style={{
              position: 'relative', zIndex: 2, maxHeight: 300, objectFit: 'contain',
              filter: `drop-shadow(0 0 32px rgba(167,139,250,0.35)) drop-shadow(0 12px 24px rgba(0,0,0,0.6))`,
              borderRadius: 8,
            }}
            onError={(e) => { (e.target as HTMLImageElement).src = cardPlaceholder; }}
          />
        ) : (
          <img src={cardPlaceholder} alt="card" style={{
            position: 'relative', zIndex: 2, maxHeight: 300, objectFit: 'contain',
            filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.5))',
            borderRadius: 8,
          }} />
        )}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Title + badges */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <GameBadge game={listing.cardGame} size="md" />
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
              color: condColor, background: `${condColor}18`, border: `1px solid ${condColor}44`,
            }}>
              {listing.condition} · {COND_LABEL[listing.condition]}
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2, letterSpacing: -0.4 }}>
            {listing.cardName}
          </h2>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
            賣家：<span style={{ color: '#A78BFA', fontWeight: 600 }}>{listing.seller.username}</span>
          </p>
        </div>

        {/* Description */}
        {listing.description && (
          <div style={{
            borderRadius: 18, padding: '16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>商品說明</p>
            <p style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.6 }}>{listing.description}</p>
          </div>
        )}

        {/* Price card */}
        <div style={{
          borderRadius: 20, padding: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(88,28,220,0.15) 0%, rgba(15,10,40,0.6) 100%)',
          border: '1px solid rgba(139,92,246,0.2)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 24px rgba(88,28,220,0.15)',
        }}>
          <div>
            <p style={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>售價</p>
            <p style={{
              fontSize: 36, fontWeight: 900, lineHeight: 1,
              background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              NT${listing.price.toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>數量</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#E2E8F0' }}>×{listing.quantity}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            borderRadius: 14, padding: '12px 16px', textAlign: 'center',
            fontSize: 14, fontWeight: 600, color: '#F87171',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{
            borderRadius: 20, padding: '24px', textAlign: 'center',
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
            <p style={{ fontWeight: 800, color: '#34D399', fontSize: 18, marginBottom: 12 }}>購買成功！</p>
            <button onClick={() => navigate('/orders')} style={{
              fontSize: 13, fontWeight: 700, color: '#A78BFA',
              background: 'none', border: 'none', cursor: 'pointer',
            }}>查看訂單 →</button>
          </div>
        )}
      </div>

      {/* Buy bar */}
      {!success && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, padding: '16px 16px',
          background: 'rgba(6,6,15,0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {listing.status !== 'active' ? (
            <div style={{
              width: '100%', padding: '14px', borderRadius: 16, textAlign: 'center',
              color: '#475569', fontWeight: 700, fontSize: 14,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              此商品已售出
            </div>
          ) : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>我的餘額</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#CBD5E1' }}>NT${user.wallet.toLocaleString()}</p>
              </div>
              <button
                onClick={handleBuy}
                disabled={buying || listing.seller.username === user.username}
                style={{
                  flex: 1, padding: '15px', borderRadius: 16, fontWeight: 800,
                  fontSize: 15, border: 'none', cursor: listing.seller.username === user.username ? 'not-allowed' : 'pointer',
                  background: listing.seller.username === user.username
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
                  color: listing.seller.username === user.username ? '#475569' : '#fff',
                  opacity: buying ? 0.6 : 1,
                  boxShadow: listing.seller.username === user.username
                    ? 'none' : '0 0 24px rgba(139,92,246,0.4)',
                  transition: 'opacity 0.15s',
                }}
              >
                {buying ? '購買中...'
                  : listing.seller.username === user.username ? '這是你的商品'
                  : `立即購買 NT$${listing.price.toLocaleString()}`}
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/login')} style={{
              width: '100%', padding: '15px', borderRadius: 16, border: 'none',
              fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer',
              background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
              boxShadow: '0 0 24px rgba(139,92,246,0.4)',
            }}>
              登入以購買
            </button>
          )}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      )}
    </div>
  );
}
