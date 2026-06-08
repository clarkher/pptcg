import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { wishlistApi } from '../api/wishlist';
import { ordersApi } from '../api/orders';
import { useAuthStore } from '../stores/authStore';
import type { CatalogCardDetail, ConditionDef } from '../types/catalog';
import cardPlaceholder from '../assets/card-placeholder.png';

export function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const [card, setCard] = useState<CatalogCardDetail | null>(null);
  const [conditions, setConditions] = useState<ConditionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, conds] = await Promise.all([catalogApi.card(id), catalogApi.conditions()]);
      setCard(c);
      setConditions(conds);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const condLabel = (code: string) => conditions.find((c) => c.code === code)?.label ?? code;

  const buy = async (listingId: string) => {
    if (!token) { navigate('/login'); return; }
    try {
      await ordersApi.buy(listingId, 1);
      setMsg('購買成功！');
      setTimeout(() => navigate('/orders'), 800);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || '購買失敗');
    }
  };

  const wish = async (variant?: string | null) => {
    if (!token) { navigate('/login'); return; }
    try {
      await wishlistApi.add(id!, variant ?? null);
      setMsg('已加入敲碗，補貨會通知你 🔔');
      load();
    } catch { setMsg('敲碗失敗'); }
  };

  if (loading) return <p style={{ color: '#64748B', textAlign: 'center', padding: 60 }}>載入中...</p>;
  if (!card) return <p style={{ color: '#64748B', textAlign: 'center', padding: 60 }}>找不到卡片</p>;

  return (
    <div style={{ paddingBottom: 100 }} className="page-enter">
      <div style={{ padding: '52px 16px 0' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>← 返回</button>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <img
            src={card.imageHigh || card.image || cardPlaceholder}
            alt={card.name}
            style={{ width: 180, borderRadius: 12, background: '#09091a', objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).src = cardPlaceholder; }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{card.name}</h1>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
              {card.number} · {card.setName} · {card.seriesName}
            </p>

            <p style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>選擇變體 / 品相</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {card.variants.length === 0 && (
                <p style={{ fontSize: 12, color: '#64748B' }}>目前沒有任何庫存。</p>
              )}
              {card.variants.map((v) => {
                const has = v.quantity > 0;
                return (
                  <div key={v.listingId} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 600 }}>{v.variant}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{condLabel(v.condition)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 900, color: '#FBBF24' }}>NT${v.price.toLocaleString()}</span>
                    {has ? (
                      <>
                        <span style={{ fontSize: 11, color: '#34D399' }}>剩 {v.quantity}</span>
                        <button onClick={() => buy(v.listingId)} style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', color: '#fff', fontSize: 12, fontWeight: 700,
                        }}>購買</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: '#64748B' }}>無庫存</span>
                        <button onClick={() => wish(v.variant)} style={{
                          padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          background: 'rgba(96,165,250,0.13)', border: '1px solid rgba(96,165,250,0.33)', color: '#60A5FA',
                        }}>🔔 敲碗</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => wish(null)} style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: 'rgba(96,165,250,0.13)', border: '1px solid rgba(96,165,250,0.33)', color: '#60A5FA',
              }}>🔔 敲整張卡</button>
              <span style={{ fontSize: 11, color: '#64748B' }}>目前 {card.wishlistCount} 人敲碗{card.userWished ? '（含你）' : ''} · 補貨會通知你</span>
            </div>

            {msg && <p style={{ marginTop: 12, fontSize: 13, color: '#34D399' }}>{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
