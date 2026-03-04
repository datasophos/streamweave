import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { groupsApi } from '@/api/client'
import type {
  Group,
  GroupCreate,
  GroupUpdate,
  GroupMember,
  GroupMemberAdd,
  PaginatedResponse,
} from '@/api/types'

const KEY = ['groups']
const membersKey = (id: string) => ['groups', id, 'members']

export function useGroups(
  options: { includeDeleted?: boolean; skip?: number; limit?: number } = {}
) {
  const { includeDeleted = false, skip = 0, limit = 25 } = options
  return useQuery({
    queryKey: [...KEY, { includeDeleted, skip, limit }],
    queryFn: async () => {
      const resp = await groupsApi.list({
        ...(includeDeleted ? { include_deleted: true } : {}),
        skip,
        limit,
      })
      return resp.data as PaginatedResponse<Group>
    },
    placeholderData: keepPreviousData,
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GroupCreate) => groupsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroupUpdate }) => groupsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRestoreGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => groupsApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: membersKey(groupId),
    queryFn: async () => {
      const resp = await groupsApi.listMembers(groupId)
      return resp.data as GroupMember[]
    },
  })
}

export function useAddGroupMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GroupMemberAdd) => groupsApi.addMember(groupId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(groupId) }),
  })
}

export function useRemoveGroupMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(groupId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(groupId) }),
  })
}
