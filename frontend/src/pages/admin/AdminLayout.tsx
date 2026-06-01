import { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const NAV = [
  { path: '/admin', label: '總覽', icon: '📊', exact: true },
  { path: '/admin/listings', label: '商品管理', icon: '🃏' },
  { path: '/admin/orders', label: '訂單管理', icon: '📋' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!user.isAdmin) { navigate('/'); }
  }, [user, navigate]);

  if (!user?.isAdmin) return null;

  return (
    <div className="min-h-dvh flex" style={{ background: '#080810' }}>
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r py-6"
        style={{ background: '#0D0D1C', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="px-5 mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#A78BFA' }}>ADMIN</p>
          <h1 className="text-xl font-black text-white">屁TCG</h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
                style={isActive
                  ? { background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }
                  : { color: '#64748B' }}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button onClick={() => navigate('/')}
            className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors text-left">
            ← 回到買家頁面
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
