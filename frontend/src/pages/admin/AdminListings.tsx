import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import type { Listing } from '../../types';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP'];
const GAMES = [{ value: 'yugioh', label: '⚔️ 遊戲王' }, { value: 'pokemon', label: '⚡ 寶可夢' }];

const EMPTY_FORM = {
  cardId: '', cardName: '', cardGame: 'yugioh', cardImage: '',
  condition: 'NM', price: '', quantity: '1', description: '',
};

export function AdminListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const loadListings = () => adminApi.getListings().then(setListings).finally(() => setLoading(false));
  useEffect(() => { loadListings(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (l: Listing) => {
    setEditing(l);
    setForm({
      cardId: l.cardId, cardName: l.cardName, cardGame: l.cardGame,
      cardImage: l.cardImage, condition: l.condition,
      price: String(l.price), quantity: String(l.quantity),
      description: l.description || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.cardName || !form.price) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        cardGame: form.cardGame as 'yugioh' | 'pokemon',
        condition: form.condition as 'NM' | 'LP' | 'MP' | 'HP',
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
      };
      if (editing) {
        const updated = await adminApi.updateListing(editing.id, data);
        setListings((prev) => prev.map((l) => (l.id === editing.id ? updated : l)));
      } else {
        const created = await adminApi.createListing(data);
        setListings((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個商品嗎？')) return;
    await adminApi.deleteListing(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  const handleToggleStatus = async (l: Listing) => {
    const newStatus = l.status === 'active' ? 'cancelled' : 'active';
    const updated = await adminApi.updateListing(l.id, { status: newStatus });
    setListings((prev) => prev.map((x) => (x.id === l.id ? updated : x)));
  };

  const filtered = listings.filter((l) =>
    !filter || l.cardName.toLowerCase().includes(filter.toLowerCase())
  );

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-slate-100 focus:outline-none";
  const inputStyle = { background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'inherit' };

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">商品管理</h2>
          <p className="text-slate-500 text-sm mt-1">{listings.length} 件商品</p>
        </div>
        <button onClick={openCreate}
          className="px-5 py-2.5 rounded-xl font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
          ＋ 新增商品
        </button>
      </div>

      {/* Search */}
      <input value={filter} onChange={(e) => setFilter(e.target.value)}
        placeholder="搜尋商品名稱..." className={inputCls} style={inputStyle} />

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#111124', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['圖', '名稱', '遊戲', '品相', '售價', '庫存', '狀態', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#0D0D1C' }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    {l.cardImage
                      ? <img src={l.cardImage} className="w-10 h-14 object-contain rounded-lg" style={{ background: '#0A0A1E' }} />
                      : <div className="w-10 h-14 rounded-lg flex items-center justify-center text-xl" style={{ background: '#0A0A1E' }}>🃏</div>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-100 max-w-[200px] truncate">{l.cardName}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {l.cardGame === 'yugioh' ? '⚔️' : '⚡'} {l.cardGame === 'yugioh' ? '遊戲王' : '寶可夢'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-xs px-2 py-0.5 rounded-full"
                      style={{ color: { NM: '#4ADE80', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171' }[l.condition],
                        background: 'rgba(255,255,255,0.05)' }}>
                      {l.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#A78BFA' }}>
                    NT${l.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-semibold">{l.quantity}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleStatus(l)}
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={l.status === 'active'
                        ? { color: '#4ADE80', background: 'rgba(74,222,128,0.1)' }
                        : { color: '#94A3B8', background: 'rgba(148,163,184,0.1)' }}>
                      {l.status === 'active' ? '上架中' : '已下架'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(l)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.06)' }}>
                        編輯
                      </button>
                      <button onClick={() => handleDelete(l.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 transition-colors"
                        style={{ background: 'rgba(239,68,68,0.08)' }}>
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              {filter ? '找不到相符商品' : '還沒有商品，點上方按鈕新增'}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">{editing ? '編輯商品' : '新增商品'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">卡牌名稱 *</label>
                <input value={form.cardName} onChange={(e) => setForm({ ...form, cardName: e.target.value })}
                  placeholder="例：青眼白龍 Blue-Eyes White Dragon" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Card ID</label>
                <input value={form.cardId} onChange={(e) => setForm({ ...form, cardId: e.target.value })}
                  placeholder="例：blue-eyes-001" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">遊戲</label>
                <select value={form.cardGame} onChange={(e) => setForm({ ...form, cardGame: e.target.value })}
                  className={inputCls} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {GAMES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">圖片網址</label>
                <input value={form.cardImage} onChange={(e) => setForm({ ...form, cardImage: e.target.value })}
                  placeholder="https://..." className={inputCls} style={inputStyle} />
              </div>
              {form.cardImage && (
                <div className="col-span-2 flex justify-center">
                  <img src={form.cardImage} className="h-32 object-contain rounded-xl"
                    style={{ background: '#0A0A1E' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">品相</label>
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  className={inputCls} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">售價 (NT$) *</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0" className={inputCls} style={inputStyle} min="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">數量</label>
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className={inputCls} style={inputStyle} min="1" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">商品說明</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="版本、品相說明、備注..." rows={3}
                  className={inputCls} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-400 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)' }}>取消</button>
              <button onClick={handleSave} disabled={saving || !form.cardName || !form.price}
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', opacity: saving ? 0.6 : 1 }}>
                {saving ? '儲存中...' : editing ? '儲存變更' : '新增商品'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
