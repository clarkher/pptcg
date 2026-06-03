import { useNavigate } from 'react-router-dom';
import { type ReactNode } from 'react';

interface Props {
  title: string;
  right?: ReactNode;
  /** Legacy: pass a callback to handle back navigation manually */
  back?: () => void;
  /** New: set to true to show a back button that calls navigate(-1) */
  showBack?: boolean;
}

export function Header({ title, right, back, showBack }: Props) {
  const navigate = useNavigate();

  const handleBack = back ?? (() => navigate(-1));
  const hasBack = back !== undefined || showBack;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '48px 16px 12px',
      background: 'rgba(6,6,15,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {hasBack && (
        <button onClick={handleBack} style={{
          width: 34, height: 34, borderRadius: 12, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#94A3B8', cursor: 'pointer', fontSize: 16,
        }}>←</button>
      )}
      <h1 style={{ flex: 1, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.4 }}>{title}</h1>
      {right && <div>{right}</div>}
    </div>
  );
}
