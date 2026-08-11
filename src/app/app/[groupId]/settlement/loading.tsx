export default function PageLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-36 bg-neutral-100 rounded-lg" />
        <div className="h-4 w-64 bg-neutral-100 rounded" />
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
        <div className="h-5 w-28 bg-neutral-100 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 bg-neutral-100 rounded" />
              <div className="h-7 w-24 bg-neutral-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-neutral-100 divide-y divide-neutral-50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-neutral-100" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-neutral-100 rounded" />
                <div className="h-3 w-20 bg-neutral-100 rounded" />
              </div>
            </div>
            <div className="space-y-1.5 text-right">
              <div className="h-5 w-20 bg-neutral-100 rounded-lg" />
              <div className="h-3 w-14 bg-neutral-100 rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
