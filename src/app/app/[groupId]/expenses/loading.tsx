export default function PageLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-neutral-100 rounded-lg" />
        <div className="h-4 w-56 bg-neutral-100 rounded" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        <div className="h-9 w-28 bg-neutral-100 rounded-xl" />
        <div className="h-9 w-28 bg-neutral-100 rounded-xl" />
        <div className="h-9 flex-1 bg-neutral-100 rounded-xl" />
      </div>

      {/* List items */}
      <div className="bg-white rounded-2xl border border-neutral-100 divide-y divide-neutral-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-neutral-100 rounded" />
              <div className="h-3 w-20 bg-neutral-100 rounded" />
            </div>
            <div className="space-y-1.5 text-right">
              <div className="h-5 w-24 bg-neutral-100 rounded-lg" />
              <div className="h-3 w-16 bg-neutral-100 rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
