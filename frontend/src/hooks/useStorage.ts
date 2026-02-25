import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { storageApi } from '@/api/client'
import type { StorageLocation, StorageLocationCreate, StorageLocationUpdate } from '@/api/types'

const KEY = ['storage']

export function useStorageLocations() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const resp = await storageApi.list()
      return resp.data as StorageLocation[]
    },
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
