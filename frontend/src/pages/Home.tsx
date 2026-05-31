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
    <div className="pb-28 page-enter">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <div>
          <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">Welcome</p>
          <h1 className="text-2xl font-black tracking-tight text-white">
            屁<span style={{ color: '#A78BFA' }}>TCG</span>
          </h1>
        </div>
        {user ? (
          <button onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#A78BFA' }}>
            <span className="text-base">💰</span> NT${user.wallet.toFixed(0)}
          </button>
        ) : (
          <button onClick={() => navigate('/login')}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
            登入
          </button>
        )}
      </div>

      <div className="px-4 space-y-5">
        {/* Hero banner */}
        <div className="relative rounded-3xl overflow-hidden p-5"
          style={{ background: 'linear-gradient(135deg, #1E1040 0%, #2D1B69 50%, #1A0F3D 100%)', minHeight: 140 }}>
          {/* Decorative orbs */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', transform: 'translate(25%, -25%)' }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #4F46E5 0%, transparent 70%)', transform: 'translate(-20%, 20%)' }} />

          <div className="relative z-10">
            <p className="text-xs font-bold tracking-widest uppercase mb-1"
              style={{ color: 'rgba(167,139,250,0.8)' }}>台灣最屁的交易平台</p>
            <h2 className="text-xl font-black text-white leading-tight mb-3">
              買你想要的<br />每一張卡
            </h2>
            <div className="flex gap-2">
              <button onClick={() => navigate('/market?game=yugioh')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.35)', color: '#EAB308' }}>
                ⚔️ 遊戲王
              </button>
              <button onClick={() => navigate('/market?game=pokemon')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}>
                ⚡ 寶可夢
              </button>
            </div>
          </div>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/market')}
            className="rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform text-left"
            style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED33,#4F46E533)' }}>🛒</div>
            <div>
              <p className="text-sm font-bold text-slate-100">瀏覽市場</p>
              <p className="text-[11px] text-slate-500">找你要的卡</p>
            </div>
          </button>
          <button onClick={() => navigate('/orders')}
            className="rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform text-left"
            style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg,#059669,#10B98133)' }}>📋</div>
            <div>
              <p className="text-sm font-bold text-slate-100">我的訂單</p>
              <p className="text-[11px] text-slate-500">查看購買記錄</p>
            </div>
          </button>
        </div>

        {/* Latest listings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-100">最新上架</h3>
            <button onClick={() => navigate('/market')}
              className="text-xs font-semibold" style={{ color: '#A78BFA' }}>
              查看全部 →
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-14 rounded-2xl" style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-5xl mb-3 opacity-40">📭</div>
              <p className="text-slate-500 text-sm font-medium">目前沒有商品</p>
              <p className="text-slate-600 text-xs mt-1">店長正在上架中，請稍候</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {listings.slice(0, 6).map((l) => <CardItem key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
