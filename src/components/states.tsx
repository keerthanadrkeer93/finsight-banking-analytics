export function LoadingScreen() {
  return (
    <div className="mx-auto max-w-[1280px] animate-pulse space-y-6 px-4 py-8 sm:px-6" role="status" aria-label="Loading data">
      <div className="h-8 w-64 rounded bg-line" />
      <div className="h-24 max-w-3xl rounded bg-line" />
      <div className="h-32 rounded-lg bg-line" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-lg bg-line" />
        <div className="h-72 rounded-lg bg-line" />
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center" role="alert">
      <h2 className="text-lg font-semibold">The data could not be loaded</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <button type="button" onClick={onRetry} className="mt-5 h-10 rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90">Try again</button>
    </div>
  )
}

export function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">No transactions match this selection</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">The combination of dates and filters has no activity. Widen the date range or clear a filter.</p>
      <button type="button" onClick={onReset} className="mt-5 h-10 rounded-md border border-line px-4 text-sm font-medium hover:bg-bg">Reset all filters</button>
    </div>
  )
}
