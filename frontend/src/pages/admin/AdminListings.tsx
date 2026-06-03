import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../api/admin';
import { pokemonApi, type PokemonCard } from '../../api/pokemon';
import type { Listing } from '../../types';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP'];
const COND_LABELS: Record<string, string> = { NM: '近全新', LP: '輕微磨損', MP: '中度磨損', HP: '重度磨損' };
const COND_COLOR: Record<string, string> = { NM: '#4ADE80', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171' };
const STATUS_COLOR: Record<string, string> = { active: '#4ADE80', cancelled: '#94A3B8' };

const inputStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '10px 14px', color: '#F1F5F9', fontSize: 14,
  width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
};

type Step = 'search' | 'form';

export function AdminListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [step, setStep] = useState<Step>('search');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  // Card search state
  const [cardQ, setCardQ] = useState('');
  const [cardResults, setCardResults] = useState<PokemonCard[]>([]);
  const [cardLoading, setCardLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);
  const [dbStats, setDbStats] = useState<{ total: number; sets: number } | null>(null);

  // Form state
  const [form, setForm] = useState({
    condition: 'NM', price: '', quantity: '1', description: '',
    cardGame: 'pokemon' as 'pokemon' | 'yugioh',
  });

  useEffect(() => {
    adminApi.getListings().then(setListings).finally(() => setLoading(false));
    pokemonApi.stats().then(setDbStats).catch(() => {});
  }, []);

  const searchCards = useCallback(async (q: string) => {
    if (!q.trim()) { setCardResults([]); return; }
    setCardLoading(true);
    try {
      const res = await pokemonApi.search(q);
      setCardResults(res.cards);
    } finally { setCardLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCards(cardQ), 400);
    return () => clearTimeout(t);
  }, [cardQ, searchCards]);

  const openCreate = () => {
    setEditing(null); setSelectedCard(null); setCardQ(''); setCardResults([]);
    setForm({ condition: 'NM', price: '', quantity: '1', description: '', cardGame: 'pokemon' });
    setStep('search'); setShowModal(true);
  };

  const openEdit = (l: Listing) => {
    setEditing(l);
    setForm({
      condition: l.condition, price: String(l.price),
      quantity: String(l.quantity), description: l.description || '',
      cardGame: l.cardGame as 'pokemon' | 'yugioh',
    });
    setSelectedCard(null); setStep('form'); setShowModal(true);
  };

  const handleSelectCard = (card: PokemonCard) => {
    setSelectedCard(card);
    setStep('form');
  };

  const handleSave = async () => {
    if (!form.price) return;
    setSaving(true);
    try {
      const baseData = {
        condition: form.condition as 'NM' | 'LP' | 'MP' | 'HP',
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
        description: form.description,
      };

      if (editing) {
        const updated = await adminApi.updateListing(editing.id, baseData);
        setListings(prev => prev.map(l => l.id === editing.id ? updated : l));
      } else if (selectedCard) {
        const created = await adminApi.createListing({
          ...baseData,
          cardId: selectedCard.id,
          cardName: selectedCard.name,
          cardGame: 'pokemon',
          cardImage: selectedCard.imageLarge || selectedCard.imageSmall,
        });
        setListings(prev => [created, ...prev]);
      }
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除？')) return;
    await adminApi.deleteListing(id);
    setListings(prev => prev.filter(l => l.id !== id));
  };

  const handleToggle = async (l: Listing) => {
    const updated = await adminApi.updateListing(l.id, {
      status: l.status === 'active' ? 'cancelled' : 'active',
    });
    setListings(prev => prev.map(x => x.id === l.id ? updated : x));
  };

  const filtered = listings.filter(l =>
    !filter || l.cardName.toLowerCase().includes(filter.toLowerCase())
  );

  const rarityColor = (r: string | null) => {
    if (!r) return '#94A3B8';
    if (r.includes('Hyper')) return '#F59E0B';
    if (r.includes('Secret')) return '#EC4899';
    if (r.includes('Ultra')) return '#8B5CF6';
    if (r.includes('Rainbow')) return '#22D3EE';
    if (r.includes('Rare')) return '#60A5FA';
    return '#94A3B8';
  };

  return (
    <div className="page-enter" style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>商品管理</h2>
          <p style={{ fontSize: 13, color: '#64748B' }}>
            {listings.length} 件商品
            {dbStats && ` · 寶可夢資料庫 ${dbStats.total.toLocaleString()} 張卡 / ${dbStats.sets} 個系列`}
          </p>
        </div>
        <button onClick={openCreate} style={{
          padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
          boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
        }}>＋ 新增商品</button>
      </div>

      {/* Search */}
      <input value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="搜尋商品名稱..." style={{ ...inputStyle, marginBottom: 16 }} />

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {filtered.map((l, idx) => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              {/* Card image */}
              <div style={{ width: 44, height: 60, borderRadius: 8, overflow: 'hidden',
                background: '#0A0A1E', flexShrink: 0 }}>
                {l.cardImage && <img src={l.cardImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.cardName}
                </p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: l.cardGame === 'pokemon' ? '#F87171' : '#EAB308' }}>
                    {l.cardGame === 'pokemon' ? '⚡ 寶可夢' : '⚔️ 遊戲王'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COND_COLOR[l.condition],
                    padding: '1px 6px', borderRadius: 4, background: `${COND_COLOR[l.condition]}15` }}>
                    {l.condition} {COND_LABELS[l.condition]}
                  </span>
                </div>
              </div>

              {/* Price / qty */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#A78BFA' }}>
                  NT${l.price.toLocaleString()}
                </p>
                <p style={{ fontSize: 11, color: '#475569' }}>×{l.quantity}</p>
              </div>

              {/* Status */}
              <button onClick={() => handleToggle(l)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                color: STATUS_COLOR[l.status],
                background: `${STATUS_COLOR[l.status]}18`,
              }}>
                {l.status === 'active' ? '上架中' : '已下架'}
              </button>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(l)} style={{
                  padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: '#94A3B8',
                  background: 'rgba(255,255,255,0.06)',
                }}>編輯</button>
                <button onClick={() => handleDelete(l.id)} style={{
                  padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: '#F87171',
                  background: 'rgba(239,68,68,0.08)',
                }}>刪除</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
              {filter ? '找不到相符商品' : '目前沒有商品，點上方按鈕新增'}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{
            width: '100%', maxWidth: step === 'search' ? 720 : 480,
            maxHeight: '90vh', overflowY: 'auto',
            borderRadius: 24, padding: 24,
            background: '#0F0F22', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>
                  {editing ? '編輯商品' : step === 'search' ? '選擇卡牌' : '設定上架資訊'}
                </h3>
                {!editing && step === 'form' && selectedCard && (
                  <button onClick={() => setStep('search')} style={{
                    fontSize: 12, color: '#A78BFA', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2,
                  }}>← 重新選卡</button>
                )}
              </div>
              <button onClick={() => setShowModal(false)} style={{
                fontSize: 20, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1,
              }}>✕</button>
            </div>

            {/* Step 1: Search card */}
            {step === 'search' && !editing && (
              <div>
                <input value={cardQ} onChange={e => setCardQ(e.target.value)}
                  placeholder="搜尋寶可夢卡牌名稱（中文或英文）..."
                  style={{ ...inputStyle, marginBottom: 16, fontSize: 15 }}
                  autoFocus
                />
                {!dbStats?.total && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748B', fontSize: 13 }}>
                    ⏳ 卡牌資料庫爬取中，稍後可用...
                  </div>
                )}
                {cardLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />)}
                  </div>
                ) : cardResults.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {cardResults.map(card => (
                      <button key={card.id} onClick={() => handleSelectCard(card)} style={{
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
                        padding: 0, overflow: 'hidden', transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}>
                        <div style={{ aspectRatio: '3/4', background: '#0A0A1E' }}>
                          <img src={card.imageSmall} alt={card.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            loading="lazy" />
                        </div>
                        <div style={{ padding: '8px 8px 10px' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', marginBottom: 3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {card.name}
                          </p>
                          <p style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>{card.setName}</p>
                          {card.rarity && (
                            <p style={{ fontSize: 10, fontWeight: 700, color: rarityColor(card.rarity) }}>
                              {card.rarity}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : cardQ.trim() ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>找不到「{cardQ}」</div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 13 }}>
                    輸入卡牌名稱搜尋
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Form */}
            {(step === 'form' || editing) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Selected card preview */}
                {(selectedCard || editing) && (
                  <div style={{
                    display: 'flex', gap: 16, padding: 16, borderRadius: 16,
                    background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)',
                  }}>
                    <div style={{ width: 72, height: 100, borderRadius: 8, overflow: 'hidden',
                      background: '#0A0A1E', flexShrink: 0 }}>
                      <img src={selectedCard?.imageLarge || editing?.cardImage}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                        {selectedCard?.name || editing?.cardName}
                      </p>
                      {selectedCard && (
                        <>
                          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>{selectedCard.setName}</p>
                          {selectedCard.rarity && (
                            <p style={{ fontSize: 12, fontWeight: 700, color: rarityColor(selectedCard.rarity) }}>
                              {selectedCard.rarity}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Price */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>售價 (NT$) *</label>
                  <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                    placeholder="0" style={inputStyle} min="0" autoFocus={step === 'form'} />
                </div>

                {/* Condition + Quantity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B',
                      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>品相</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {CONDITIONS.map(c => (
                        <button key={c} onClick={() => setForm({...form, condition: c})} style={{
                          flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 700,
                          background: form.condition === c ? `${COND_COLOR[c]}20` : 'rgba(255,255,255,0.04)',
                          color: form.condition === c ? COND_COLOR[c] : '#475569',
                          outline: form.condition === c ? `1.5px solid ${COND_COLOR[c]}60` : 'none',
                        }}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B',
                      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>數量</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => setForm({...form, quantity: String(Math.max(1, parseInt(form.quantity)-1))})}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                      <span style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>
                        {form.quantity}
                      </span>
                      <button onClick={() => setForm({...form, quantity: String(parseInt(form.quantity)+1)})}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>＋</button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>備注說明</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="版本、品相說明..." rows={3}
                    style={{ ...inputStyle, resize: 'none' }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowModal(false)} style={{
                    flex: 1, padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, color: '#64748B',
                    background: 'rgba(255,255,255,0.05)',
                  }}>取消</button>
                  <button onClick={handleSave}
                    disabled={saving || !form.price || (!editing && !selectedCard)}
                    style={{
                      flex: 2, padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 700, color: '#fff',
                      background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                      opacity: saving || !form.price ? 0.5 : 1,
                      boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                    }}>
                    {saving ? '儲存中...' : editing ? '儲存變更' : '上架商品'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
