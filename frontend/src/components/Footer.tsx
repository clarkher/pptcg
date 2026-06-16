import { useNavigate } from 'react-router-dom';

// 綠界賣家資料驗證通過的客服信箱 —— 必須與賣家後台資料「完全一致」才會通過審核
const SUPPORT_EMAIL = 'clark042007@gmail.com';

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function Footer() {
  const navigate = useNavigate();

  const linkStyle: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: '#94A3B8', fontSize: 13, fontWeight: 500, transition: 'color 0.15s',
  };

  return (
    <footer
      className="site-footer"
      style={{
        position: 'relative',
        marginTop: 48,
        borderTop: '1px solid rgba(167,139,250,0.12)',
        background: 'rgba(6,6,15,0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Top neon accent line */}
      <div style={{
        position: 'absolute', top: -1, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.45), rgba(34,211,238,0.3), transparent)',
      }} />

      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '32px 24px 28px',
        display: 'flex', flexWrap: 'wrap', gap: 32,
        justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        {/* Brand */}
        <div style={{ minWidth: 180 }}>
          <div style={{
            fontSize: 18, fontWeight: 900, letterSpacing: 0.5,
            background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            屁TCG · 卡拍拍
          </div>
          <p style={{ fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 1.7, maxWidth: 260 }}>
            台灣集換式卡牌（TCG）市集，安全買賣寶可夢、遊戲王閃卡與稀有卡。
          </p>
        </div>

        {/* Contact + links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, marginBottom: 8 }}>
              客服聯絡
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                color: '#A78BFA', fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}
            >
              <MailIcon />
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <button style={linkStyle} onClick={() => navigate('/terms')}>服務條款</button>
            <button style={linkStyle} onClick={() => navigate('/privacy')}>隱私權政策</button>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: '14px 24px',
        textAlign: 'center',
        fontSize: 11, color: '#475569',
      }}>
        © 2026 屁TCG（pipicards.com）· 本網站交易由綠界科技 ECPay 提供金流服務
      </div>
    </footer>
  );
}
