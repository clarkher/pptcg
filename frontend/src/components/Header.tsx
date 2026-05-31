interface Props {
  title: string;
  right?: React.ReactNode;
  back?: () => void;
}

export function Header({ title, right, back }: Props) {
  return (
    <header className="sticky top-0 z-40 px-4 py-3.5 flex items-center justify-between"
      style={{ background: 'linear-gradient(to bottom, #0A0A14 80%, transparent)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-3">
        {back && (
          <button onClick={back}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-slate-400 active:scale-90 transition-transform">
            ←
          </button>
        )}
        <h1 className="text-[17px] font-bold tracking-tight text-slate-100">{title}</h1>
      </div>
      {right && <div>{right}</div>}
    </header>
  );
}
