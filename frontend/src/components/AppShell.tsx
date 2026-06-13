import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { ShoppingCart } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { VerifyEmailBanner } from './VerifyEmailBanner';
import brandLogo from '../assets/brand-logo.png';

const NAV = [
  { path: '/', label: '首頁', exact: true, icon: HomeIcon },
  { path: '/market', label: '市場', exact: false, icon: MarketIcon },
  { path: '/cart', label: '購物車', exact: false, icon: CartIcon },
  { path: '/orders', label: '訂單', exact: false, icon: OrderIcon },
  { path: '/profile', label: '我的', exact: false, icon: ProfileIcon },
];

function HomeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>;
}
function MarketIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57l1.65-8.42H6"/>
  </svg>;
}
function OrderIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>;
}
function ProfileIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>;
}
function CartIcon() {
  return <ShoppingCart width={18} height={18} strokeWidth={2} />;
}

interface Props { children: React.ReactNode }

export function AppShell({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const cartCount = useCartStore(s => s.items.length);
  const fetchCart = useCartStore(s => s.fetch);

  // 依賴 user.id 而非 user 物件：refreshUser 每次都換新物件參考，
  // 用物件當依賴會在 user 刷新時重複抓購物車
  useEffect(() => {
    if (user) fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const goTo = (path: string) => {
    if ((path === '/orders' || path === '/profile' || path === '/cart') && !user) {
      navigate('/login');
    } else {
      navigate(path);
    }
  };

  const isActive = (item: typeof NAV[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  // 商品詳情頁有自己的固定底部「加入購物車」列，手機底部導覽列隱藏避免重疊遮住按鈕
  const hideMobileNav = location.pathname.startsWith('/listing/');

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>

      {/* ── Desktop Sidebar ─────────── */}
      <aside className="lg-sidebar" style={{
        width: 228, flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
        flexDirection: 'column', padding: '28px 14px',
        borderRight: '1px solid rgba(167,139,250,0.08)',
        background: 'rgba(6,6,15,0.92)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        boxShadow: '4px 0 40px rgba(0,0,0,0.4), inset -1px 0 0 rgba(167,139,250,0.06)',
      }}>

        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none', overflow: 'hidden', borderRadius: 0,
        }}>
          <div style={{
            position: 'absolute', top: -60, left: -40, width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: 40, right: -60, width: 180, height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)',
          }} />
        </div>

        {/* Logo — 真正品牌 logo */}
        <div
          style={{
            padding: '4px 8px 28px', cursor: 'pointer', position: 'relative', zIndex: 1,
          }}
          onClick={() => navigate('/')}
        >
          {/* Cyan glow behind logo */}
          <div style={{
            position: 'absolute', inset: 0, bottom: 28,
            background: 'radial-gradient(ellipse at center, rgba(0,229,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <img
            src={brandLogo}
            alt="屁TCG 卡牌遊戲"
            style={{
              width: '100%', maxWidth: 180, height: 'auto',
              filter: 'drop-shadow(0 0 12px rgba(0,229,255,0.4)) drop-shadow(0 0 24px rgba(109,40,236,0.3))',
              position: 'relative', zIndex: 1,
            }}
          />
        </div>

        {/* Divider */}
        <div style={{
          height: 1, marginBottom: 16, marginLeft: 10, marginRight: 10,
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.2), transparent)',
          position: 'relative', zIndex: 1,
        }} />

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, position: 'relative', zIndex: 1 }}>
          {NAV.map(item => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                className="sidebar-nav-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: active ? 700 : 500, textAlign: 'left',
                  background: active
                    ? 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.08))'
                    : 'transparent',
                  color: active ? '#00e5ff' : '#64748B',
                  transition: 'all 0.2s',
                  boxShadow: active
                    ? 'inset 0 0 0 1px rgba(139,92,246,0.3), 0 0 16px rgba(139,92,246,0.1)'
                    : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Active left accent bar */}
                {active && (
                  <div style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: 'linear-gradient(180deg, #00e5ff, #22D3EE)',
                    boxShadow: '0 0 8px rgba(0,229,255,0.8)',
                  }} />
                )}
                <span style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: active
                    ? 'rgba(0,229,255,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.2s',
                  filter: active ? 'drop-shadow(0 0 6px rgba(167,139,250,0.6))' : 'none',
                }}>
                  <Icon />
                  {item.path === '/cart' && user && cartCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px',
                      borderRadius: 8, background: '#8B5CF6', color: '#fff', fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
                {active && (
                  <div style={{
                    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                    background: '#00e5ff',
                    boxShadow: '0 0 8px #00e5ff, 0 0 16px rgba(167,139,250,0.5)',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{
          height: 1, margin: '16px 10px 16px',
          background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.1), transparent)',
          position: 'relative', zIndex: 1,
        }} />

        {/* User info */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {user ? (
            <div style={{
              padding: '14px 16px', borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(34,211,238,0.04))',
              border: '1px solid rgba(139,92,246,0.2)',
              boxShadow: '0 0 20px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                  background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 900, color: '#fff',
                  boxShadow: '0 0 12px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', lineHeight: 1 }}>{user.username}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#22D3EE', opacity: 0.7, marginTop: 3, letterSpacing: 0.5 }}>PLAYER</p>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => navigate('/login')} style={{
              width: '100%', padding: '13px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 800, color: '#fff',
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 0 24px rgba(124,58,237,0.4), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
              transition: 'all 0.2s',
              letterSpacing: 0.5,
            }}>
              登入 / 註冊
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────── */}
      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <NotificationBell />
        <VerifyEmailBanner />
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ──────── */}
      {!hideMobileNav && (
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(6,6,15,0.92)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', maxWidth: 430, margin: '0 auto' }}>
          {NAV.map(item => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => goTo(item.path)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 0 8px', gap: 4, border: 'none', cursor: 'pointer',
                background: 'transparent', color: active ? '#00e5ff' : '#475569',
                transition: 'color 0.15s',
              }}>
                <div style={{
                  position: 'relative',
                  width: 32, height: 32, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <Icon />
                  {item.path === '/cart' && user && cartCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px',
                      borderRadius: 8, background: '#8B5CF6', color: '#fff', fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
      </nav>
      )}
    </div>
  );
}
