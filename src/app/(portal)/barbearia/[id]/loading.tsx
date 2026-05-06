export default function BarbeariaProfileLoading() {
  return (
    <div className="min-h-screen bg-[#050505] p-4 text-white">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 pt-5">
        <div className="h-11 w-11 rounded-2xl bg-white/10" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[420px] rounded-[2rem] bg-white/[0.06]" />
          <div className="h-72 rounded-[2rem] bg-white/[0.045]" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-36 rounded-3xl bg-white/[0.04]" />
          <div className="h-36 rounded-3xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
