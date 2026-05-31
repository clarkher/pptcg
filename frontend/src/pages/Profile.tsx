import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingsApi } from '../api/listings';
import type { Listing } from '../types';
import { Header } from '../components/Header';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';

export function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    listingsApi.getMine().then(setMyListings).finally(() => setLoading(false));
  }, [user, navigate]);

  const handleRemove = async (id: string) => {
    await listingsApi.remove(id);
    setMyListings((prev) => prev.filter((l) => l.id !== id));
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  const activeListings = myListings.filter((l) => l.status === 'active');

  return (
    <div className="pb-24">
      <Header title="我的帳號" />

      <div className="px-4 pt-4 space-y-5">
        {/* User card */}
        <div className="bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-100 text-lg">{user.username}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">帳戶餘額</p>
              <p className="text-2xl font-bold text-violet-400">NT${user.wallet.toFixed(0)}</p>
            </div>
            <span className="text-3xl">💰</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '上架中', value: activeListings.length },
            { label: '已售出', value: myListings.filter((l) => l.status === 'sold').length },
            { label: '全部商品', value: myListings.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#16213E] border border-[#0F3460] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* My Listings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-100">我的上架</h3>
            <button
              onClick={() => navigate('/sell')}
              className="text-sm text-violet-400 font-medium"
            >
              + 新增
            </button>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : activeListings.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-[#16213E] border border-[#0F3460] rounded-2xl">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-sm">還沒有商品上架</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeListings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-[#16213E] border border-[#0F3460] rounded-xl p-3 flex items-center gap-3"
                >
                  {listing.cardImage && (
                    <img
                      src={listing.cardImage}
                      alt={listing.cardName}
                      className="w-12 h-12 object-contain rounded bg-[#0F1629]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{listing.cardName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <GameBadge game={listing.cardGame} />
                      <span className="text-xs text-slate-500">{listing.condition}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-violet-400 font-bold text-sm">NT${listing.price}</p>
                    <button
                      onClick={() => handleRemove(listing.id)}
                      className="text-xs text-red-400 mt-1"
                    >
                      下架
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium py-3 rounded-xl"
        >
          登出
        </button>
      </div>
    </div>
  );
}
