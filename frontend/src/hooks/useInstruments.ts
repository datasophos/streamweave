import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { instrumentsApi, serviceAccountsApi } from '@/api/client'
import type { Instrument, InstrumentCreate, InstrumentUpdate, ServiceAccount, ServiceAccountCreate, ServiceAccountUpdate } from '@/api/types'

const INSTRUMENTS_KEY = ['instruments']
const SERVICE_ACCOUNTS_KEY = ['service-accounts']

export function useInstruments() {
  return useQuery({
    queryKey: INSTRUMENTS_KEY,
    queryFn: async () => {
      const resp = await instrumentsApi.list()
      return resp.data as Instrument[]
    },
  })
}

export function useInstrument(id: string) {
  return useQuery({
    queryKey: [...INSTRUMENTS_KEY, id],
    queryFn: async () => {
      const resp = await instrumentsApi.get(id)
      return resp.data as Instrument
    },
    enabled: !!id,
  })
}

export function useCreateInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InstrumentCreate) => instrumentsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSTRUMENTS_KEY }),
  })
}

export function useUpdateInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InstrumentUpdate }) =>
      instrumentsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSTRUMENTS_KEY }),
  })
}

export function useDeleteInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => instrumentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSTRUMENTS_KEY }),
  })
}

// Service Accounts
export function useServiceAccounts() {
  return useQuery({
    queryKey: SERVICE_ACCOUNTS_KEY,
    queryFn: async () => {
      const resp = await serviceAccountsApi.list()
      return resp.data as ServiceAccount[]
    },
  })
}

export function useCreateServiceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ServiceAccountCreate) => serviceAccountsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: SERVICE_ACCOUNTS_KEY }),
  })
}

export function useUpdateServiceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceAccountUpdate }) =>
      serviceAccountsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: SERVICE_ACCOUNTS_KEY }),
  })
}

export function useDeleteServiceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => serviceAccountsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: SERVICE_ACCOUNTS_KEY }),
  })
}
