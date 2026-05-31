export function LoadingSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}
