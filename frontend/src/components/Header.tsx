interface Props {
  title: string;
  right?: React.ReactNode;
}

export function Header({ title, right }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-[#0D0D1A]/95 backdrop-blur border-b border-[#0F3460] px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold text-slate-100">{title}</h1>
      {right && <div>{right}</div>}
    </header>
  );
}
