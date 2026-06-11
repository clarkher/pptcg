import { useState } from 'react';
import { api } from '../../api/client';

interface Hit {
  listingId: number; sellerId: number; cardKey: string; game: string; name: string; price: number;
  baseline: number; baselineSource: string; siteMin: number | null; profit: number; discount: number; condition: string;
}

const LANG: Record<string, string> = { pkmjp: '日文', pkmen: '英文', pkmtw: '繁中' };

export default function AdminKapai() {
  const [hits, setHits] = useState<Hit[]>([]);
  const [scanned, setScanned] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function scan() {
    setLoading(true); setErr('');
    try {
      const { data } = await api.get('/admin/kapai/scan');
      setHits(data.hits); setScanned(data.scanned);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? '掃描失敗');
    } finally {
      setLoading(false);
    }
  }

  const cell: React.CSSProperties = { padding: '9px 10px', fontSize: 13, color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const th: React.CSSProperties = { ...cell, color: '#64748B', fontWeight: 700, textAlign: 'left' };

  return (
    <div style={{ maxWidth: 900, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>卡報報監控</h2>
      <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
        日英卡（pkmjp/pkmen）對 Huca 嚴格比價：只看 perfect 裸卡、Huca 成交數≥10、售價≤市價70% 且省≥100。立即掃描<strong style={{ color: '#64748B' }}>不會推播</strong>。
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <button
          onClick={scan}
          disabled={loading}
          style={{
            padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.15)', color: '#C4B5FD',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? '掃描中…' : '🔍 立即掃描當前套利'}
        </button>
        {scanned != null && (
          <span style={{ fontSize: 13, color: '#94A3B8' }}>
            掃了 {scanned} 筆日英 perfect 卡 → 命中 <strong style={{ color: '#4ADE80' }}>{hits.length}</strong> 筆
          </span>
        )}
      </div>

      {err && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>⚠️ {err}</p>}

      {hits.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>番號</th><th style={th}>語言</th><th style={th}>卡名</th><th style={th}>卡拍拍售價</th>
            <th style={th}>行情基準</th><th style={th}>站內次低</th><th style={th}>省</th><th style={th}>折扣</th><th style={th}></th>
          </tr></thead>
          <tbody>{hits.map(h => (
            <tr key={h.listingId}>
              <td style={cell}>{h.cardKey}</td>
              <td style={cell}>{LANG[h.game] ?? h.game}</td>
              <td style={cell}>{h.name}</td>
              <td style={{ ...cell, color: '#4ADE80', fontWeight: 700 }}>NT${h.price.toLocaleString()}</td>
              <td style={cell}>NT${h.baseline.toLocaleString()}<span style={{ color: '#475569', fontSize: 11 }}>（{h.baselineSource}）</span></td>
              <td style={cell}>{h.siteMin != null ? `NT$${h.siteMin.toLocaleString()}` : '—'}</td>
              <td style={{ ...cell, color: '#F87171', fontWeight: 700 }}>NT${h.profit.toLocaleString()}</td>
              <td style={cell}>{Math.round(h.discount * 100)}%</td>
              <td style={cell}><a href={`https://trade.kapaipai.tw/shop/${h.sellerId}/${h.listingId}`} target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>↗</a></td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {scanned != null && hits.length === 0 && !loading && (
        <p style={{ fontSize: 13, color: '#64748B' }}>當前這批最新商品沒有符合嚴格條件的套利（很正常，真機會本來就稀少）。</p>
      )}
    </div>
  );
}
