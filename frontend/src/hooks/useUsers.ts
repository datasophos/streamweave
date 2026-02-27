import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { usersApi, authApi } from '@/api/client'
import type { User, UserCreate, UserUpdate } from '@/api/types'

const KEY = ['users']

export function useUsers(includeDeleted = false) {
  return useQuery({
    queryKey: [...KEY, { includeDeleted }],
    queryFn: async () => {
      const resp = await usersApi.list(includeDeleted ? { include_deleted: true } : undefined)
      return resp.data as User[]
    },
    placeholderData: keepPreviousData,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UserCreate) => authApi.register(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRestoreUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
