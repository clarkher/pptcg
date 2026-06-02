import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const NAV = [
  { path: '/', label: '首頁', active: HomeIcon, inactive: HomeIcon },
  { path: '/market', label: '市場', active: MarketIcon, inactive: MarketIcon },
  { path: '/orders', label: '訂單', active: OrderIcon, inactive: OrderIcon },
  { path: '/profile', label: '我的', active: ProfileIcon, inactive: ProfileIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>;
}
function MarketIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57l1.65-8.42H6" />
  </svg>;
}
function OrderIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>;
}
function ProfileIcon({ active }: { active: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>;
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{
        background: 'rgba(8,8,18,0.95)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
      <div className="flex">
        {NAV.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          const Icon = item.active;
          return (
            <button key={item.path}
              onClick={() => {
                if ((item.path === '/orders' || item.path === '/profile') && !user) {
                  navigate('/login');
                } else {
                  navigate(item.path);
                }
              }}
              className="flex-1 flex flex-col items-center pt-3 pb-2 gap-1 active:scale-90 transition-transform"
              style={{ color: isActive ? '#A78BFA' : '#475569' }}>
              <Icon active={isActive} />
              <span className="text-[10px] font-semibold">{item.label}</span>
              {isActive && (
                <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: '#A78BFA' }} />
              )}
            </button>
          );
        })}
      </div>
      <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
    </nav>
  );
}
