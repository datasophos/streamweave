import { useToast } from '@/hooks/useToast'

export function Toasts() {
  const { toasts, exitingIds, startExit } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const base =
          'pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium min-w-64 max-w-sm'
        const cls =
          toast.type === 'success'
            ? `${base} bg-sw-ok-bg border border-sw-ok-fg text-sw-ok-fg`
            : toast.type === 'error'
              ? `${base} bg-sw-err-bg border border-sw-err-bd text-sw-err-fg`
              : `${base} bg-sw-surface text-sw-fg border border-sw-border`
        const anim = exitingIds.has(toast.id) ? 'animate-toast-out' : 'animate-toast-in'
        return (
          <div key={toast.id} role="alert" className={`${cls} ${anim}`}>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => startExit(toast.id)}
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
