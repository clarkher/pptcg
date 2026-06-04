import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../api/admin';
import {
  pokemonApi, type PokemonCard, type CardLanguage,
  type SeriesInfo, type SetInfo, LANG_LABELS, LANG_COLORS,
} from '../../api/pokemon';
import type { Listing } from '../../types';

const CONDS = ['NM', 'LP', 'MP', 'HP'] as const;
const COND_LABEL: Record<string, string> = { NM: '近全新', LP: '輕微磨損', MP: '中度磨損', HP: '重度磨損' };
const COND_COL: Record<string, string>  = { NM: '#4ADE80', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171' };

function rarityBadgeColor(r: string | null) {
  if (!r) return '#334155';
  if (/hyper|secret/i.test(r))              return '#F59E0B';
  if (/special illustration|alt art/i.test(r)) return '#EC4899';
  if (/illustration rare/i.test(r))         return '#8B5CF6';
  if (/ultra|full art/i.test(r))            return '#60A5FA';
  if (/rare holo/i.test(r))                 return '#34D399';
  if (/\brare\b/i.test(r))                  return '#94A3B8';
  return '#334155';
}

type Mode = 'pick' | 'form';

export function AdminListings() {
  // ── listings ──────────────────────────────────────────────
  const [listings, setListings]       = useState<Listing[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [tableQ, setTableQ]           = useState('');

  // ── modal ─────────────────────────────────────────────────
  const [open, setOpen]               = useState(false);
  const [editing, setEditing]         = useState<Listing | null>(null);
  const [mode, setMode]               = useState<Mode>('pick');
  const [saving, setSaving]           = useState(false);

  // ── card picker state ─────────────────────────────────────
  const [lang, setLang]               = useState<CardLanguage>('en');
  const [series, setSeries]           = useState<SeriesInfo[]>([]);
  const [sets, setSets]               = useState<SetInfo[]>([]);
  const [cards, setCards]             = useState<PokemonCard[]>([]);
  const [openSeries, setOpenSeries]   = useState<string | null>(null);
  const [setId, setSetId]             = useState<string | null>(null);
  const [cardQ, setCardQ]             = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);
  const [dbStats, setDbStats]         = useState<{ en: number; ja: number; zh: number } | null>(null);

  // ── form ──────────────────────────────────────────────────
  const [form, setForm] = useState({ condition: 'NM', price: '', quantity: '1', description: '' });

  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    adminApi.getListings().then(setListings).finally(() => setLoadingList(false));
    pokemonApi.stats().then(setDbStats).catch(() => {});
  }, []);

  // Load series on language / open change
  useEffect(() => {
    if (!open || editing) return;
    setSeries([]); setSets([]); setCards([]);
    setOpenSeries(null); setSetId(null);
    pokemonApi.series(lang).then(setSeries);
  }, [lang, open, editing]);

  // Load sets when a series is opened
  useEffect(() => {
    if (!openSeries) { setSets([]); return; }
    pokemonApi.sets(lang, openSeries).then(ss => {
      setSets(ss);
      if (ss.length) setSetId(ss[0].id);   // auto-select first set
    });
  }, [openSeries, lang]);

  // Load cards
  const loadCards = useCallback(async () => {
    if (!setId && !cardQ.trim()) { setCards([]); return; }
    setCardLoading(true);
    try {
      const r = await pokemonApi.search({ language: lang, setId: setId ?? undefined, q: cardQ.trim() || undefined, page: 1 });
      setCards(r.cards);
    } finally { setCardLoading(false); }
  }, [lang, setId, cardQ]);

  useEffect(() => {
    if (!open || editing) return;
    const t = setTimeout(loadCards, 250);
    return () => clearTimeout(t);
  }, [loadCards, open, editing]);

  // ── actions ───────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null); setSelectedCard(null);
    setOpenSeries(null); setSetId(null); setCards([]); setCardQ('');
    setForm({ condition: 'NM', price: '', quantity: '1', description: '' });
    setMode('pick'); setOpen(true);
  };

  const openEdit = (l: Listing) => {
    setEditing(l);
    setForm({ condition: l.condition, price: String(l.price), quantity: String(l.quantity), description: l.description || '' });
    setMode('form'); setOpen(true);
  };

  const handleSave = async () => {
    if (!form.price) return;
    setSaving(true);
    try {
      const base = { condition: form.condition as 'NM'|'LP'|'MP'|'HP', price: parseFloat(form.price), quantity: parseInt(form.quantity), description: form.description };
      if (editing) {
        const u = await adminApi.updateListing(editing.id, base);
        setListings(p => p.map(l => l.id === editing.id ? u : l));
      } else if (selectedCard) {
        const c = await adminApi.createListing({ ...base, cardId: selectedCard.id, cardName: selectedCard.name, cardGame: 'pokemon', cardImage: selectedCard.imageHigh || selectedCard.image, language: selectedCard.language });
        setListings(p => [c, ...p]);
      }
      setOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    await adminApi.deleteListing(id);
    setListings(p => p.filter(l => l.id !== id));
  };

  const handleToggle = async (l: Listing) => {
    const u = await adminApi.updateListing(l.id, { status: l.status === 'active' ? 'cancelled' : 'active' });
    setListings(p => p.map(x => x.id === l.id ? u : x));
  };

  const filtered = listings.filter(l => !tableQ || l.cardName.toLowerCase().includes(tableQ.toLowerCase()));

  // ── render ────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', margin: '0 0 4px' }}>商品管理</h2>
          {dbStats && (
            <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>
              資料庫：EN {dbStats.en.toLocaleString()} · JA {dbStats.ja.toLocaleString()} · ZH {dbStats.zh.toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
          borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg,#5B21B6,#7C3AED)', boxShadow: '0 0 24px rgba(124,58,237,0.45)',
          whiteSpace: 'nowrap',
        }}>+ 新增商品</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#334155', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input value={tableQ} onChange={e => setTableQ(e.target.value)} placeholder="搜尋商品名稱..."
          style={{ width: '100%', padding: '9px 14px 9px 36px', borderRadius: 9, background: '#111827', border: '1px solid rgba(255,255,255,0.07)', color: '#F1F5F9', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Head */}
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 70px 60px 55px 88px 72px 96px', padding: '9px 16px', background: '#09091A', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#1E293B', gap: 4 }}>
          <span/>
          <span>卡牌</span>
          <span>語言</span>
          <span>品相</span>
          <span>數量</span>
          <span>售價</span>
          <span>狀態</span>
          <span style={{ textAlign: 'right' }}>操作</span>
        </div>

        {loadingList ? (
          [0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, margin: '2px 0' }} />)
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#1E293B', fontSize: 14 }}>目前沒有商品</div>
        ) : filtered.map((l, idx) => {
          const lc = LANG_COLORS[(l as any).language as CardLanguage] || '#60A5FA';
          const cc = COND_COL[l.condition] || '#94A3B8';
          return (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 70px 60px 55px 88px 72px 96px', padding: '10px 16px', alignItems: 'center', gap: 4, background: idx % 2 === 0 ? '#0D0D1C' : '#0B0B18', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ width: 30, height: 42, borderRadius: 5, overflow: 'hidden', background: '#060612' }}>
                {l.cardImage && <img src={l.cardImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>{l.cardName}</p>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: lc, background: `${lc}15`, whiteSpace: 'nowrap', width: 'fit-content' }}>
                {LANG_LABELS[(l as any).language as CardLanguage]?.replace(/🇺🇸|🇯🇵|🇹🇼/g, '').trim() || 'EN'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cc }}>{l.condition}</span>
              <span style={{ fontSize: 13, color: '#475569' }}>×{l.quantity}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#A78BFA' }}>NT${l.price.toLocaleString()}</span>
              <button onClick={() => handleToggle(l)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', color: l.status === 'active' ? '#4ADE80' : '#475569', background: l.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                {l.status === 'active' ? '上架中' : '已下架'}
              </button>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => openEdit(l)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, color: '#94A3B8', background: 'rgba(255,255,255,0.06)' }}>編輯</button>
                <button onClick={() => handleDelete(l.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, color: '#F87171', background: 'rgba(239,68,68,0.08)' }}>刪除</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────── */}
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

          {/* ── PICK CARD (full-screen explorer) ── */}
          {mode === 'pick' && !editing && (
            <div style={{ width: '100%', maxWidth: 1100, height: '90vh', borderRadius: 20, background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Top bar */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {/* Language tabs */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['en','ja','zh'] as CardLanguage[]).map(l => (
                    <button key={l} onClick={() => setLang(l)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.12s', background: lang === l ? `${LANG_COLORS[l]}20` : 'rgba(255,255,255,0.05)', color: lang === l ? LANG_COLORS[l] : '#475569', outline: lang === l ? `1.5px solid ${LANG_COLORS[l]}50` : 'none' }}>
                      {l === 'en' ? '🇺🇸 英版' : l === 'ja' ? '🇯🇵 日版' : '🇹🇼 中文版'}
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#334155', pointerEvents: 'none', fontSize: 13 }}>🔍</span>
                  <input value={cardQ} onChange={e => { setCardQ(e.target.value); setSetId(null); }}
                    placeholder="直接搜尋卡牌名稱..." autoFocus
                    style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', color: '#475569', background: 'rgba(255,255,255,0.06)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>

              {/* Body */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Series/Set sidebar */}
                <div style={{ width: 210, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', flexShrink: 0 }}>
                  {series.length === 0
                    ? <p style={{ padding: '16px', color: '#334155', fontSize: 12 }}>載入系列...</p>
                    : series.map(s => (
                      <div key={s.key}>
                        <button onClick={() => { setOpenSeries(openSeries === s.key ? null : s.key); setCardQ(''); }} style={{ width: '100%', padding: '9px 14px', textAlign: 'left', border: 'none', cursor: 'pointer', background: openSeries === s.key ? 'rgba(124,58,237,0.12)' : 'transparent', color: openSeries === s.key ? '#C4B5FD' : '#64748B', fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: openSeries === s.key ? '2px solid #7C3AED' : '2px solid transparent' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 6 }}>{s.name}</span>
                          <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{openSeries === s.key ? '▾' : '▸'}</span>
                        </button>
                        {openSeries === s.key && sets.map(st => (
                          <button key={st.id} onClick={() => { setSetId(st.id); setCardQ(''); }} style={{ width: '100%', padding: '7px 14px 7px 24px', textAlign: 'left', border: 'none', cursor: 'pointer', background: setId === st.id ? 'rgba(124,58,237,0.18)' : 'transparent', color: setId === st.id ? '#A78BFA' : '#475569', fontSize: 11, fontWeight: setId === st.id ? 700 : 400, borderLeft: setId === st.id ? '2px solid #7C3AED' : '2px solid transparent' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</div>
                            <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>{st.count} 張</div>
                          </button>
                        ))}
                      </div>
                    ))
                  }
                </div>

                {/* Card grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                  {cardLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                      {Array.from({ length: 20 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 10 }} />)}
                    </div>
                  ) : cards.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1E293B', gap: 10 }}>
                      <span style={{ fontSize: 48 }}>🃏</span>
                      <p style={{ fontSize: 13 }}>選左側系列 或 直接搜尋卡牌</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                      {cards.map(card => (
                        <button key={card.id} onClick={() => { setSelectedCard(card); setMode('form'); }} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, background: 'rgba(255,255,255,0.02)', cursor: 'pointer', padding: 0, overflow: 'hidden', textAlign: 'left', transition: 'all 0.12s' }}
                          onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(124,58,237,0.6)'; el.style.background = 'rgba(124,58,237,0.06)'; el.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.background = 'rgba(255,255,255,0.02)'; el.style.transform = 'translateY(0)'; }}>
                          <div style={{ aspectRatio: '3/4', background: '#070712', position: 'relative' }}>
                            {card.image
                              ? <img src={card.image} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} loading="lazy" />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E293B', fontSize: 28 }}>🃏</div>
                            }
                            {card.rarity && (
                              <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, color: rarityBadgeColor(card.rarity), background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {card.rarity}
                              </span>
                            )}
                          </div>
                          <div style={{ padding: '7px 8px 9px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#E2E8F0', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</p>
                            <p style={{ fontSize: 9, color: '#334155', margin: 0 }}>#{card.number}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ── FORM ── */}
          {(mode === 'form' || editing) && (
            <div style={{ width: '100%', maxWidth: 500, borderRadius: 20, background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.09)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!editing && (
                    <button onClick={() => setMode('pick')} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748B', background: 'rgba(255,255,255,0.06)' }}>← 換卡</button>
                  )}
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#F8FAFC', margin: 0 }}>{editing ? '編輯商品' : '設定價格'}</h3>
                </div>
                <button onClick={() => setOpen(false)} style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', color: '#475569', background: 'none' }}>✕</button>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Card preview */}
                {(selectedCard || editing) && (
                  <div style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 14, background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <div style={{ width: 60, height: 84, borderRadius: 8, overflow: 'hidden', background: '#070712', flexShrink: 0 }}>
                      <img src={selectedCard?.imageHigh || selectedCard?.image || editing?.cardImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: '#F8FAFC', margin: '0 0 5px' }}>{selectedCard?.name || editing?.cardName}</p>
                      {selectedCard && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{selectedCard.setName} · #{selectedCard.number}</p>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: LANG_COLORS[selectedCard.language], background: `${LANG_COLORS[selectedCard.language]}15` }}>{LANG_LABELS[selectedCard.language]}</span>
                            {selectedCard.rarity && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: rarityBadgeColor(selectedCard.rarity), background: `${rarityBadgeColor(selectedCard.rarity)}15` }}>{selectedCard.rarity}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Price */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>售價 (NT$) *</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0" min="0" autoFocus={mode === 'form'}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 20, fontWeight: 900, background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#A78BFA', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>

                {/* Condition */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>品相</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {CONDS.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, condition: c })} style={{ padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, background: form.condition === c ? `${COND_COL[c]}20` : 'rgba(255,255,255,0.05)', color: form.condition === c ? COND_COL[c] : '#334155', outline: form.condition === c ? `2px solid ${COND_COL[c]}50` : 'none', transition: 'all 0.1s' }}>{c}</button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>{COND_LABEL[form.condition]}</p>
                </div>

                {/* Quantity */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>數量</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => setForm({ ...form, quantity: String(Math.max(1, parseInt(form.quantity) - 1)) })}
                      style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 22, cursor: 'pointer', flexShrink: 0 }}>−</button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 26, fontWeight: 900, color: '#F8FAFC' }}>{form.quantity}</span>
                    <button onClick={() => setForm({ ...form, quantity: String(parseInt(form.quantity) + 1) })}
                      style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 22, cursor: 'pointer', flexShrink: 0 }}>+</button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>備注</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="品相說明、版本備注..." rows={2}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: '#111827', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#475569', background: 'rgba(255,255,255,0.06)' }}>取消</button>
                  <button onClick={handleSave} disabled={saving || !form.price || (!editing && !selectedCard)} style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', cursor: saving || !form.price ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg,#5B21B6,#7C3AED)', opacity: saving || !form.price ? 0.45 : 1, boxShadow: '0 0 24px rgba(124,58,237,0.4)', transition: 'opacity 0.15s', letterSpacing: 0.3 }}>
                    {saving ? '儲存中...' : editing ? '儲存變更' : '✓ 上架商品'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
