import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../api/admin';
import { pokemonApi, type PokemonCard, type CardLanguage, type SeriesInfo, type SetInfo, LANG_LABELS, LANG_COLORS } from '../../api/pokemon';
import type { Listing } from '../../types';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP'] as const;
const COND_LABEL: Record<string, string> = { NM: '近全新', LP: '輕微磨損', MP: '中度磨損', HP: '重度磨損' };
const COND_COLOR: Record<string, string> = { NM: '#34D399', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171' };
const STATUS_COLOR: Record<string, string> = { active: '#34D399', cancelled: '#94A3B8' };

const input: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '10px 14px', color: '#F1F5F9', fontSize: 14,
  width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

type Step = 'lang' | 'series' | 'set' | 'card' | 'form';

export function AdminListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [step, setStep] = useState<Step>('lang');
  const [saving, setSaving] = useState(false);
  const [tableFilter, setTableFilter] = useState('');

  // Browse state
  const [lang, setLang] = useState<CardLanguage>('en');
  const [seriesList, setSeriesList] = useState<SeriesInfo[]>([]);
  const [setsList, setSetsList] = useState<SetInfo[]>([]);
  const [cardResults, setCardResults] = useState<PokemonCard[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<SeriesInfo | null>(null);
  const [selectedSet, setSelectedSet] = useState<SetInfo | null>(null);
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);
  const [cardQ, setCardQ] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [dbStats, setDbStats] = useState<{ en: number; ja: number; zh: number } | null>(null);

  // Form
  const [form, setForm] = useState({ condition: 'NM', price: '', quantity: '1', description: '' });

  useEffect(() => {
    adminApi.getListings().then(setListings).finally(() => setLoading(false));
    pokemonApi.stats().then(setDbStats).catch(() => {});
  }, []);

  // Load series when language changes
  useEffect(() => {
    if (step === 'series') {
      pokemonApi.series(lang).then(setSeriesList).catch(() => {});
    }
  }, [lang, step]);

  // Load sets when series selected
  useEffect(() => {
    if (step === 'set' && selectedSeries) {
      pokemonApi.sets(lang, selectedSeries.key).then(setSetsList).catch(() => {});
    }
  }, [step, selectedSeries, lang]);

  // Search cards
  const searchCards = useCallback(async () => {
    if (!selectedSet && !cardQ.trim()) return;
    setCardLoading(true);
    try {
      const res = await pokemonApi.search({
        language: lang,
        setId: selectedSet?.id,
        q: cardQ.trim() || undefined,
        page: 1,
      });
      setCardResults(res.cards);
    } finally { setCardLoading(false); }
  }, [lang, selectedSet, cardQ]);

  useEffect(() => {
    if (step === 'card') {
      const t = setTimeout(() => searchCards(), 350);
      return () => clearTimeout(t);
    }
  }, [step, searchCards]);

  const openCreate = () => {
    setEditing(null); setSelectedCard(null); setSelectedSeries(null); setSelectedSet(null);
    setCardQ(''); setCardResults([]); setSeriesList([]); setSetsList([]);
    setForm({ condition: 'NM', price: '', quantity: '1', description: '' });
    setStep('lang'); setShowModal(true);
  };

  const openEdit = (l: Listing) => {
    setEditing(l);
    setForm({ condition: l.condition, price: String(l.price), quantity: String(l.quantity), description: l.description || '' });
    setSelectedCard(null); setStep('form'); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.price) return;
    setSaving(true);
    try {
      const base = { condition: form.condition as 'NM' | 'LP' | 'MP' | 'HP', price: parseFloat(form.price), quantity: parseInt(form.quantity), description: form.description };
      if (editing) {
        const updated = await adminApi.updateListing(editing.id, base);
        setListings(p => p.map(l => l.id === editing.id ? updated : l));
      } else if (selectedCard) {
        const created = await adminApi.createListing({
          ...base, cardId: selectedCard.id, cardName: selectedCard.name,
          cardGame: 'pokemon', cardImage: selectedCard.imageHigh || selectedCard.image,
          language: selectedCard.language,
        });
        setListings(p => [created, ...p]);
      }
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    await adminApi.deleteListing(id);
    setListings(p => p.filter(l => l.id !== id));
  };

  const handleToggle = async (l: Listing) => {
    const updated = await adminApi.updateListing(l.id, { status: l.status === 'active' ? 'cancelled' : 'active' });
    setListings(p => p.map(x => x.id === l.id ? updated : x));
  };

  const rarityColor = (r: string | null) => {
    if (!r) return '#475569';
    if (/hyper|secret/i.test(r)) return '#F59E0B';
    if (/special illustration|alt art/i.test(r)) return '#EC4899';
    if (/illustration rare/i.test(r)) return '#8B5CF6';
    if (/ultra|full art/i.test(r)) return '#60A5FA';
    if (/rare holo/i.test(r)) return '#34D399';
    if (/rare/i.test(r)) return '#94A3B8';
    return '#475569';
  };

  const filtered = listings.filter(l => !tableFilter || l.cardName.toLowerCase().includes(tableFilter.toLowerCase()));

  const LANG_OPTIONS: CardLanguage[] = ['en', 'ja', 'zh'];

  return (
    <div className="page-enter" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>商品管理</h2>
          {dbStats && (
            <p style={{ fontSize: 12, color: '#475569' }}>
              卡牌資料庫：🇺🇸 {dbStats.en.toLocaleString()} · 🇯🇵 {dbStats.ja.toLocaleString()} · 🇹🇼 {dbStats.zh.toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={openCreate} style={{
          padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
          boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
        }}>＋ 新增商品</button>
      </div>

      <input value={tableFilter} onChange={e => setTableFilter(e.target.value)}
        placeholder="搜尋商品名稱..." style={{ ...input, marginBottom: 16 }} />

      {/* Listing table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {filtered.map((l, idx) => {
            const langColor = LANG_COLORS[(l as any).language as CardLanguage] || '#60A5FA';
            return (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{ width: 44, height: 60, borderRadius: 8, overflow: 'hidden', background: '#0A0A1E', flexShrink: 0 }}>
                  {l.cardImage && <img src={l.cardImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.cardName}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, color: langColor, background: `${langColor}18` }}>
                      {LANG_LABELS[(l as any).language as CardLanguage] || '英版'}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, color: COND_COLOR[l.condition], background: `${COND_COLOR[l.condition]}18` }}>{l.condition}</span>
                  </div>
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#A78BFA', flexShrink: 0 }}>NT${l.price.toLocaleString()}</p>
                <button onClick={() => handleToggle(l)} style={{
                  padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  color: STATUS_COLOR[l.status], background: `${STATUS_COLOR[l.status]}18`,
                }}>{l.status === 'active' ? '上架中' : '已下架'}</button>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(l)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#94A3B8', background: 'rgba(255,255,255,0.06)' }}>編輯</button>
                  <button onClick={() => handleDelete(l.id)} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#F87171', background: 'rgba(239,68,68,0.08)' }}>刪除</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>目前沒有商品</div>}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ width: '100%', maxWidth: step === 'card' ? 800 : 520, maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, padding: 24, background: '#0F0F22', border: '1px solid rgba(255,255,255,0.1)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
                  {editing ? '編輯商品' : { lang: '選擇語言版本', series: '選擇系列', set: '選擇卡包', card: '選擇卡牌', form: '設定價格' }[step]}
                </h3>
                {/* Breadcrumb */}
                {!editing && step !== 'lang' && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                    {lang && <span style={{ color: LANG_COLORS[lang], fontWeight: 700 }}>{LANG_LABELS[lang]}</span>}
                    {selectedSeries && <><span style={{ color: '#475569' }}>›</span><span style={{ color: '#94A3B8' }}>{selectedSeries.name}</span></>}
                    {selectedSet && <><span style={{ color: '#475569' }}>›</span><span style={{ color: '#94A3B8' }}>{selectedSet.name}</span></>}
                    {selectedCard && <><span style={{ color: '#475569' }}>›</span><span style={{ color: '#A78BFA' }}>{selectedCard.name}</span></>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!editing && step !== 'lang' && (
                  <button onClick={() => {
                    if (step === 'form') { setSelectedCard(null); setStep('card'); }
                    else if (step === 'card') { setSelectedSet(null); setStep('set'); }
                    else if (step === 'set') { setSelectedSeries(null); setStep('series'); }
                    else if (step === 'series') setStep('lang');
                  }} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#94A3B8', background: 'rgba(255,255,255,0.06)' }}>← 上一步</button>
                )}
                <button onClick={() => setShowModal(false)} style={{ fontSize: 20, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
              </div>
            </div>

            {/* Step: Language */}
            {step === 'lang' && !editing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {LANG_OPTIONS.map(l => (
                  <button key={l} onClick={() => { setLang(l); setStep('series'); }} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                    borderRadius: 16, border: `1px solid ${LANG_COLORS[l]}30`, cursor: 'pointer',
                    background: `${LANG_COLORS[l]}08`, transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 32 }}>{l === 'en' ? '🇺🇸' : l === 'ja' ? '🇯🇵' : '🇹🇼'}</span>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: LANG_COLORS[l], marginBottom: 2 }}>{LANG_LABELS[l]}</p>
                      <p style={{ fontSize: 12, color: '#64748B' }}>
                        {dbStats ? `${dbStats[l].toLocaleString()} 張卡牌` : '載入中...'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step: Series */}
            {step === 'series' && !editing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {seriesList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>載入中...</div>
                ) : seriesList.map(s => (
                  <button key={s.key} onClick={() => { setSelectedSeries(s); setStep('set'); }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', background: 'rgba(255,255,255,0.03)', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: '#475569' }}>{s.count.toLocaleString()} 張</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step: Set */}
            {step === 'set' && !editing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {setsList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>載入中...</div>
                ) : setsList.map(s => (
                  <button key={s.id} onClick={() => { setSelectedSet(s); setStep('card'); }} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', background: 'rgba(255,255,255,0.03)', textAlign: 'left',
                  }}>
                    {s.logo && <img src={`${s.logo}/low.png`} style={{ height: 32, objectFit: 'contain' }} onError={e => (e.currentTarget.style.display='none')} />}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: '#475569' }}>{s.releaseDate} · {s.count} 張</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step: Card search */}
            {step === 'card' && !editing && (
              <div>
                <input value={cardQ} onChange={e => setCardQ(e.target.value)}
                  placeholder={`搜尋 ${selectedSet?.name || ''} 中的卡牌...`}
                  style={{ ...input, marginBottom: 16 }} autoFocus />
                {cardLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 10 }} />)}
                  </div>
                ) : cardResults.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {cardResults.map(card => (
                      <button key={card.id} onClick={() => { setSelectedCard(card); setStep('form'); }} style={{
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, background: 'rgba(255,255,255,0.02)',
                        cursor: 'pointer', padding: 0, overflow: 'hidden',
                      }}>
                        <div style={{ aspectRatio: '3/4', background: '#0A0A1E' }}>
                          {card.image ? (
                            <img src={card.image} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 24 }}>🃏</div>
                          )}
                        </div>
                        <div style={{ padding: '8px 8px 10px' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</p>
                          <p style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>No.{card.number}</p>
                          {card.rarity && <p style={{ fontSize: 9, fontWeight: 700, color: rarityColor(card.rarity) }}>{card.rarity}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 13 }}>
                    {cardQ ? `找不到「${cardQ}」` : `載入 ${selectedSet?.name} 的卡牌...`}
                  </div>
                )}
              </div>
            )}

            {/* Step: Form */}
            {(step === 'form' || editing) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Card preview */}
                {(selectedCard || editing) && (
                  <div style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 16, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div style={{ width: 72, height: 100, borderRadius: 8, overflow: 'hidden', background: '#0A0A1E', flexShrink: 0 }}>
                      <img src={selectedCard?.imageHigh || selectedCard?.image || editing?.cardImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{selectedCard?.name || editing?.cardName}</p>
                      {selectedCard && (
                        <>
                          <p style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>{selectedCard.setName} · No.{selectedCard.number}</p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: LANG_COLORS[selectedCard.language], background: `${LANG_COLORS[selectedCard.language]}18` }}>{LANG_LABELS[selectedCard.language]}</span>
                            {selectedCard.rarity && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: rarityColor(selectedCard.rarity), background: `${rarityColor(selectedCard.rarity)}18` }}>{selectedCard.rarity}</span>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Price */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>售價 (NT$) *</label>
                  <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                    placeholder="0" style={input} min="0" autoFocus={step === 'form'} />
                </div>

                {/* Condition + Qty */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>品相</label>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {CONDITIONS.map(c => (
                        <button key={c} onClick={() => setForm({...form, condition: c})} style={{
                          flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          background: form.condition === c ? `${COND_COLOR[c]}20` : 'rgba(255,255,255,0.04)',
                          color: form.condition === c ? COND_COLOR[c] : '#475569',
                          outline: form.condition === c ? `1.5px solid ${COND_COLOR[c]}60` : 'none',
                        }}>{c}</button>
                      ))}
                    </div>
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{COND_LABEL[form.condition]}</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>數量</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => setForm({...form, quantity: String(Math.max(1, parseInt(form.quantity)-1))})}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                      <span style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 900, color: '#fff' }}>{form.quantity}</span>
                      <button onClick={() => setForm({...form, quantity: String(parseInt(form.quantity)+1)})}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>＋</button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>備注說明</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="版本、品相說明..." rows={2} style={{ ...input, resize: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#64748B', background: 'rgba(255,255,255,0.05)' }}>取消</button>
                  <button onClick={handleSave} disabled={saving || !form.price || (!editing && !selectedCard)} style={{
                    flex: 2, padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff',
                    background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', opacity: saving || !form.price ? 0.5 : 1,
                    boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                  }}>{saving ? '儲存中...' : editing ? '儲存變更' : '上架商品'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
