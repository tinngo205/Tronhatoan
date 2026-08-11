export default function PageLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-36 bg-neutral-100 rounded-lg" />
        <div className="h-4 w-60 bg-neutral-100 rounded" />
      </div>

      {/* Date filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-neutral-100 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-neutral-100" />
              <div className="h-4 w-20 bg-neutral-100 rounded" />
            </div>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="w-8 h-8 rounded-full bg-neutral-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
