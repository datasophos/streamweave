import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './ToastContext'
import type { ToastType } from './ToastContext'

const FADE_DURATION = 150

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([])
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set())
  const nextId = useRef(0)

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const startExit = useCallback(
    (id: number) => {
      setExitingIds((prev) => new Set(prev).add(id))
      setTimeout(() => {
        removeToast(id)
        setExitingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, FADE_DURATION)
    },
    [removeToast]
  )

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => startExit(id), 4000 - FADE_DURATION)
    },
    [startExit]
  )

  return (
    <ToastContext.Provider value={{ toasts, exitingIds, showToast, removeToast, startExit }}>
      {children}
    </ToastContext.Provider>
  )
}
