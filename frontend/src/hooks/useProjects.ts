import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { projectsApi } from '@/api/client'
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectMember,
  ProjectMemberAdd,
} from '@/api/types'

const KEY = ['projects']
const membersKey = (id: string) => ['projects', id, 'members']

export function useProjects(includeDeleted = false) {
  return useQuery({
    queryKey: [...KEY, { includeDeleted }],
    queryFn: async () => {
      const resp = await projectsApi.list(includeDeleted ? { include_deleted: true } : undefined)
      return resp.data as Project[]
    },
    placeholderData: keepPreviousData,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) => projectsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRestoreProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: membersKey(projectId),
    queryFn: async () => {
      const resp = await projectsApi.listMembers(projectId)
      return resp.data as ProjectMember[]
    },
  })
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectMemberAdd) => projectsApi.addMember(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(projectId) }),
  })
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => projectsApi.removeMember(projectId, memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(projectId) }),
  })
}
