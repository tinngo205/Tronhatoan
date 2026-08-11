export default function GroupLayoutLoading() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-neutral-50">
      {/* Desktop Sidebar skeleton */}
      <aside className="hidden md:flex flex-col w-64 border-r border-neutral-200 bg-white p-4 justify-between shrink-0">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="h-8 w-28 bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-neutral-100 rounded-xl animate-pulse" />
          </div>
          <nav className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </nav>
        </div>
        <div className="border-t border-neutral-100 pt-4 space-y-3">
          <div className="h-12 w-full bg-neutral-100 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-neutral-100 rounded-xl animate-pulse" />
        </div>
      </aside>

      {/* Content area skeleton */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header skeleton */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-40">
          <div className="h-6 w-32 bg-neutral-100 rounded animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-neutral-100 animate-pulse" />
        </header>

        <main className="flex-1 pb-24 md:pb-6 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
          {/* Content skeleton cards */}
          <div className="h-32 w-full bg-white rounded-2xl border border-neutral-100 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-neutral-100 animate-pulse" />
            ))}
          </div>
          <div className="h-64 w-full bg-white rounded-2xl border border-neutral-100 animate-pulse" />
        </main>
      </div>

      {/* Mobile bottom nav skeleton */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-neutral-200 bg-white flex items-center justify-around px-2 z-40">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-5 h-5 bg-neutral-100 rounded animate-pulse" />
            <div className="w-10 h-2 bg-neutral-100 rounded animate-pulse" />
          </div>
        ))}
      </nav>
    </div>
  );
}
