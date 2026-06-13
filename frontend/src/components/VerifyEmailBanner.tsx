import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function VerifyEmailBanner() {
  const { user, resendVerification } = useAuthStore();
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  // 只在「明確未驗證」時顯示：emailVerified===false 才秀 banner。
  // undefined（舊的 localStorage 快取、尚未被 /auth/me 更新）視為未知，不顯示，避免誤擾已驗證用戶。
  if (!user || user.emailVerified !== false) return null;

  const resend = async () => {
    if (cooldown) return;
    setCooldown(true);
    try { await resendVerification(); setSent(true); } catch { /* ignore */ }
    setTimeout(() => setCooldown(false), 60_000); // 60s 冷卻
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 16px', fontSize: 13, fontWeight: 600,
      color: '#FCD34D', background: 'rgba(251,191,36,0.08)',
      borderBottom: '1px solid rgba(251,191,36,0.2)',
    }}>
      <span>📧 你的信箱尚未驗證，上架與結帳前請先完成驗證。</span>
      <button onClick={resend} disabled={cooldown} style={{
        border: '1px solid rgba(251,191,36,0.4)', background: 'transparent',
        color: cooldown ? '#94a3b8' : '#FCD34D', borderRadius: 10, padding: '5px 12px',
        fontSize: 12, fontWeight: 700, cursor: cooldown ? 'default' : 'pointer',
      }}>
        {sent ? '已重新寄出' : cooldown ? '請稍候…' : '重新寄送驗證信'}
      </button>
    </div>
  );
}
