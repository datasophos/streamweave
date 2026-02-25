import { useQuery } from '@tanstack/react-query'
import { filesApi } from '@/api/client'
import type { FileRecord } from '@/api/types'

const KEY = ['files']

export function useFiles(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: async () => {
      const resp = await filesApi.list(params)
      return resp.data as FileRecord[]
    },
  })
}

export function useFile(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      const resp = await filesApi.get(id)
      return resp.data as FileRecord
    },
    enabled: !!id,
  })
}
