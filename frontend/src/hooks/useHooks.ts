import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hooksApi } from '@/api/client'
import type { HookConfig, HookConfigCreate, HookConfigUpdate } from '@/api/types'

const KEY = ['hooks']

export function useHookConfigs(includeDeleted = false) {
  return useQuery({
    queryKey: [...KEY, { includeDeleted }],
    queryFn: async () => {
      const resp = await hooksApi.list(includeDeleted ? { include_deleted: true } : undefined)
      return resp.data as HookConfig[]
    },
  })
}

export function useCreateHookConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: HookConfigCreate) => hooksApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateHookConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: HookConfigUpdate }) => hooksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteHookConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => hooksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRestoreHookConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => hooksApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
