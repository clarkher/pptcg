import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px', background: '#050508',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 380, textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24, padding: '36px 28px', color: '#F1F5F9',
};

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('fail'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('fail'));
  }, [params]);

  return (
    <div style={wrap}>
      <div style={card}>
        {status === 'loading' && <p style={{ color: '#94a3b8' }}>驗證中…</p>}
        {status === 'ok' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#00e5ff', marginBottom: 10 }}>信箱驗證成功 🎉</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>你的帳號已完成驗證，現在可以上架與結帳了。</p>
            <Link to="/" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>回首頁 →</Link>
          </>
        )}
        {status === 'fail' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#F87171', marginBottom: 10 }}>連結無效或已過期</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>請登入後於頂部提示重新寄送驗證信。</p>
            <Link to="/login" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>前往登入 →</Link>
          </>
        )}
      </div>
    </div>
  );
}
