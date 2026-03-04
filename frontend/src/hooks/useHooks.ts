import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { hooksApi } from '@/api/client'
import type {
  BuiltinHook,
  HookConfig,
  HookConfigCreate,
  HookConfigUpdate,
  PaginatedResponse,
} from '@/api/types'

const KEY = ['hooks']

export function useBuiltinHooks() {
  return useQuery({
    queryKey: [...KEY, 'builtins'],
    queryFn: async () => {
      const resp = await hooksApi.builtins()
      return resp.data as BuiltinHook[]
    },
  })
}

export function useHookConfigs(options: { includeDeleted?: boolean; skip?: number } = {}) {
  const { includeDeleted = false, skip = 0 } = options
  return useQuery({
    queryKey: [...KEY, { includeDeleted, skip }],
    queryFn: async () => {
      const resp = await hooksApi.list({
        ...(includeDeleted ? { include_deleted: true } : {}),
        skip,
        limit: 25,
      })
      return resp.data as PaginatedResponse<HookConfig>
    },
    placeholderData: keepPreviousData,
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
