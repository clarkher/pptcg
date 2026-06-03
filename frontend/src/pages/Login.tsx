import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../stores/authStore';
import brandLogo from '../assets/brand-logo.png';
import brandLogoMewtwo from '../assets/brand-logo-mewtwo.png';

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

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', position: 'relative', overflow: 'hidden',
      background: '#050508',
    }} className="page-enter">

      {/* Background: Mewtwo silhouette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        pointerEvents: 'none', overflow: 'hidden',
      }}>
        <img src={brandLogoMewtwo} alt="" aria-hidden style={{
          width: '65%', maxWidth: 400, opacity: 0.06,
          filter: 'grayscale(1)',
          transform: 'translateX(15%)',
        }} />
      </div>

      {/* Glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '55%', height: '55%',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(109,40,236,0.18) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-5%', width: '45%', height: '45%',
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(0,229,255,0.1) 0%, transparent 70%)',
      }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 380, position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src={brandLogo} alt="屁TCG" style={{
            height: 56, width: 'auto', marginBottom: 12,
            filter: 'drop-shadow(0 0 16px rgba(0,229,255,0.5)) drop-shadow(0 0 32px rgba(109,40,236,0.3))',
          }} />
          <p style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>卡牌交易平台 · 登入帳號</p>
        </div>

        {/* Form container */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: '28px 24px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                borderRadius: 12, padding: '10px 14px', textAlign: 'center',
                fontSize: 13, fontWeight: 600, color: '#F87171',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 14, fontSize: 14,
                  color: '#F1F5F9', outline: 'none', fontFamily: 'inherit',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                  boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(0,229,255,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>密碼</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 14, fontSize: 14,
                  color: '#F1F5F9', outline: 'none', fontFamily: 'inherit',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                  boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(0,229,255,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '15px', borderRadius: 16, border: 'none',
              fontWeight: 900, fontSize: 15, color: '#000', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              background: 'linear-gradient(135deg, #00e5ff, #00b8cc)',
              boxShadow: '0 0 24px rgba(0,229,255,0.4), 0 4px 16px rgba(0,0,0,0.3)',
              transition: 'all 0.15s', letterSpacing: 0.5,
            }}>
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>或使用 Google 登入</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Google Login */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
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

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#475569', marginTop: 24 }}>
          還沒帳號？{' '}
          <Link to="/register" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>
            立即註冊 →
          </Link>
        </p>
      </div>
    </div>
  );
}
