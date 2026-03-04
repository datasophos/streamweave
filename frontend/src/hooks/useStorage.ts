import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { storageApi } from '@/api/client'
import type {
  PaginatedResponse,
  StorageLocation,
  StorageLocationCreate,
  StorageLocationUpdate,
} from '@/api/types'

const KEY = ['storage']

export function useStorageLocations(
  options: { includeDeleted?: boolean; skip?: number; limit?: number } = {}
) {
  const { includeDeleted = false, skip = 0, limit = 25 } = options
  return useQuery({
    queryKey: [...KEY, { includeDeleted, skip, limit }],
    queryFn: async () => {
      const resp = await storageApi.list({
        ...(includeDeleted ? { include_deleted: true } : {}),
        skip,
        limit,
      })
      return resp.data as PaginatedResponse<StorageLocation>
    },
    placeholderData: keepPreviousData,
  })
}

export function useCreateStorageLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StorageLocationCreate) => storageApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateStorageLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StorageLocationUpdate }) =>
      storageApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteStorageLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => storageApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRestoreStorageLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => storageApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useTestStorageLocation() {
  return useMutation({
    mutationFn: (id: string) => storageApi.test(id),
  })
}
