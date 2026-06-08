import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { catalogApi } from '../../api/catalog';
import type { RarityDef } from '../../types/catalog';

interface OverviewRow {
  cardId: string; cardName: string; cardImage: string; language: string;
  rarity: string | null; setName: string; seriesKey: string; setId: string;
  wishlistCount: number; totalQty: number;
}

const LANG_LABEL: Record<string, string> = { zh: '繁中', ja: '日文', en: '英文' };

export function AdminWishlist() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rarities, setRarities] = useState<RarityDef[]>([]);
  const [onlyNoStock, setOnlyNoStock] = useState(false);

  useEffect(() => {
    catalogApi.rarities().then(setRarities).catch(() => {});
    adminApi.wishlistOverview().then((d) => setRows(d as OverviewRow[])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  const rarityColor = (code: string | null) => rarities.find((r) => r.code === code)?.color || '#64748b';
  const shown = onlyNoStock ? rows.filter((r) => r.totalQty === 0) : rows;
  const totalWishers = rows.reduce((s, r) => s + r.wishlistCount, 0);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', marginBottom: 6 }}>敲碗總覽</h1>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
        所有被敲碗的卡，依人數排序，方便決定進貨。共 {rows.length} 張卡、{totalWishers} 次敲碗。
      </p>

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setOnlyNoStock((v) => !v)} style={{
          padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: onlyNoStock ? '#2563EB' : 'rgba(255,255,255,0.06)', color: onlyNoStock ? '#fff' : '#94A3B8',
        }}>{onlyNoStock ? '☑' : '☐'} 只看無庫存（最該進貨）</button>
      </div>

      {loading ? (
        <p style={{ color: '#475569', padding: 40, textAlign: 'center' }}>載入中...</p>
      ) : shown.length === 0 ? (
        <p style={{ color: '#475569', padding: 40, textAlign: 'center' }}>目前沒有人敲碗</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map((r) => (
            <div key={r.cardId} onClick={() => navigate(`/admin/catalog?lang=${r.language}&q=${encodeURIComponent(r.cardName)}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer',
                background: '#0D0D1C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
              }}>
              <img src={r.cardImage} alt={r.cardName} style={{ width: 40, height: 56, objectFit: 'contain', background: '#09091a', borderRadius: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.rarity && <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: rarityColor(r.rarity), padding: '1px 5px', borderRadius: 4 }}>{r.rarity}</span>}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cardName}</span>
                </div>
                <span style={{ fontSize: 10, color: '#475569' }}>{LANG_LABEL[r.language] || r.language} · {r.setName}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#60A5FA' }}>🔔 {r.wishlistCount}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: r.totalQty > 0 ? '#34D399' : '#F87171' }}>
                  {r.totalQty > 0 ? `有庫存 ${r.totalQty}` : '無庫存'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
