import type { CatalogCard as CatalogCardType } from '../types/catalog';
import cardPlaceholder from '../assets/card-placeholder.png';

interface Props {
  card: CatalogCardType;
  rarityColor: (code: string | null) => string;
  onClick: () => void;
  onWish: () => void;
}

export function CatalogCard({ card, rarityColor, onClick, onWish }: Props) {
  const inStock = card.totalQty > 0;
  const rColor = rarityColor(card.rarity);

  return (
    <div className="card-item" onClick={onClick} style={{ position: 'relative' }}>
      {/* Image */}
      <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '3/4', background: '#09091a' }}>
        <img
          src={card.imageHigh || card.image || cardPlaceholder}
          alt={card.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: inStock ? 'none' : 'grayscale(0.7) brightness(0.7)' }}
          onError={(e) => { (e.target as HTMLImageElement).src = cardPlaceholder; }}
        />

        {/* Rarity badge */}
        {card.rarity && (
          <div style={{
            position: 'absolute', top: 7, left: 7, zIndex: 4,
            padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 800,
            color: '#fff', background: rColor, boxShadow: `0 0 8px ${rColor}88`,
          }}>
            {card.rarity}
          </div>
        )}

        {/* Multi-variant badge */}
        {card.variantCount > 1 && (
          <div style={{
            position: 'absolute', top: 7, right: 7, zIndex: 4,
            padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 800,
            color: '#fff', background: 'rgba(124,58,237,0.85)',
          }}>
            {card.variantCount} 變體
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, zIndex: 3,
          background: 'linear-gradient(to top, rgba(9,9,26,0.9), transparent)', pointerEvents: 'none',
        }} />
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.4, marginBottom: 2,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{card.name}</p>
        <p style={{ fontSize: 10, color: '#64748B', marginBottom: 8 }}>{card.number} · {card.setName}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
          {inStock ? (
            <>
              <span style={{
                fontSize: 14, fontWeight: 900,
                background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                NT${(card.minPrice ?? 0).toLocaleString()}{card.variantCount > 1 ? ' 起' : ''}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.13)', padding: '2px 6px', borderRadius: 6 }}>
                {card.variantCount > 1 ? '共' : '剩'} {card.totalQty}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, color: '#64748B' }}>無庫存</span>
              <button
                onClick={(e) => { e.stopPropagation(); onWish(); }}
                style={{
                  fontSize: 10, fontWeight: 700, color: '#60A5FA', cursor: 'pointer',
                  background: 'rgba(96,165,250,0.13)', border: '1px solid rgba(96,165,250,0.33)',
                  padding: '3px 8px', borderRadius: 6,
                }}>
                🔔 敲碗 {card.wishlistCount}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
