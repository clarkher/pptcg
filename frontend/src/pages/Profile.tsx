import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList } from 'lucide-react';
import { Header } from '../components/Header';
import { useAuthStore } from '../stores/authStore';
import { api } from '../api/client';

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

// ── LINE subscription card ────────────────────────────────────

interface BindToken { code: string; expiresAt: string }

function LineSubscribeCard({ lineBound, onBindSuccess }: { lineBound: boolean; onBindSuccess: () => void }) {
  const [bound, setBound]         = useState(lineBound);
  const [token, setToken]         = useState<BindToken | null>(null);
  const [loading, setLoading]     = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [botLink, setBotLink]     = useState<string | null>(null);
  const [secsLeft, setSecsLeft]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch bot link once
  useEffect(() => {
    api.get('/line/info').then(r => setBotLink(r.data.botLink)).catch(() => {});
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!token) { setSecsLeft(0); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(token.expiresAt).getTime() - Date.now()) / 1000));
      setSecsLeft(diff);
      if (diff === 0) clearInterval(timerRef.current!);
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current!);
  }, [token]);

  async function generateCode() {
    setLoading(true);
    try {
      const { data } = await api.post('/line/bind-token');
      setToken(data);
    } finally {
      setLoading(false);
    }
  }

  async function unbind() {
    setUnbinding(true);
    try {
      await api.delete('/line/unbind');
      setBound(false);
      onBindSuccess();
    } finally {
      setUnbinding(false);
    }
  }

  function copyCode() {
    if (token) {
      navigator.clipboard.writeText(token.code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const expired = secsLeft === 0 && !!token;
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');

  return (
    <div style={{
      borderRadius: 20, padding: '20px',
      background: bound
        ? 'linear-gradient(135deg, rgba(0,185,0,0.08) 0%, rgba(6,10,30,0.85) 100%)'
        : 'rgba(255,255,255,0.04)',
      border: `1px solid ${bound ? 'rgba(0,185,0,0.25)' : 'rgba(255,255,255,0.08)'}`,
      backdropFilter: 'blur(12px)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#00B900', boxShadow: '0 0 16px rgba(0,185,0,0.35)',
          fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -1,
        }}>L</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>LINE 套利通知</p>
          <p style={{ fontSize: 12, color: bound ? '#4ADE80' : '#64748B' }}>
            {bound ? '✅ 已綁定 · 通知啟用中' : '尚未綁定 LINE 帳號'}
          </p>
        </div>
      </div>

      {bound ? (
        /* ── Bound state ── */
        <div>
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>
            有套利機會時卡報報會主動推播通知，不需要手動查詢。
          </p>
          <button
            onClick={unbind}
            disabled={unbinding}
            style={{
              padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.07)', color: '#F87171',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: unbinding ? 0.5 : 1,
            }}
          >
            {unbinding ? '解除中…' : '解除 LINE 綁定'}
          </button>
        </div>
      ) : token && !expired ? (
        /* ── Binding code shown ── */
        <div>
          {/* Step 1 */}
          {botLink && (
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12, lineHeight: 1.7 }}>
              步驟 1 ·{' '}
              <a href={botLink} target="_blank" rel="noreferrer"
                style={{ color: '#4ADE80', textDecoration: 'underline' }}>
                加入卡報報官方 LINE 帳號 ↗
              </a>
            </p>
          )}
          {/* Step 2 */}
          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 1.7 }}>
            步驟 {botLink ? '2' : '1'} · 在 LINE 對話框輸入以下綁定碼：
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          }}>
            {/* Big code display */}
            <div style={{
              flex: 1, borderRadius: 14, padding: '14px 18px',
              background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: 'monospace', fontSize: 34, fontWeight: 900,
                letterSpacing: 10, color: '#F8FAFC', lineHeight: 1,
              }}>{token.code}</p>
              <p style={{ fontSize: 11, color: secsLeft < 60 ? '#F87171' : '#64748B', marginTop: 8 }}>
                {secsLeft < 60 ? '⚠️' : '⏱'} 剩餘 {mm}:{ss}
              </p>
            </div>
            <button
              onClick={copyCode}
              style={{
                padding: '10px 14px', borderRadius: 12,
                border: '1px solid rgba(139,92,246,0.35)',
                background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(139,92,246,0.1)',
                color: copied ? '#4ADE80' : '#A78BFA',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{copied ? '✓ 已複製' : '複製'}</button>
          </div>
          <button
            onClick={generateCode}
            disabled={loading}
            style={{
              fontSize: 12, color: '#475569', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, textDecoration: 'underline',
            }}
          >重新產生綁定碼</button>
        </div>
      ) : (
        /* ── Initial / expired state ── */
        <div>
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 16, lineHeight: 1.6 }}>
            {expired
              ? '⏰ 綁定碼已過期，請重新產生。'
              : '綁定你的 LINE 帳號，卡拍拍出現套利機會時立即通知。'}
          </p>
          <button
            onClick={generateCode}
            disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 14,
              border: '1px solid rgba(0,185,0,0.35)',
              background: 'rgba(0,185,0,0.08)', color: '#4ADE80',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '產生中…' : expired ? '重新產生綁定碼' : '取得 LINE 綁定碼'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Profile page ──────────────────────────────────────────────

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
          </div>
        </div>

        {/* LINE subscription */}
        <LineSubscribeCard
          lineBound={!!user.lineBound}
          onBindSuccess={refreshUser}
        />

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
