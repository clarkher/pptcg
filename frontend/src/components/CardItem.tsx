import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';
import type { Listing } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import cardPlaceholder from '../assets/card-placeholder.png';
import yugiohIcon from '../assets/game-icons/yugioh-icon.png';
import pokemonIcon from '../assets/game-icons/pokemon-icon.png';

const COND_COLOR: Record<string, string> = {
  NM: '#34D399', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171',
};
const COND_LABEL: Record<string, string> = {
  NM: 'NM', LP: 'LP', MP: 'MP', HP: 'HP',
};
const GAME_STYLE: Record<string, { color: string; bg: string; icon: string; label: string; glow: string }> = {
  yugioh:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: yugiohIcon,  label: '遊戲王', glow: 'rgba(251,191,36,0.25)' },
  pokemon: { color: '#F472B6', bg: 'rgba(244,114,182,0.12)', icon: pokemonIcon, label: '寶可夢', glow: 'rgba(244,114,182,0.25)' },
};

export function CardItem({ listing }: { listing: Listing }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const addToCart = useCartStore((s) => s.add);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const condColor = COND_COLOR[listing.condition] ?? '#34D399';
  const game = GAME_STYLE[listing.cardGame] ?? GAME_STYLE['yugioh'];

  const isOwn = !!user && listing.seller.username === user.username;
  const canQuickAdd = listing.status === 'active' && listing.quantity > 0 && !isOwn;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    if (adding) return;
    setAdding(true);
    try {
      await addToCart(listing.id);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch { /* ignore */ } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="card-item"
      onClick={() => navigate(`/listing/${listing.id}`)}
    >
      {/* Image area */}
      <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '3/4', background: '#09091a' }}>
        {listing.cardImage ? (
          <img
            src={listing.cardImage}
            alt={listing.cardName}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            loading="lazy"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.src = cardPlaceholder;
              el.style.objectFit = 'cover';
            }}
          />
        ) : (
          <img
            src={cardPlaceholder}
            alt="card back"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        )}

        {/* Holographic overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
          background: 'linear-gradient(135deg, transparent 40%, rgba(139,92,246,0.06) 60%, transparent 80%)',
        }} />

        {/* Condition badge */}
        <div style={{
          position: 'absolute', top: 7, right: 7, zIndex: 4,
          padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 800,
          color: condColor,
          background: `${condColor}22`,
          border: `1px solid ${condColor}44`,
          backdropFilter: 'blur(8px)',
          boxShadow: `0 0 8px ${condColor}44`,
        }}>
          {COND_LABEL[listing.condition] ?? 'NM'}
        </div>

        {/* Bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, zIndex: 3,
          background: 'linear-gradient(to top, rgba(9,9,26,0.9), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Quick add-to-cart */}
        {canQuickAdd && (
          <button
            onClick={handleQuickAdd}
            disabled={adding}
            aria-label="加入購物車"
            style={{
              position: 'absolute', bottom: 8, right: 8, zIndex: 5,
              width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', opacity: adding ? 0.6 : 1,
              background: added
                ? 'linear-gradient(135deg,#34D399,#059669)'
                : 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
              boxShadow: added ? '0 0 14px rgba(52,211,153,0.5)' : '0 2px 10px rgba(109,40,236,0.5)',
              transition: 'background 0.2s',
            }}
          >
            {added ? <Check size={17} /> : <Plus size={18} />}
          </button>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: '10px 12px 12px', position: 'relative', zIndex: 5 }}>
        {/* Game badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
          marginBottom: 6,
          color: game.color,
          background: game.bg,
          border: `1px solid ${game.color}33`,
        }}>
          <img src={game.icon} alt="" style={{ width: 10, height: 10, objectFit: 'contain' }} />
          {game.label}
        </div>

        {/* Card name */}
        <p style={{
          fontSize: 12, fontWeight: 600, color: '#E2E8F0',
          lineHeight: 1.4, marginBottom: 8,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {listing.cardName}
        </p>

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 15, fontWeight: 900,
            background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            NT${listing.price.toLocaleString()}
          </span>
          {listing.quantity > 1 && (
            <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
              ×{listing.quantity}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
