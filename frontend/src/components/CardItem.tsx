import { useNavigate } from 'react-router-dom';
import type { Listing } from '../types';
import { GameBadge } from './GameBadge';

const COND_STYLE: Record<string, { color: string; bg: string }> = {
  NM: { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
  LP: { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  MP: { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  HP: { color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
};

export function CardItem({ listing }: { listing: Listing }) {
  const navigate = useNavigate();
  const cond = COND_STYLE[listing.condition] ?? COND_STYLE['NM'];

  return (
    <div onClick={() => navigate(`/listing/${listing.id}`)}
      className="rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
      style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Image */}
      <div className="relative bg-[#0A0A1E] flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: '3/4' }}>
        {listing.cardImage
          ? <img src={listing.cardImage} alt={listing.cardName}
              className="w-full h-full object-contain p-2" loading="lazy" />
          : <span className="text-5xl opacity-20">🃏</span>
        }
        {/* Game badge top-left */}
        <div className="absolute top-2 left-2">
          <GameBadge game={listing.cardGame} />
        </div>
        {/* Condition badge top-right */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ color: cond.color, background: cond.bg, border: `1px solid ${cond.color}40` }}>
          {listing.condition}
        </div>
        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-10 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #111124, transparent)' }} />
      </div>

      {/* Info */}
      <div className="p-3 pt-2">
        <p className="text-sm font-semibold text-slate-100 leading-tight line-clamp-2 mb-2">
          {listing.cardName}
        </p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">售價</p>
            <p className="font-bold text-base" style={{ color: '#A78BFA' }}>
              NT${listing.price.toLocaleString()}
            </p>
          </div>
          <p className="text-[10px] text-slate-600 mb-0.5">{listing.seller.username}</p>
        </div>
      </div>
    </div>
  );
}
