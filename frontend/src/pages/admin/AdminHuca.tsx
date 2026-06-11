import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface HucaCard {
  id: number; setCode: string; cardNumber: string; nameZh: string;
  lowPriceTwd: number | null; highPriceTwd: number | null; offerCount: number | null; priceUpdatedAt: string | null;
}

export default function AdminHuca() {
  const [cards, setCards] = useState<HucaCard[]>([]);
  const [stats, setStats] = useState({ total: 0, withPrice: 0, highLiq: 0 });
  const [q, setQ] = useState('');
  const [hasPrice, setHasPrice] = useState(true);
  const [sort, setSort] = useState('offers');

  useEffect(() => {
    api.get('/admin/huca', { params: { q, hasPrice: String(hasPrice), sort } })
      .then(r => { setCards(r.data.cards); setStats({ total: r.data.total, withPrice: r.data.withPrice, highLiq: r.data.highLiq }); })
      .catch(() => {});
  }, [q, hasPrice, sort]);

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: '#CBD5E1', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const th: React.CSSProperties = { ...cell, color: '#64748B', fontWeight: 700, textAlign: 'left' };
  const stat = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{val.toLocaleString()}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', marginBottom: 16 }}>Huca 行情（套利比價基準）</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {stat('📦 總卡數', stats.total, '#F1F5F9')}
        {stat('💰 有價格', stats.withPrice, '#4ADE80')}
        {stat('🔥 成交≥10（可當基準）', stats.highLiq, '#F59E0B')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋繁中名/SKU"
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', fontSize: 13, width: 220 }} />
        <label style={{ fontSize: 13, color: '#94A3B8', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={hasPrice} onChange={e => setHasPrice(e.target.checked)} /> 只看有價格
        </label>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', fontSize: 13 }}>
          <option value="offers">成交數多</option>
          <option value="price">低價優先</option>
          <option value="updated">最近更新</option>
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>番號</th><th style={th}>繁中名</th><th style={th}>低價</th><th style={th}>高價</th><th style={th}>成交數</th><th style={th}>更新</th><th style={th}></th></tr></thead>
        <tbody>{cards.map(c => (
          <tr key={c.id}>
            <td style={cell}>{c.setCode}-{c.cardNumber}</td>
            <td style={cell}>{c.nameZh}</td>
            <td style={{ ...cell, color: '#4ADE80' }}>{c.lowPriceTwd != null ? `NT$${c.lowPriceTwd.toLocaleString()}` : '—'}</td>
            <td style={cell}>{c.highPriceTwd != null ? `NT$${c.highPriceTwd.toLocaleString()}` : '—'}</td>
            <td style={cell}>{c.offerCount ?? '—'}</td>
            <td style={cell}>{c.priceUpdatedAt ? new Date(c.priceUpdatedAt).toLocaleDateString('zh-TW') : '—'}</td>
            <td style={cell}><a href={`https://huca.tw/cards/${c.id}/`} target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>↗</a></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
