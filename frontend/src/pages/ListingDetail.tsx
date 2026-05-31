import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import { ordersApi } from '../api/orders';
import type { Listing } from '../types';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';

const CONDITION_DESC: Record<string, string> = {
  NM: '近全新',
  LP: '輕微磨損',
  MP: '中度磨損',
  HP: '重度磨損',
};

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
      const found = all.find((l) => l.id === id) || null;
      setListing(found);
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

  if (loading) return <div className="pt-16"><LoadingSpinner /></div>;
  if (!listing) return (
    <div className="text-center py-16 text-slate-500">
      <div className="text-4xl mb-3">❓</div>
      <p>找不到此商品</p>
    </div>
  );

  return (
    <div className="pb-32">
      {/* Back button */}
      <div className="sticky top-0 z-40 bg-[#0D0D1A]/95 backdrop-blur border-b border-[#0F3460] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 text-xl">←</button>
        <h1 className="text-base font-bold text-slate-100 truncate">{listing.cardName}</h1>
      </div>

      {/* Card image */}
      <div className="bg-[#0F1629] flex items-center justify-center min-h-64 p-6">
        {listing.cardImage ? (
          <img
            src={listing.cardImage}
            alt={listing.cardName}
            className="max-h-72 object-contain"
          />
        ) : (
          <div className="text-7xl">🃏</div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Card info */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GameBadge game={listing.cardGame} size="md" />
            <span className="text-sm text-slate-400">{listing.condition} · {CONDITION_DESC[listing.condition]}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">{listing.cardName}</h2>
          <p className="text-slate-400 text-sm mt-1">
            賣家：<span className="text-violet-400">{listing.seller.username}</span>
          </p>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="bg-[#16213E] border border-[#0F3460] rounded-xl p-4">
            <p className="text-sm text-slate-300">{listing.description}</p>
          </div>
        )}

        {/* Price info */}
        <div className="bg-[#16213E] border border-[#0F3460] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">售價</p>
            <p className="text-2xl font-bold text-violet-400">NT${listing.price}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">數量</p>
            <p className="text-lg font-bold text-slate-100">x{listing.quantity}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🎉</div>
            <p className="text-green-400 font-bold">購買成功！</p>
            <button
              onClick={() => navigate('/orders')}
              className="text-sm text-violet-400 mt-2"
            >
              查看訂單 →
            </button>
          </div>
        )}
      </div>

      {/* Buy button */}
      {!success && listing.status === 'active' && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-[#0D0D1A]/95 backdrop-blur border-t border-[#0F3460]">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-400">我的餘額</p>
                <p className="text-sm font-bold text-slate-300">NT${user.wallet.toFixed(0)}</p>
              </div>
              <button
                onClick={handleBuy}
                disabled={buying || listing.seller.username === user.username}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {buying
                  ? '購買中...'
                  : listing.seller.username === user.username
                  ? '這是你的商品'
                  : `立即購買 NT$${listing.price}`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl"
            >
              登入以購買
            </button>
          )}
        </div>
      )}

      {listing.status !== 'active' && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-[#0D0D1A]/95 backdrop-blur border-t border-[#0F3460]">
          <div className="bg-slate-700/30 text-slate-500 font-bold py-3 rounded-xl text-center">
            此商品已售出
          </div>
        </div>
      )}
    </div>
  );
}
