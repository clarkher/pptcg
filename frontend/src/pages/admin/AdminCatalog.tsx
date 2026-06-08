import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { catalogApi } from '../../api/catalog';
import { uploadImage } from '../../api/upload';
import { SeriesSetNav } from '../../components/SeriesSetNav';
import type { AdminCatalogCard, AdminInventoryRow, RarityDef, ConditionDef } from '../../types/catalog';

const inputStyle: React.CSSProperties = {
  background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: '#F1F5F9', padding: '6px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box',
};
const btn = (bg: string): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: bg, color: '#fff',
});
const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
  background: active ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'rgba(255,255,255,0.05)',
  color: active ? '#fff' : '#94A3B8',
});

export function AdminCatalog() {
  const [searchParams] = useSearchParams();
  const [language, setLanguage] = useState(searchParams.get('lang') || 'zh');
  const [seriesKey, setSeriesKey] = useState('');
  const [setId, setSetId] = useState('');
  const [q, setQ] = useState(searchParams.get('q') || '');
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
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as '' | 'true' | 'false')} style={{ ...inputStyle, width: 130 }}>
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
interface CellState { price: string; qty: string; id?: string; saving?: boolean; saved?: boolean }

function CardEditModal({ card, rarities, conditions, onClose, onChanged }: {
  card: AdminCatalogCard; rarities: RarityDef[]; conditions: ConditionDef[];
  onClose: () => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<'inv' | 'data' | 'wish'>('inv');

  // 庫存：以 (variant|condition) 為 key 的草稿表
  const cellKey = (v: string, c: string) => `${v}|${c}`;
  const [draft, setDraft] = useState<Record<string, CellState>>(() => {
    const d: Record<string, CellState> = {};
    for (const r of card.inventory) d[cellKey(r.variant, r.condition)] = { price: String(r.price), qty: String(r.quantity), id: r.id };
    return d;
  });
  const [variants, setVariants] = useState<string[]>(() => {
    const s = new Set<string>(['標準']);
    card.inventory.forEach((r) => s.add(r.variant));
    return [...s];
  });
  const [activeVariant, setActiveVariant] = useState(variants[0]);

  const getCell = (v: string, c: string): CellState => draft[cellKey(v, c)] || { price: '', qty: '' };
  const setCell = (v: string, c: string, patch: Partial<CellState>) =>
    setDraft((p) => ({ ...p, [cellKey(v, c)]: { ...getCell(v, c), ...patch } }));

  const saveCell = async (v: string, c: string) => {
    const cell = getCell(v, c);
    const price = parseFloat(cell.price) || 0;
    const qty = parseInt(cell.qty) || 0;
    if (!cell.id && price <= 0 && qty <= 0) return; // 空格不建立
    setCell(v, c, { saving: true, saved: false });
    try {
      if (cell.id) {
        await adminApi.updateInventory(cell.id, { price, quantity: qty, variant: v, condition: c });
      } else {
        const created = await adminApi.createInventory({
          cardId: card.id, cardName: card.name, cardGame: 'pokemon',
          cardImage: card.imageHigh || card.image, language: card.language,
          variant: v, condition: c, price, quantity: qty,
        }) as AdminInventoryRow;
        setCell(v, c, { id: created.id });
      }
      setCell(v, c, { saving: false, saved: true });
      onChanged();
    } catch {
      setCell(v, c, { saving: false });
    }
  };

  const delCell = async (v: string, c: string) => {
    const cell = getCell(v, c);
    if (cell.id) { await adminApi.deleteInventory(cell.id); onChanged(); }
    setCell(v, c, { price: '', qty: '', id: undefined, saved: false });
  };

  const addVariant = () => {
    const name = window.prompt('變體名稱（例：反射閃 / 異圖 / 金卡）');
    if (!name) return;
    if (!variants.includes(name)) setVariants((p) => [...p, name]);
    setActiveVariant(name);
  };

  // 資料/換圖
  const [image, setImage] = useState(card.image);
  const [name, setName] = useState(card.name);
  const [rarity, setRarity] = useState(card.rarity || '');
  const [busy, setBusy] = useState(false);
  const saveData = async () => { setBusy(true); try { await adminApi.updateCard(card.id, { name, rarity: rarity || null, image }); onChanged(); } finally { setBusy(false); } };
  const onUpload = async (file: File) => { setBusy(true); try { const url = await uploadImage(file); setImage(url); await adminApi.updateCard(card.id, { image: url }); onChanged(); } finally { setBusy(false); } };

  // 敲碗名單
  const [wishers, setWishers] = useState<{ id: string; user: { username: string; email: string }; createdAt: string }[]>([]);
  useEffect(() => {
    if (tab === 'wish') adminApi.cardWishlist(card.id).then((d) => setWishers(d as typeof wishers)).catch(() => setWishers([]));
  }, [tab, card.id]);

  const tabBtn = (key: typeof tab, label: string) => (
    <button onClick={() => setTab(key)} style={{
      padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
      background: tab === key ? 'rgba(124,58,237,0.2)' : 'transparent', color: tab === key ? '#C4B5FD' : '#64748B',
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#0A0A18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, width: 600, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <img src={image || card.imageHigh || ''} alt={card.name} style={{ width: 100, aspectRatio: '3/4', objectFit: 'contain', background: '#09091a', borderRadius: 8 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {card.rarity && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: rarities.find((r) => r.code === card.rarity)?.color || '#64748b', padding: '1px 6px', borderRadius: 4 }}>{card.rarity}</span>}
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC' }}>{card.name}</h3>
            </div>
            <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 8px' }}>{card.number} · {card.setName}</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {tabBtn('inv', '庫存')}
              {tabBtn('data', '資料/換圖')}
              {tabBtn('wish', `敲碗 ${card.wishlistCount}`)}
            </div>
          </div>
        </div>

        {tab === 'inv' && (
          <div>
            {/* 變體分頁 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {variants.map((v) => (
                <button key={v} onClick={() => setActiveVariant(v)} style={chip(activeVariant === v)}>{v}</button>
              ))}
              <button onClick={addVariant} style={{ ...chip(false), color: '#A78BFA' }}>＋ 變體</button>
            </div>

            {/* 品相表格：每列一個品相，填價格＋數量 */}
            <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 36px', gap: 0, fontSize: 11, fontWeight: 700, color: '#64748B', background: '#0D0D1C', padding: '8px 12px' }}>
                <span>品相</span><span>價格 NT$</span><span>數量</span><span></span>
              </div>
              {conditions.map((c) => {
                const cell = getCell(activeVariant, c.code);
                return (
                  <div key={c.code} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 36px', gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 12, color: '#E2E8F0' }}>{c.label}</span>
                    <input type="number" value={cell.price} placeholder="—"
                      onChange={(e) => setCell(activeVariant, c.code, { price: e.target.value })}
                      onBlur={() => saveCell(activeVariant, c.code)} style={inputStyle} />
                    <input type="number" value={cell.qty} placeholder="0"
                      onChange={(e) => setCell(activeVariant, c.code, { qty: e.target.value })}
                      onBlur={() => saveCell(activeVariant, c.code)} style={inputStyle} />
                    <span style={{ fontSize: 14, textAlign: 'center' }}>
                      {cell.saving ? '⏳' : cell.saved ? '✓' : cell.id ? <button onClick={() => delCell(activeVariant, c.code)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 13 }}>✕</button> : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>填好價格／數量後點其他地方即自動儲存。同卡號的不同印刷（反射閃／異圖…）用上方「＋ 變體」分頁。不同稀有度版本通常是不同卡號，請各自進貨。</p>
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
