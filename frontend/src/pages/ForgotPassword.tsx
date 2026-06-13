import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
  border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  width: '100%', padding: '15px', borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 15,
  color: '#000', cursor: 'pointer', background: 'linear-gradient(135deg, #00e5ff, #00b8cc)', marginTop: 16,
};

export function ForgotPassword() {
  const { forgotPassword } = useAuthStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await forgotPassword(email); } finally { setLoading(false); setSent(true); }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>忘記密碼</h2>
        {sent ? (
          <>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '12px 0 24px' }}>
              若該信箱有註冊帳號，重設連結已寄出，請查收信箱（含垃圾信匣）。
            </p>
            <Link to="/login" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>回登入 →</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 18px' }}>輸入註冊用的 Email，我們會寄重設連結給你。</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required style={input} />
            <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '寄送中…' : '寄送重設連結'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
