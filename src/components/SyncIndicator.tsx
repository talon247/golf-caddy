import { Cloud, Loader2, AlertTriangle, Smartphone } from 'lucide-react'

interface SyncIndicatorProps {
  status: 'synced' | 'pending' | 'error' | 'local'
  onRetry?: () => void
}

export function SyncIndicator({ status, onRetry }: SyncIndicatorProps) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Cloud size={13} className="text-[#2d5a27]" strokeWidth={2.5} />
        <span>Saved</span>
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Loader2 size={13} className="animate-spin" strokeWidth={2.5} />
        <span>Syncing…</span>
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-500">
        <AlertTriangle size={13} strokeWidth={2.5} />
        <span>Sync failed</span>
        {onRetry && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry()
            }}
            className="ml-0.5 text-xs font-semibold underline text-amber-600 active:opacity-70"
          >
            Retry
          </button>
        )}
      </span>
    )
  }

  // local
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      <Smartphone size={13} strokeWidth={2.5} />
      <span>Local only</span>
    </span>
  )
}
