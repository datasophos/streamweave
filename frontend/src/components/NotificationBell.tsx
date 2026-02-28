import { useEffect, useRef, useState } from 'react'
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
  useDismissNotification,
} from '@/hooks/useNotifications'
import type { NotificationRecord } from '@/api/types'

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-1.732-1h3.464A2 2 0 0110 18z" />
    </svg>
  )
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationRecord
  onRead: (id: string) => void
}) {
  const dismiss = useDismissNotification()

  return (
    <div
      className={`px-4 py-3 border-b border-sw-border-sub last:border-0 ${
        notification.read ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium text-sw-fg ${notification.read ? '' : 'font-semibold'}`}
          >
            {notification.title}
          </p>
          <p className="text-xs text-sw-fg-muted mt-0.5 line-clamp-2">{notification.message}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!notification.read && (
            <button
              onClick={() => onRead(notification.id)}
              className="text-xs text-sw-brand hover:underline whitespace-nowrap"
              aria-label="Mark as read"
            >
              Mark read
            </button>
          )}
          <button
            onClick={() => dismiss.mutate(notification.id)}
            className="text-xs text-sw-fg-faint hover:text-sw-fg-muted transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
      <p className="text-xs text-sw-fg-faint mt-1">
        {new Date(notification.created_at).toLocaleString()}
      </p>
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: unreadData } = useUnreadCount()
  const { data: notifications } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const unreadCount = unreadData?.count ?? 0

  const openDropdown = () => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(true)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative p-1.5 rounded text-sw-fg-muted hover:text-sw-fg hover:bg-sw-hover transition-colors"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-sw-brand rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="fixed w-80 bg-sw-surface border border-sw-border rounded-lg shadow-xl z-50 overflow-hidden"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-sw-border">
            <h3 className="text-sm font-semibold text-sw-fg">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-sw-brand hover:underline"
                disabled={markAll.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-sw-fg-muted text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={(id) => markRead.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
