import { useToast } from '@/hooks/useToast'

export function Toasts() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const base =
          'pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium min-w-64 max-w-sm'
        const cls =
          toast.type === 'success'
            ? `${base} bg-green-600 text-white`
            : toast.type === 'error'
              ? `${base} bg-red-600 text-white`
              : `${base} bg-sw-bg-2 text-sw-fg border border-sw-border`
        return (
          <div key={toast.id} role="alert" className={cls}>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
