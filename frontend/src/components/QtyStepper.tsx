import { Minus, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

interface Props {
  value: number;
  max: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

/** 數量步進器：− value +，夾在 1..max。 */
export function QtyStepper({ value, max, onChange, size = 'md', disabled }: Props) {
  const dim = size === 'sm' ? 26 : 34;
  const icon = size === 'sm' ? 13 : 15;
  const canDec = !disabled && value > 1;
  const canInc = !disabled && value < max;

  const btn = (active: boolean): CSSProperties => ({
    width: dim, height: dim, borderRadius: size === 'sm' ? 8 : 10, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.1)', cursor: active ? 'pointer' : 'not-allowed',
    background: 'rgba(255,255,255,0.05)', color: active ? '#E2E8F0' : '#475569',
    transition: 'background 0.15s',
  });

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 6 : 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button" aria-label="減少" disabled={!canDec}
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, value - 1)); }}
        style={btn(canDec)}
      >
        <Minus size={icon} />
      </button>
      <span style={{
        minWidth: size === 'sm' ? 18 : 24, textAlign: 'center', fontWeight: 800,
        color: '#F1F5F9', fontSize: size === 'sm' ? 13 : 15,
      }}>{value}</span>
      <button
        type="button" aria-label="增加" disabled={!canInc}
        onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, value + 1)); }}
        style={btn(canInc)}
      >
        <Plus size={icon} />
      </button>
    </div>
  );
}
