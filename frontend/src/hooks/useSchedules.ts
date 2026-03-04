import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { schedulesApi } from '@/api/client'
import type {
  HarvestSchedule,
  HarvestScheduleCreate,
  HarvestScheduleUpdate,
  PaginatedResponse,
} from '@/api/types'

const KEY = ['schedules']

export function useSchedules(options: { includeDeleted?: boolean; skip?: number } = {}) {
  const { includeDeleted = false, skip = 0 } = options
  return useQuery({
    queryKey: [...KEY, { includeDeleted, skip }],
    queryFn: async () => {
      const resp = await schedulesApi.list({
        ...(includeDeleted ? { include_deleted: true } : {}),
        skip,
        limit: 25,
      })
      return resp.data as PaginatedResponse<HarvestSchedule>
    },
    placeholderData: keepPreviousData,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: HarvestScheduleCreate) => schedulesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: HarvestScheduleUpdate }) =>
      schedulesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRestoreSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => schedulesApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
