import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const NAV = [
  { path: '/', label: '首頁', exact: true, icon: HomeIcon },
  { path: '/market', label: '市場', exact: false, icon: MarketIcon },
  { path: '/orders', label: '訂單', exact: false, icon: OrderIcon },
  { path: '/profile', label: '我的', exact: false, icon: ProfileIcon },
];

function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>;
}
function MarketIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57l1.65-8.42H6"/>
  </svg>;
}
function OrderIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>;
}
function ProfileIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>;
}

interface Props { children: React.ReactNode }

export function AppShell({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const goTo = (path: string) => {
    if ((path === '/orders' || path === '/profile') && !user) {
      navigate('/login');
    } else {
      navigate(path);
    }
  };

  const isActive = (item: typeof NAV[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>

      {/* ── Desktop Sidebar (lg+) ─────────────────── */}
      <aside className="lg-sidebar" style={{
        width: 220,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        flexDirection: 'column',
        padding: '32px 16px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: '#0A0A18',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 12px 32px' }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', cursor: 'pointer' }}
            onClick={() => navigate('/')}>
            屁<span style={{ color: '#A78BFA' }}>TCG</span>
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {NAV.map(item => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => goTo(item.path)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: active ? 700 : 500, textAlign: 'left',
                background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                color: active ? '#A78BFA' : '#64748B',
                transition: 'all 0.15s',
              }}>
                <Icon />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info / Login */}
        {user ? (
          <div style={{
            padding: '14px', borderRadius: 14,
            background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>
              {user.username}
            </p>
            <p style={{ fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>
              💰 NT${user.wallet.toLocaleString()}
            </p>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} style={{
            width: '100%', padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: '#fff',
            background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
          }}>
            登入 / 註冊
          </button>
        )}
      </aside>

      {/* ── Main content ─────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav (< lg) ──────────────── */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(8,8,18,0.95)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', maxWidth: 430, margin: '0 auto' }}>
          {NAV.map(item => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => goTo(item.path)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 0 8px', gap: 4, border: 'none', cursor: 'pointer',
                background: 'transparent', color: active ? '#A78BFA' : '#475569',
                transition: 'color 0.15s',
              }}>
                <Icon />
                <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
                <div style={{
                  width: 16, height: 2, borderRadius: 2,
                  background: active ? '#A78BFA' : 'transparent',
                }} />
              </button>
            );
          })}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
      </nav>
    </div>
  );
}
