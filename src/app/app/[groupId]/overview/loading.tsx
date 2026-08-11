export default function PageLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-neutral-100 rounded-lg" />
        <div className="h-4 w-72 bg-neutral-100 rounded" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-100 p-4 space-y-3">
            <div className="h-4 w-20 bg-neutral-100 rounded" />
            <div className="h-8 w-24 bg-neutral-100 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-4 space-y-3">
        <div className="h-5 w-32 bg-neutral-100 rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0">
            <div className="w-9 h-9 rounded-full bg-neutral-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 bg-neutral-100 rounded" />
              <div className="h-3 w-24 bg-neutral-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-neutral-100 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
