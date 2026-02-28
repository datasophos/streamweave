import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/client'
import type { NotificationRecord, UnreadCount } from '@/api/types'

const NOTIF_KEY = ['notifications']
const UNREAD_KEY = ['notifications', 'unread-count']

export function useNotifications() {
  return useQuery({
    queryKey: NOTIF_KEY,
    queryFn: async () => {
      const resp = await notificationsApi.list()
      return resp.data as NotificationRecord[]
    },
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const resp = await notificationsApi.unreadCount()
      return resp.data as UnreadCount
    },
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEY })
      qc.invalidateQueries({ queryKey: UNREAD_KEY })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEY })
      qc.invalidateQueries({ queryKey: UNREAD_KEY })
    },
  })
}

export function useDismissNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEY })
      qc.invalidateQueries({ queryKey: UNREAD_KEY })
    },
  })
}
