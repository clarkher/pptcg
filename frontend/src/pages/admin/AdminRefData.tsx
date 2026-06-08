import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import type { RarityDef, ConditionDef, SeriesDef } from '../../types/catalog';

const inputStyle: React.CSSProperties = {
  background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: '#F1F5F9', padding: '6px 8px', fontSize: 12, boxSizing: 'border-box',
};
const btn = (bg: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: bg, color: '#fff',
});

type Tab = 'rarity' | 'series' | 'condition';

export function AdminRefData() {
  const [tab, setTab] = useState<Tab>('rarity');

  const tabBtn = (key: Tab, label: string) => (
    <button onClick={() => setTab(key)} style={{
      padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
      background: tab === key ? 'rgba(124,58,237,0.2)' : 'transparent', color: tab === key ? '#C4B5FD' : '#64748B',
    }}>{label}</button>
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', marginBottom: 6 }}>資料管理</h1>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>管理稀有度、系列、品相的受控詞彙。刪除使用中的項目會提示影響數量。</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {tabBtn('rarity', '稀有度')}
        {tabBtn('series', '系列')}
        {tabBtn('condition', '品相')}
      </div>
      {tab === 'rarity' && <RarityTab />}
      {tab === 'series' && <SeriesTab />}
      {tab === 'condition' && <ConditionTab />}
    </div>
  );
}

function RarityTab() {
  const [items, setItems] = useState<RarityDef[]>([]);
  const [draft, setDraft] = useState({ code: '', label: '', color: '#64748b', sortOrder: 0 });
  const load = useCallback(() => { adminApi.rarities().then((d) => setItems(d as RarityDef[])); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (r: RarityDef) => { await adminApi.updateRarity(r.id, r as unknown as Record<string, unknown>); load(); };
  const create = async () => { if (!draft.code || !draft.label) return; await adminApi.createRarity(draft); setDraft({ code: '', label: '', color: '#64748b', sortOrder: 0 }); load(); };
  const del = async (r: RarityDef) => {
    const res = await adminApi.deleteRarity(r.id) as { inUseCount: number };
    if (res.inUseCount > 0) alert(`已刪除。注意：原有 ${res.inUseCount} 張卡使用「${r.code}」，請至卡片管理修正。`);
    load();
  };

  return (
    <div>
      {items.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={r.code} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} style={{ ...inputStyle, width: 70 }} />
          <input value={r.label} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inputStyle, width: 180 }} />
          <input type="color" value={r.color} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} style={{ width: 36, height: 30, background: 'none', border: 'none' }} />
          <input type="number" value={r.sortOrder} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, sortOrder: parseInt(e.target.value) || 0 } : x))} style={{ ...inputStyle, width: 60 }} />
          <button onClick={() => save(r)} style={btn('#7C3AED')}>儲存</button>
          <button onClick={() => del(r)} style={btn('rgba(239,68,68,0.15)')}>刪除</button>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input placeholder="code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} style={{ ...inputStyle, width: 70 }} />
        <input placeholder="顯示名稱" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} style={{ ...inputStyle, width: 180 }} />
        <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 36, height: 30, background: 'none', border: 'none' }} />
        <input type="number" placeholder="排序" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, width: 60 }} />
        <button onClick={create} style={btn('#16A34A')}>+ 新增</button>
      </div>
    </div>
  );
}

function ConditionTab() {
  const [items, setItems] = useState<ConditionDef[]>([]);
  const [draft, setDraft] = useState({ code: '', label: '', sortOrder: 0 });
  const load = useCallback(() => { adminApi.conditions().then((d) => setItems(d as ConditionDef[])); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (c: ConditionDef) => { await adminApi.updateCondition(c.id, c as unknown as Record<string, unknown>); load(); };
  const create = async () => { if (!draft.code || !draft.label) return; await adminApi.createCondition(draft); setDraft({ code: '', label: '', sortOrder: 0 }); load(); };
  const del = async (c: ConditionDef) => {
    const res = await adminApi.deleteCondition(c.id) as { inUseCount: number };
    if (res.inUseCount > 0) alert(`已刪除。注意：原有 ${res.inUseCount} 筆庫存使用「${c.code}」。`);
    load();
  };

  return (
    <div>
      {items.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={c.code} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} style={{ ...inputStyle, width: 80 }} />
          <input value={c.label} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} style={{ ...inputStyle, width: 200 }} />
          <input type="number" value={c.sortOrder} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, sortOrder: parseInt(e.target.value) || 0 } : x))} style={{ ...inputStyle, width: 60 }} />
          <button onClick={() => save(c)} style={btn('#7C3AED')}>儲存</button>
          <button onClick={() => del(c)} style={btn('rgba(239,68,68,0.15)')}>刪除</button>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input placeholder="code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} style={{ ...inputStyle, width: 80 }} />
        <input placeholder="顯示名稱" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} style={{ ...inputStyle, width: 200 }} />
        <input type="number" placeholder="排序" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, width: 60 }} />
        <button onClick={create} style={btn('#16A34A')}>+ 新增</button>
      </div>
    </div>
  );
}

function SeriesTab() {
  const [language, setLanguage] = useState('zh');
  const [items, setItems] = useState<SeriesDef[]>([]);
  const [draft, setDraft] = useState({ key: '', name: '', logo: '', sortOrder: 0 });
  const load = useCallback(() => { adminApi.seriesDefs(language).then((d) => setItems(d as SeriesDef[])); }, [language]);
  useEffect(() => { load(); }, [load]);

  const save = async (s: SeriesDef) => { await adminApi.updateSeriesDef(s.id, s as unknown as Record<string, unknown>); load(); };
  const create = async () => { if (!draft.key || !draft.name) return; await adminApi.createSeriesDef({ ...draft, language }); setDraft({ key: '', name: '', logo: '', sortOrder: 0 }); load(); };
  const del = async (s: SeriesDef) => {
    const res = await adminApi.deleteSeriesDef(s.id) as { inUseCount: number };
    if (res.inUseCount > 0) alert(`已刪除。注意：原有 ${res.inUseCount} 張卡屬於系列「${s.key}」。`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['zh', 'ja', 'en'].map((l) => (
          <button key={l} onClick={() => setLanguage(l)} style={btn(language === l ? '#7C3AED' : 'rgba(255,255,255,0.06)')}>
            {l === 'zh' ? '繁中' : l === 'ja' ? '日文' : '英文'}
          </button>
        ))}
      </div>
      {items.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={s.key} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} style={{ ...inputStyle, width: 80 }} />
          <input value={s.name} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...inputStyle, width: 180 }} />
          <input placeholder="logo URL" value={s.logo || ''} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, logo: e.target.value } : x))} style={{ ...inputStyle, width: 150 }} />
          <input type="number" value={s.sortOrder} onChange={(e) => setItems((p) => p.map((x, j) => j === i ? { ...x, sortOrder: parseInt(e.target.value) || 0 } : x))} style={{ ...inputStyle, width: 60 }} />
          <button onClick={() => save(s)} style={btn('#7C3AED')}>儲存</button>
          <button onClick={() => del(s)} style={btn('rgba(239,68,68,0.15)')}>刪除</button>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input placeholder="key" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} style={{ ...inputStyle, width: 80 }} />
        <input placeholder="名稱" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...inputStyle, width: 180 }} />
        <input placeholder="logo URL" value={draft.logo} onChange={(e) => setDraft({ ...draft, logo: e.target.value })} style={{ ...inputStyle, width: 150 }} />
        <input type="number" placeholder="排序" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, width: 60 }} />
        <button onClick={create} style={btn('#16A34A')}>+ 新增</button>
      </div>
    </div>
  );
}
