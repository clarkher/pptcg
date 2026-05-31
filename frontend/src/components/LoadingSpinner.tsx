export function LoadingSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-t-violet-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111124' }}>
      <div className="skeleton aspect-[3/4]" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-4 w-1/3 rounded mt-2" />
      </div>
    </div>
  );
}
