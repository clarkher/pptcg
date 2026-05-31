import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import { ordersApi } from '../api/orders';
import type { Listing } from '../types';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';

const COND_LABEL: Record<string, string> = { NM: '近全新', LP: '輕微磨損', MP: '中度磨損', HP: '重度磨損' };
const COND_COLOR: Record<string, string> = { NM: '#4ADE80', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171' };

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

  if (loading) return <div className="pt-20"><LoadingSpinner /></div>;
  if (!listing) return (
    <div className="flex flex-col items-center justify-center min-h-dvh text-center p-8">
      <div className="text-5xl mb-4 opacity-30">❓</div>
      <p className="text-slate-400 font-semibold">找不到此商品</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-violet-400 text-sm font-medium">← 返回</button>
    </div>
  );

  const condColor = COND_COLOR[listing.condition] ?? COND_COLOR['NM'];

  return (
    <div className="pb-32 page-enter" style={{ background: '#0A0A14' }}>
      {/* Back nav */}
      <div className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3.5"
        style={{ background: 'rgba(10,10,20,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.05)' }}>←</button>
        <p className="text-sm font-bold text-slate-100 truncate flex-1">{listing.cardName}</p>
      </div>

      {/* Card image hero */}
      <div className="relative flex items-center justify-center py-8 px-6"
        style={{ background: 'radial-gradient(ellipse at center, #1E1040 0%, #0A0A14 70%)' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${condColor} 0%, transparent 60%)` }} />
        {listing.cardImage
          ? <img src={listing.cardImage} alt={listing.cardName}
              className="relative z-10 max-h-72 object-contain drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 0 24px rgba(167,139,250,0.3))' }} />
          : <div className="text-8xl opacity-20 relative z-10">🃏</div>
        }
      </div>

      <div className="px-4 space-y-4">
        {/* Title + badges */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GameBadge game={listing.cardGame} size="md" />
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: condColor, background: `${condColor}18`, border: `1px solid ${condColor}40` }}>
              {listing.condition} · {COND_LABEL[listing.condition]}
            </span>
          </div>
          <h2 className="text-xl font-black text-white leading-tight">{listing.cardName}</h2>
          <p className="text-sm text-slate-500 mt-1">
            賣家：<span style={{ color: '#A78BFA' }}>{listing.seller.username}</span>
          </p>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="rounded-2xl p-4"
            style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">商品說明</p>
            <p className="text-sm text-slate-300 leading-relaxed">{listing.description}</p>
          </div>
        )}

        {/* Price card */}
        <div className="rounded-2xl p-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#1E1040,#13132A)', border: '1px solid rgba(167,139,250,0.15)' }}>
          <div>
            <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">售價</p>
            <p className="text-3xl font-black" style={{ color: '#A78BFA' }}>
              NT${listing.price.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">數量</p>
            <p className="text-2xl font-black text-slate-200">×{listing.quantity}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 text-sm text-center font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-2xl p-5 text-center"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-bold text-green-400 text-lg">購買成功！</p>
            <button onClick={() => navigate('/orders')}
              className="mt-3 text-sm font-semibold" style={{ color: '#A78BFA' }}>
              查看訂單 →
            </button>
          </div>
        )}
      </div>

      {/* Buy bar */}
      {!success && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4"
          style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {listing.status !== 'active' ? (
            <div className="w-full py-3.5 rounded-xl text-center text-slate-500 font-bold text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              此商品已售出
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-500">我的餘額</p>
                <p className="text-sm font-bold text-slate-300">NT${user.wallet.toLocaleString()}</p>
              </div>
              <button onClick={handleBuy} disabled={buying || listing.seller.username === user.username}
                className="flex-1 py-3.5 rounded-xl font-bold text-white text-base transition-opacity active:opacity-80"
                style={{
                  background: listing.seller.username === user.username
                    ? 'rgba(255,255,255,0.08)'
                    : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                  opacity: buying ? 0.6 : 1,
                  boxShadow: listing.seller.username === user.username ? 'none' : '0 4px 24px rgba(124,58,237,0.4)',
                  color: listing.seller.username === user.username ? '#64748B' : '#fff',
                }}>
                {buying ? '購買中...'
                  : listing.seller.username === user.username ? '這是你的商品'
                  : `立即購買 NT$${listing.price.toLocaleString()}`}
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/login')}
              className="w-full py-3.5 rounded-xl font-bold text-white text-base"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 4px 24px rgba(124,58,237,0.4)' }}>
              登入以購買
            </button>
          )}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      )}
    </div>
  );
}
