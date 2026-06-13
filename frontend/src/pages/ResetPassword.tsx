import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px', background: '#050508',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 380,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24, padding: '32px 26px', color: '#F1F5F9',
};
const input: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 14, fontSize: 14, color: '#F1F5F9',
  outline: 'none', fontFamily: 'inherit', background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box', marginBottom: 12,
};
const btn: React.CSSProperties = {
  width: '100%', padding: '15px', borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 15,
  color: '#000', cursor: 'pointer', background: 'linear-gradient(135deg, #00e5ff, #00b8cc)', marginTop: 4,
};
const errBox: React.CSSProperties = {
  borderRadius: 12, padding: '10px 14px', textAlign: 'center', fontSize: 13, fontWeight: 600,
  color: '#F87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12,
};

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuthStore();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('兩次輸入的密碼不一致'); return; }
    if (password.length < 6) { setError('密碼至少需 6 個字元'); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || '重設失敗，連結可能已過期');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>設定新密碼</h2>
        {done ? (
          <p style={{ fontSize: 14, color: '#00e5ff' }}>密碼已更新, 正在帶你前往登入…</p>
        ) : !token ? (
          <>
            <div style={errBox}>連結無效（缺少 token）</div>
            <Link to="/forgot-password" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>重新申請 →</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={errBox}>{error}</div>}
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="新密碼（至少 6 字元）" required minLength={6} style={input} />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="再次輸入新密碼" required minLength={6} style={input} />
            <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '更新中…' : '更新密碼'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
