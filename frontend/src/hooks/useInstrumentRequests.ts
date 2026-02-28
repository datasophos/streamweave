import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { instrumentRequestsApi } from '@/api/client'
import type {
  InstrumentRequestCreate,
  InstrumentRequestRecord,
  InstrumentRequestUpdate,
} from '@/api/types'

const KEY = ['instrument-requests']

export function useInstrumentRequests() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const resp = await instrumentRequestsApi.list()
      return resp.data as InstrumentRequestRecord[]
    },
  })
}

export function useCreateInstrumentRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InstrumentRequestCreate) => instrumentRequestsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useReviewInstrumentRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InstrumentRequestUpdate }) =>
      instrumentRequestsApi.review(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
