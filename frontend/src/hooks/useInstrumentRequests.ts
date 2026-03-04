import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { instrumentRequestsApi } from '@/api/client'
import type {
  InstrumentRequestCreate,
  InstrumentRequestRecord,
  InstrumentRequestUpdate,
  PaginatedResponse,
} from '@/api/types'

const KEY = ['instrument-requests']

export function useInstrumentRequests(skip = 0) {
  return useQuery({
    queryKey: [...KEY, { skip }],
    queryFn: async () => {
      const resp = await instrumentRequestsApi.list({ skip, limit: 25 })
      return resp.data as PaginatedResponse<InstrumentRequestRecord>
    },
    placeholderData: keepPreviousData,
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
