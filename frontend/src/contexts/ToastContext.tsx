import { createContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

export interface ToastContextValue {
  toasts: Toast[]
  exitingIds: Set<number>
  showToast: (message: string, type?: ToastType) => void
  removeToast: (id: number) => void
  startExit: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
