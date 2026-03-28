import { X } from 'lucide-react'
import { useToastStore } from '../store/toastStore'

export function Toaster() {
  const { toasts, dismissToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm w-full"
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="flex-shrink-0 p-1 rounded active:opacity-70"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
