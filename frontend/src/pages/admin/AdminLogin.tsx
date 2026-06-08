import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function AdminLogin() {
  const navigate = useNavigate();
  const { login, user, logout } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.isAdmin) navigate('/admin');
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const { user: u } = useAuthStore.getState();
      if (!u?.isAdmin) {
        logout();
        setError('此帳號沒有管理員權限');
        return;
      }
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || '帳號或密碼錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#07070F', padding: '24px 20px', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 6, marginBottom: 16,
            background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
          }}>
            <Lock size={10} color="#7C3AED" />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#7C3AED' }}>ADMIN PANEL</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#F8FAFC', margin: '0 0 6px', letterSpacing: '-0.5px' }}>屁TCG 後台</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>限管理員帳號登入</p>
        </div>

        <div style={{ background: '#0D0D1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 24px', boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, color: '#F87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@pipicards.com" required autoFocus
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>密碼</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none', marginTop: 4,
              fontSize: 14, fontWeight: 900, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,#5B21B6,#7C3AED)',
              boxShadow: '0 0 32px rgba(124,58,237,0.5)', opacity: loading ? 0.7 : 1,
              letterSpacing: 0.5,
            }}>
              {loading ? '驗證中...' : '進入後台'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12 }}>
          <Link to="/" style={{ color: '#334155', textDecoration: 'none' }}>← 回到商店前台</Link>
        </p>
      </div>
    </div>
  );
}
