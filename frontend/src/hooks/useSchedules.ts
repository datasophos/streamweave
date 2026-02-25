import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulesApi } from '@/api/client'
import type { HarvestSchedule, HarvestScheduleCreate, HarvestScheduleUpdate } from '@/api/types'

const KEY = ['schedules']

export function useSchedules() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const resp = await schedulesApi.list()
      return resp.data as HarvestSchedule[]
    },
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
