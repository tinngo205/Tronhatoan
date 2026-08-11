export default function PageLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-neutral-100 rounded-lg" />
        <div className="h-4 w-52 bg-neutral-100 rounded" />
      </div>

      {/* Members list */}
      <div className="bg-white rounded-2xl border border-neutral-100 divide-y divide-neutral-50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-neutral-100 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 bg-neutral-100 rounded" />
              <div className="h-3 w-20 bg-neutral-100 rounded" />
            </div>
            <div className="h-7 w-20 bg-neutral-100 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
