/**
 * Generic in-app loading skeleton. Shown via Next.js's automatic Suspense
 * boundary during route transitions inside (app) — keeps the sidebar mounted
 * and replaces the content area with a placeholder so navigation feels
 * instant even before the next page's bundle is ready.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="space-y-2">
            <Bar className="h-5 w-40" />
            <Bar className="h-3 w-56" />
          </div>
          <Bar className="h-8 w-32" />
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Bar className="h-[420px] rounded-lg" />
          <Bar className="h-[420px] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted/40 ${className ?? ""}`}
      aria-hidden
    />
  );
}
