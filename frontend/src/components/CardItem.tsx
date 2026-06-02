import { useNavigate } from 'react-router-dom';
import type { Listing } from '../types';

const COND_COLOR: Record<string, string> = {
  NM: '#4ADE80', LP: '#60A5FA', MP: '#FBBF24', HP: '#F87171',
};
const GAME_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  yugioh:  { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',  label: '⚔️ 遊戲王' },
  pokemon: { color: '#F87171', bg: 'rgba(239,68,68,0.12)',  label: '⚡ 寶可夢' },
};

export function CardItem({ listing }: { listing: Listing }) {
  const navigate = useNavigate();
  const condColor = COND_COLOR[listing.condition] ?? '#4ADE80';
  const game = GAME_STYLE[listing.cardGame] ?? GAME_STYLE['yugioh'];

  return (
    <div onClick={() => navigate(`/listing/${listing.id}`)}
      className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
      style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Image */}
      <div className="relative overflow-hidden bg-[#0A0A1E]" style={{ aspectRatio: '3/4' }}>
        {listing.cardImage ? (
          <img src={listing.cardImage} alt={listing.cardName}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">🃏</div>
        )}
        {/* Condition dot */}
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ background: condColor, boxShadow: `0 0 6px ${condColor}` }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-8 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #111124, transparent)' }} />
      </div>

      {/* Info */}
      <div className="px-3 pt-2 pb-3">
        {/* Game tag */}
        <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold mb-1.5"
          style={{ color: game.color, background: game.bg }}>
          {game.label}
        </div>
        <p className="text-xs font-semibold text-slate-200 leading-tight line-clamp-2 mb-2">
          {listing.cardName}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-black" style={{ color: '#A78BFA' }}>
            NT${listing.price.toLocaleString()}
          </p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: condColor, background: `${condColor}18` }}>
            {listing.condition}
          </span>
        </div>
      </div>
    </div>
  );
}
