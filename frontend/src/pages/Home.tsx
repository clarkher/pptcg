import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import type { Listing } from '../types';
import { CardItem } from '../components/CardItem';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.getAll().then(setListings).finally(() => setLoading(false));
  }, []);

  const recent = listings.slice(0, 6);

  return (
    <div className="pb-24">
      <Header
        title="屁TCG 🃏"
        right={
          user ? (
            <span className="text-sm text-violet-400 font-medium">NT${user.wallet.toFixed(0)}</span>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-violet-400 font-medium"
            >
              登入
            </button>
          )
        }
      />

      <div className="px-4 pt-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-violet-900 to-indigo-900 rounded-2xl p-5 mb-5 border border-violet-500/20">
          <p className="text-xs text-violet-300 font-medium mb-1">台灣最屁的</p>
          <h2 className="text-xl font-bold text-white">TCG 卡牌交易平台</h2>
          <p className="text-sm text-slate-300 mt-1">遊戲王・寶可夢 安全交易</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => navigate('/market?game=yugioh')}
              className="flex-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm font-bold py-2 rounded-xl"
            >
              遊戲王
            </button>
            <button
              onClick={() => navigate('/market?game=pokemon')}
              className="flex-1 bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold py-2 rounded-xl"
            >
              寶可夢
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: '🛒', label: '買卡', action: () => navigate('/market') },
            { icon: '📦', label: '賣卡', action: () => navigate('/sell') },
            { icon: '📋', label: '訂單', action: () => navigate('/orders') },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="bg-[#16213E] border border-[#0F3460] rounded-2xl py-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-slate-300 font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Recent listings */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100">最新上架</h3>
          <button onClick={() => navigate('/market')} className="text-sm text-violet-400">
            查看全部 →
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p>還沒有商品上架</p>
            <button
              onClick={() => navigate('/sell')}
              className="mt-3 text-violet-400 text-sm font-medium"
            >
              成為第一個賣家 →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recent.map((listing) => (
              <CardItem key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
