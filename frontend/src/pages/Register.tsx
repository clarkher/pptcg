import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '註冊失敗，請稍後再試');
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
          <h1 className="text-2xl font-black text-white">建立帳號</h1>
          <p className="text-slate-500 text-sm mt-1">加入屁TCG交易平台</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-xl p-3 text-sm text-center font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
              {error}
            </div>
          )}

          {[
            { label: 'Email', type: 'email', value: email, set: setEmail, ph: 'your@email.com', min: undefined },
            { label: '帳號名稱', type: 'text', value: username, set: setUsername, ph: '你的暱稱', min: 2 },
            { label: '密碼', type: 'password', value: password, set: setPassword, ph: '至少 6 個字元', min: 6 },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 tracking-wide uppercase">{f.label}</label>
              <input type={f.type} value={f.value} onChange={(e) => f.set(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-slate-100 focus:outline-none text-sm"
                style={inputStyle} placeholder={f.ph} required minLength={f.min} />
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity active:opacity-80"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 24px rgba(124,58,237,0.35)' }}>
            {loading ? '建立中...' : '建立帳號'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          已有帳號？{' '}
          <Link to="/login" className="font-semibold" style={{ color: '#A78BFA' }}>立即登入</Link>
        </p>
      </div>
    </div>
  );
}
