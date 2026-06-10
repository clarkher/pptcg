import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: ErrorInfo | null }

/**
 * Catches render-time errors anywhere in the tree and shows the actual message
 * on screen instead of a blank (dark) page. Critical for diagnosing mobile-only
 * crashes that don't reproduce on desktop.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // Also log to console for remote debugging tools
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100dvh', background: '#07070F', color: '#F1F5F9',
        fontFamily: 'system-ui, sans-serif', padding: '24px 18px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#F87171', marginBottom: 4 }}>⚠️ 頁面發生錯誤</p>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>請把這個畫面截圖回報，以便修正。</p>
        </div>

        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '14px', fontSize: 13, color: '#FCA5A5',
          fontFamily: 'monospace', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
        }}>
          {error.name}: {error.message}
        </div>

        {info?.componentStack && (
          <details style={{ fontSize: 11, color: '#64748B' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>技術細節（component stack）</summary>
            <pre style={{
              background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 12,
              overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{info.componentStack}</pre>
          </details>
        )}

        <button
          onClick={() => { this.setState({ error: null, info: null }); window.location.href = '/'; }}
          style={{
            marginTop: 8, padding: '12px', borderRadius: 12, border: 'none',
            background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          回首頁
        </button>
      </div>
    );
  }
}
