import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAuthStore } from '../stores/authStore';

function NavRow({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-98 transition-transform"
      style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: 'rgba(167,139,250,0.1)' }}>{icon}</div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      </div>
      <span className="text-slate-600 text-sm">›</span>
    </button>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuthStore();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    refreshUser();
  }, [user, navigate, refreshUser]);

  if (!user) return null;

  return (
    <div className="pb-28 page-enter">
      <Header title="我的" />

      <div className="px-4 pt-2 space-y-4">
        {/* User hero card */}
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#1E1040,#2D1B69,#1A0F3D)' }}>
          {/* Orbs */}
          <div className="absolute top-0 right-0 w-28 h-28 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)', transform: 'translate(20%,-20%)' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}>
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <p className="text-xl font-black text-white">{user.username}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
              </div>
            </div>
            <div className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(167,139,250,0.15)' }}>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">帳戶餘額</p>
                <p className="text-3xl font-black" style={{ color: '#A78BFA' }}>
                  NT$<span>{user.wallet.toLocaleString()}</span>
                </p>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="space-y-2">
          <NavRow icon="🛒" label="瀏覽市場" sub="探索所有卡牌商品" onClick={() => navigate('/market')} />
          <NavRow icon="📋" label="我的訂單" sub="查看購買記錄與狀態" onClick={() => navigate('/orders')} />
        </div>

        {/* Logout */}
        <button onClick={() => { logout(); navigate('/'); }}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity active:opacity-70"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#F87171' }}>
          登出
        </button>
      </div>
    </div>
  );
}
