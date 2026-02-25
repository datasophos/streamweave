import { useQuery } from '@tanstack/react-query'
import { transfersApi } from '@/api/client'
import type { FileTransfer } from '@/api/types'

const KEY = ['transfers']

export function useTransfers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: async () => {
      const resp = await transfersApi.list(params)
      return resp.data as FileTransfer[]
    },
  })
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      const resp = await transfersApi.get(id)
      return resp.data as FileTransfer
    },
    enabled: !!id,
  })
}
