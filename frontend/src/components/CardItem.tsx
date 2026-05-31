import { useNavigate } from 'react-router-dom';
import type { Listing } from '../types';
import { GameBadge } from './GameBadge';

const CONDITION_COLORS = {
  NM: 'text-green-400',
  LP: 'text-blue-400',
  MP: 'text-yellow-400',
  HP: 'text-red-400',
};

interface Props {
  listing: Listing;
}

export function CardItem({ listing }: Props) {
  const navigate = useNavigate();
  const conditionColor = CONDITION_COLORS[listing.condition] || 'text-slate-400';

  return (
    <div
      className="bg-[#16213E] rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform border border-[#0F3460] hover:border-violet-500/50"
      onClick={() => navigate(`/listing/${listing.id}`)}
    >
      <div className="relative bg-[#0F1629] aspect-[3/4] flex items-center justify-center overflow-hidden">
        {listing.cardImage ? (
          <img
            src={listing.cardImage}
            alt={listing.cardName}
            className="w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <div className="text-slate-600 text-4xl">🃏</div>
        )}
        <div className="absolute top-2 left-2">
          <GameBadge game={listing.cardGame} />
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-slate-100 line-clamp-1">{listing.cardName}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-bold ${conditionColor}`}>{listing.condition}</span>
          <span className="text-xs text-slate-400">x{listing.quantity}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-violet-400 font-bold text-base">NT${listing.price}</span>
          <span className="text-xs text-slate-500">{listing.seller.username}</span>
        </div>
      </div>
    </div>
  );
}
