interface Props {
  game: 'yugioh' | 'pokemon';
  size?: 'sm' | 'md';
}

export function GameBadge({ game, size = 'sm' }: Props) {
  const isYugioh = game === 'yugioh';
  const cls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
  return (
    <span className={`${cls} rounded-full font-bold tracking-wide inline-flex items-center gap-1`}
      style={isYugioh
        ? { background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)' }
        : { background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }
      }>
      {isYugioh ? '⚔️ 遊戲王' : '⚡ 寶可夢'}
    </span>
  );
}
