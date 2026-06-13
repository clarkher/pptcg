import { useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Layers, Package, LayoutGrid, Settings, Bell, MessageCircle, Radar, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const NAV: { path: string; label: string; icon: ReactNode; exact?: boolean }[] = [
  { path: '/admin',              label: '總覽',     icon: <LayoutDashboard size={16} />, exact: true },
  { path: '/admin/catalog',      label: '卡片管理',  icon: <LayoutGrid size={16} /> },
  { path: '/admin/wishlist',     label: '敲碗總覽',  icon: <Bell size={16} /> },
  { path: '/admin/listings',     label: '商品管理',  icon: <Layers size={16} /> },
  { path: '/admin/orders',       label: '訂單管理',  icon: <Package size={16} /> },
  { path: '/admin/kapai',        label: '卡報報雷達', icon: <Radar size={16} />, exact: true },
  { path: '/admin/kapai-settings', label: '卡報報設定', icon: <SlidersHorizontal size={16} /> },
  { path: '/admin/huca',         label: 'Huca 行情', icon: <TrendingUp size={16} /> },
  { path: '/admin/refdata',      label: '資料管理',  icon: <Settings size={16} /> },
  { path: '/admin/line-settings',label: 'LINE Bot', icon: <MessageCircle size={16} /> },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!user) { navigate('/admin/login'); return; }
    if (!user.isAdmin) navigate('/admin/login');
  }, [user, navigate]);

  if (!user?.isAdmin) return null;

  return (
    <div style={{ display: 'flex', height: '100dvh', background: '#07070F', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#0A0A18', borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, color: '#7C3AED', background: 'rgba(124,58,237,0.15)', display: 'inline-block', marginBottom: 8 }}>ADMIN</span>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#F8FAFC', lineHeight: 1.2 }}>屁TCG</div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>{user.username}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                width: '100%', textAlign: 'left', fontSize: 13, fontWeight: active ? 700 : 400,
                background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
                color: active ? '#C4B5FD' : '#475569',
                transition: 'all 0.1s',
                borderLeft: active ? '2px solid #7C3AED' : '2px solid transparent',
              }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '10px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link to="/" target="_blank" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 9, fontSize: 12, color: '#334155', textDecoration: 'none',
            background: 'transparent',
          }}>
            ↗ 前台
          </Link>
          <button onClick={() => { logout(); navigate('/admin/login'); }} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 9, border: 'none', cursor: 'pointer', width: '100%',
            background: 'transparent', color: '#334155', fontSize: 12, textAlign: 'left',
          }}>
            ⇥ 登出
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '36px 40px' }}>
        <Outlet />
      </main>
    </div>
  );
}
