import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const NAV_ITEMS = [
  { path: '/', label: '首頁', icon: '🏠' },
  { path: '/market', label: '市場', icon: '🛒' },
  { path: '/sell', label: '上架', icon: '📦' },
  { path: '/orders', label: '訂單', icon: '📋' },
  { path: '/profile', label: '我的', icon: '👤' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleNav = (path: string) => {
    if ((path === '/sell' || path === '/orders' || path === '/profile') && !user) {
      navigate('/login');
      return;
    }
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#16213E]/95 backdrop-blur border-t border-[#0F3460] z-50">
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${
                isActive ? 'text-violet-400' : 'text-slate-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* iOS safe area */}
      <div className="h-safe-area-bottom" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </nav>
  );
}
