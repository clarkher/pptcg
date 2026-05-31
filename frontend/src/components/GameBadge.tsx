interface Props {
  game: 'yugioh' | 'pokemon';
  size?: 'sm' | 'md';
}

export function GameBadge({ game, size = 'sm' }: Props) {
  const isYugioh = game === 'yugioh';
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span
      className={`${px} rounded-full font-bold ${
        isYugioh
          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30'
      }`}
    >
      {isYugioh ? '遊戲王' : '寶可夢'}
    </span>
  );
}
