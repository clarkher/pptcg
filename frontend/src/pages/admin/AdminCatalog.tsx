import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { catalogApi } from '../../api/catalog';
import { uploadImage } from '../../api/upload';
import { SeriesSetNav } from '../../components/SeriesSetNav';
import type { AdminCatalogCard, AdminInventoryRow, RarityDef, ConditionDef } from '../../types/catalog';

const inputStyle: React.CSSProperties = {
  background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: '#F1F5F9', padding: '5px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box',
};
const btn = (bg: string): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: bg, color: '#fff',
});

export function AdminCatalog() {
  const [language, setLanguage] = useState('zh');
  const [seriesKey, setSeriesKey] = useState('');
  const [setId, setSetId] = useState('');
  const [q, setQ] = useState('');
  const [hasWishlist, setHasWishlist] = useState(false);
  const [stockFilter, setStockFilter] = useState<'' | 'true' | 'false'>('');
  const [cards, setCards] = useState<AdminCatalogCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [rarities, setRarities] = useState<RarityDef[]>([]);
  const [conditions, setConditions] = useState<ConditionDef[]>([]);
  const [editing, setEditing] = useState<AdminCatalogCard | null>(null);

  useEffect(() => {
    catalogApi.rarities().then(setRarities).catch(() => {});
    catalogApi.conditions().then(setConditions).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.catalog({ language, seriesKey, setId, q: q.trim(), hasWishlist: hasWishlist ? 'true' : '', inStock: stockFilter, limit: 60 }) as { cards: AdminCatalogCard[] };
      setCards(res.cards);
    } finally { setLoading(false); }
  }, [language, seriesKey, setId, q, hasWishlist, stockFilter]);

  useEffect(() => { load(); }, [load]);

  const rarityColor = (code: string | null) => rarities.find((r) => r.code === code)?.color || '#64748b';

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', marginBottom: 6 }}>卡片管理</h1>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>就地改價格／數量、看敲碗人數、修目錄資料、換圖。</p>

      <SeriesSetNav
        language={language} onLanguage={setLanguage}
        seriesKey={seriesKey} onSeries={setSeriesKey}
        setId={setId} onSet={setSetId}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋卡名/卡號"
          style={{ ...inputStyle, width: 200 }} />
        <button onClick={() => setHasWishlist((v) => !v)} style={btn(hasWishlist ? '#2563EB' : 'rgba(255,255,255,0.06)')}>
          {hasWishlist ? '☑' : '☐'} 有人敲碗
        </button>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as any)} style={{ ...inputStyle, width: 130 }}>
          <option value="">全部庫存</option>
          <option value="true">有庫存</option>
          <option value="false">無庫存</option>
        </select>
        {loading && <span style={{ fontSize: 12, color: '#475569' }}>載入中...</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.id} onClick={() => setEditing(c)} style={{
            background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 8, cursor: 'pointer', position: 'relative',
          }}>
            {c.rarity && <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 9, fontWeight: 800, color: '#fff', background: rarityColor(c.rarity), padding: '1px 5px', borderRadius: 4 }}>{c.rarity}</span>}
            {c.wishlistCount > 0 && <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 800, color: '#60A5FA', background: 'rgba(96,165,250,0.15)', padding: '1px 5px', borderRadius: 4 }}>🔔 {c.wishlistCount}</span>}
            <img src={c.imageHigh || c.image} alt={c.name} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'contain', background: '#09091a', borderRadius: 6 }} />
            <p style={{ fontSize: 12, color: '#E2E8F0', fontWeight: 600, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
            <p style={{ fontSize: 10, color: '#475569' }}>{c.number} · {c.setName}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: c.totalQty > 0 ? '#FBBF24' : '#475569' }}>
                {c.minPrice != null ? `NT$${c.minPrice.toLocaleString()}` : '—'}
              </span>
              <span style={{ fontSize: 11, color: c.totalQty > 0 ? '#34D399' : '#475569' }}>庫存 {c.totalQty}</span>
            </div>
          </div>
        ))}
      </div>
      {!loading && cards.length === 0 && <p style={{ color: '#475569', textAlign: 'center', padding: 40 }}>沒有符合的卡片</p>}

      {editing && (
        <CardEditModal
          card={editing}
          rarities={rarities}
          conditions={conditions}
          onClose={() => setEditing(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

// ── Edit modal ──────────────────────────────────────────────
function CardEditModal({ card, rarities, conditions, onClose, onChanged }: {
  card: AdminCatalogCard; rarities: RarityDef[]; conditions: ConditionDef[];
  onClose: () => void; onChanged: () => void;
}) {
  const [inv, setInv] = useState<AdminInventoryRow[]>(card.inventory);
  const [image, setImage] = useState(card.image);
  const [name, setName] = useState(card.name);
  const [rarity, setRarity] = useState(card.rarity || '');
  const [tab, setTab] = useState<'inv' | 'data' | 'wish'>('inv');
  const [wishers, setWishers] = useState<{ id: string; user: { username: string; email: string }; createdAt: string }[]>([]);
  const [newVariant, setNewVariant] = useState('標準');
  const [newCond, setNewCond] = useState(conditions[0]?.code || 'NM');
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab === 'wish') adminApi.cardWishlist(card.id).then((d) => setWishers(d as any)).catch(() => setWishers([]));
  }, [tab, card.id]);

  const saveInvRow = async (row: AdminInventoryRow) => {
    await adminApi.updateInventory(row.id, { price: row.price, quantity: row.quantity, variant: row.variant, condition: row.condition });
    onChanged();
  };
  const delInvRow = async (id: string) => {
    await adminApi.deleteInventory(id);
    setInv((p) => p.filter((r) => r.id !== id));
    onChanged();
  };
  const addInv = async () => {
    if (!newPrice) return;
    setBusy(true);
    try {
      const created = await adminApi.createInventory({
        cardId: card.id, cardName: card.name, cardGame: 'pokemon', cardImage: card.imageHigh || card.image,
        language: card.language, variant: newVariant, condition: newCond, price: parseFloat(newPrice), quantity: parseInt(newQty) || 0,
      }) as AdminInventoryRow;
      setInv((p) => [...p, created]);
      setNewPrice(''); setNewQty('1');
      onChanged();
    } finally { setBusy(false); }
  };
  const saveData = async () => {
    await adminApi.updateCard(card.id, { name, rarity: rarity || null, image });
    onChanged();
  };
  const onUpload = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadImage(file);
      setImage(url);
      await adminApi.updateCard(card.id, { image: url });
      onChanged();
    } finally { setBusy(false); }
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button onClick={() => setTab(key)} style={{
      padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
      background: tab === key ? 'rgba(124,58,237,0.2)' : 'transparent', color: tab === key ? '#C4B5FD' : '#64748B',
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#0A0A18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: 560, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <img src={image || card.imageHigh || ''} alt={card.name} style={{ width: 100, aspectRatio: '3/4', objectFit: 'contain', background: '#09091a', borderRadius: 8 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC' }}>{card.name}</h3>
            <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>{card.id}</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {tabBtn('inv', '庫存')}
              {tabBtn('data', '資料/換圖')}
              {tabBtn('wish', `敲碗 ${card.wishlistCount}`)}
            </div>
          </div>
        </div>

        {tab === 'inv' && (
          <div>
            {inv.length === 0 && <p style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>尚無庫存，新增一筆變體。</p>}
            {inv.map((row, i) => (
              <div key={row.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input value={row.variant} onChange={(e) => setInv((p) => p.map((r, j) => j === i ? { ...r, variant: e.target.value } : r))} style={{ ...inputStyle, width: 90 }} />
                <select value={row.condition} onChange={(e) => setInv((p) => p.map((r, j) => j === i ? { ...r, condition: e.target.value } : r))} style={{ ...inputStyle, width: 70 }}>
                  {conditions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <input type="number" value={row.price} onChange={(e) => setInv((p) => p.map((r, j) => j === i ? { ...r, price: parseFloat(e.target.value) || 0 } : r))} onBlur={() => saveInvRow(row)} style={{ ...inputStyle, width: 80 }} placeholder="價格" />
                <input type="number" value={row.quantity} onChange={(e) => setInv((p) => p.map((r, j) => j === i ? { ...r, quantity: parseInt(e.target.value) || 0 } : r))} onBlur={() => saveInvRow(row)} style={{ ...inputStyle, width: 60 }} placeholder="數量" />
                <button onClick={() => delInvRow(row.id)} style={btn('rgba(239,68,68,0.15)')}>✕</button>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={newVariant} onChange={(e) => setNewVariant(e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="變體" />
              <select value={newCond} onChange={(e) => setNewCond(e.target.value)} style={{ ...inputStyle, width: 70 }}>
                {conditions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ ...inputStyle, width: 80 }} placeholder="價格" />
              <input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ ...inputStyle, width: 60 }} placeholder="數量" />
              <button disabled={busy} onClick={addInv} style={btn('#7C3AED')}>+ 新增</button>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, color: '#94A3B8' }}>卡名
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: '#94A3B8' }}>稀有度
              <select value={rarity} onChange={(e) => setRarity(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                <option value="">（無）</option>
                {rarities.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 11, color: '#94A3B8' }}>圖片 URL
              <input value={image} onChange={(e) => setImage(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: '#94A3B8' }}>或上傳換圖
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#94A3B8' }} />
            </label>
            <button disabled={busy} onClick={saveData} style={{ ...btn('#7C3AED'), padding: '8px 14px' }}>儲存資料</button>
          </div>
        )}

        {tab === 'wish' && (
          <div>
            {wishers.length === 0 ? <p style={{ fontSize: 12, color: '#475569' }}>目前沒有人敲碗。</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {wishers.map((w) => (
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#CBD5E1', padding: '6px 10px', background: '#0D0D1C', borderRadius: 8 }}>
                    <span>{w.user.username} <span style={{ color: '#475569' }}>({w.user.email})</span></span>
                    <span style={{ color: '#475569' }}>{new Date(w.createdAt).toLocaleDateString('zh-TW')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={onClose} style={{ marginTop: 16, ...btn('rgba(255,255,255,0.08)'), padding: '8px 16px' }}>關閉</button>
      </div>
    </div>
  );
}
