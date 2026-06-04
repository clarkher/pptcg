import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList, Wallet } from 'lucide-react';
import { Header } from '../components/Header';
import { useAuthStore } from '../stores/authStore';

function NavRow({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', borderRadius: 18, padding: '16px',
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer', textAlign: 'left',
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.18)',
        color: '#8B5CF6',
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 12, color: '#64748B' }}>{sub}</p>
      </div>
      <span style={{ color: '#475569', fontSize: 16, fontWeight: 300 }}>›</span>
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
    <div style={{ paddingBottom: 112 }} className="page-enter">
      <Header title="我的" />

      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* User hero card */}
        <div style={{
          borderRadius: 24, padding: '24px', position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(88,28,220,0.25) 0%, rgba(15,10,40,0.8) 60%, rgba(6,182,212,0.08) 100%)',
          border: '1px solid rgba(139,92,246,0.25)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 40px rgba(88,28,220,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 120, height: 120,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: -20, left: 20, width: 80, height: 80,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)',
          }} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 900, color: '#fff',
                  background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                  boxShadow: '0 0 24px rgba(124,58,237,0.6)',
                }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div style={{
                  position: 'absolute', inset: -3, borderRadius: 23,
                  background: 'conic-gradient(#A78BFA, #22D3EE, #A78BFA)',
                  zIndex: -1, opacity: 0.6,
                }} />
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{user.username}</p>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{user.email}</p>
              </div>
            </div>

            {/* Wallet */}
            <div style={{
              borderRadius: 16, padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(167,139,250,0.15)',
            }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>帳戶餘額</p>
                <p style={{ fontSize: 32, fontWeight: 900, lineHeight: 1,
                  background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  NT${user.wallet.toLocaleString()}
                </p>
              </div>
              <Wallet size={36} style={{ opacity: 0.5, color: '#A78BFA' }} />
            </div>
          </div>
        </div>

        {/* Menu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <NavRow icon={<ShoppingCart size={20} />} label="瀏覽市場" sub="探索所有卡牌商品" onClick={() => navigate('/market')} />
          <NavRow icon={<ClipboardList size={20} />} label="我的訂單" sub="查看購買記錄與狀態" onClick={() => navigate('/orders')} />
        </div>

        {/* Logout */}
        <button onClick={() => { logout(); navigate('/'); }} style={{
          width: '100%', padding: '14px', borderRadius: 16, fontWeight: 700, fontSize: 14,
          cursor: 'pointer', transition: 'all 0.15s',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
          color: '#F87171', backdropFilter: 'blur(8px)',
        }}>
          登出
        </button>
      </div>
    </div>
  );
}
