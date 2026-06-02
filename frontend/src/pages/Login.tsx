import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../stores/authStore';

export function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: '#111124',
    border: '1px solid rgba(255,255,255,0.08)',
    fontFamily: 'inherit',
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 page-enter"
      style={{ background: 'radial-gradient(ellipse at top, #1E1040 0%, #0A0A14 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex w-20 h-20 rounded-3xl items-center justify-center mb-4 text-4xl"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}>
            🃏
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            屁<span style={{ color: '#A78BFA' }}>TCG</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">卡牌交易平台</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-xl p-3 text-sm text-center font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 tracking-wide uppercase">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl text-slate-100 focus:outline-none text-sm"
              style={inputStyle} placeholder="your@email.com" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 tracking-wide uppercase">密碼</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl text-slate-100 focus:outline-none text-sm"
              style={inputStyle} placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity active:opacity-80"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 24px rgba(124,58,237,0.35)' }}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="mt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs text-slate-500">或</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async ({ credential }) => {
                if (!credential) return;
                setError('');
                setLoading(true);
                try {
                  await loginWithGoogle(credential);
                  navigate('/');
                } catch {
                  setError('Google 登入失敗，請稍後再試');
                } finally {
                  setLoading(false);
                }
              }}
              onError={() => setError('Google 登入失敗，請稍後再試')}
              theme="filled_black"
              shape="rectangular"
              size="large"
              text="signin_with"
            />
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          還沒帳號？{' '}
          <Link to="/register" className="font-semibold" style={{ color: '#A78BFA' }}>立即註冊</Link>
        </p>
      </div>
    </div>
  );
}
