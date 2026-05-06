export default function AgendarLoading() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-8 px-4">
      {/* Logo skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/5 animate-pulse" />
        <div className="space-y-1">
          <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Step indicator skeleton */}
      <div className="flex items-center gap-2 w-full max-w-sm">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex items-center flex-1 gap-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-white/5 animate-pulse" />
            {i < 5 && <div className="flex-1 h-[2px] bg-white/5 animate-pulse rounded" />}
          </div>
        ))}
      </div>

      {/* Card skeleton */}
      <div className="w-full max-w-sm space-y-4">
        <div className="h-6 w-40 rounded bg-white/5 animate-pulse" />
        <div className="h-4 w-60 rounded bg-white/5 animate-pulse" />
        <div className="space-y-3 mt-6">
          <div className="h-14 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-white/5 animate-pulse" />
        </div>
        <div className="h-14 rounded-2xl bg-white/5 animate-pulse mt-4" />
      </div>
    </div>
  );
}
