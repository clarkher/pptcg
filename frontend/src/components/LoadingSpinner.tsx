export function LoadingSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 14 }}>
      <div style={{ position: 'relative', width: 44, height: 44 }}>
        {/* Static base ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid rgba(139,92,246,0.15)',
        }} />
        {/* Outer spinning ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#A78BFA',
          borderRightColor: 'rgba(139,92,246,0.35)',
          animation: 'spin 0.8s linear infinite',
          filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.7))',
        }} />
        {/* Inner counter-spinning ring */}
        <div style={{
          position: 'absolute', inset: 6, borderRadius: '50%',
          border: '1px solid rgba(34,211,238,0.2)',
          borderTopColor: '#22D3EE',
          animation: 'spin 1.2s linear infinite reverse',
          filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.6))',
        }} />
        {/* Center dot */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#A78BFA',
            boxShadow: '0 0 8px rgba(167,139,250,0.9), 0 0 16px rgba(167,139,250,0.5)',
            animation: 'pulse-dot 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>
      <p style={{ color: '#64748B', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>{text}</p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      boxShadow: '0 0 20px rgba(0,0,0,0.2)',
    }}>
      <div className="skeleton" style={{ aspectRatio: '3/4' }} />
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 11, width: '85%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 14, width: '40%', borderRadius: 4, marginTop: 4 }} />
      </div>
    </div>
  );
}
