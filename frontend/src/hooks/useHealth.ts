import { useQuery } from '@tanstack/react-query'
import { healthApi } from '@/api/client'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const resp = await healthApi.check()
      return resp.data as { status: string }
    },
    refetchInterval: 30_000,
  })
}
