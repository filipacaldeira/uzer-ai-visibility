import { AlertCircle, RefreshCw } from 'lucide-react'

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-28">
            <div className="skeleton h-3 w-24 mb-3" />
            <div className="skeleton h-8 w-16 mb-2" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card h-64"><div className="skeleton h-full w-full rounded-lg" /></div>
        <div className="card h-64"><div className="skeleton h-full w-full rounded-lg" /></div>
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="text-brand-danger" size={40} />
      <p className="text-brand-muted text-sm max-w-md text-center">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary flex items-center gap-2">
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'No data available for this period.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-brand-elevated flex items-center justify-center">
        <span className="text-2xl">📊</span>
      </div>
      <p className="text-brand-muted text-sm">{message}</p>
    </div>
  )
}
