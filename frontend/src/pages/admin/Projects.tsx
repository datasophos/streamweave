import { useEffect, useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Toggle } from '@/components/Toggle'
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useRestoreProject,
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
} from '@/hooks/useProjects'
import { useUsers } from '@/hooks/useUsers'
import { useGroups } from '@/hooks/useGroups'
import type { Project, ProjectCreate, ProjectMemberAdd } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; project: Project }
  | { kind: 'confirmDelete'; project: Project }
  | { kind: 'members'; project: Project }

function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initial?: { name?: string | null; description?: string | null }
  onSubmit: (data: ProjectCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { t } = useTranslation('projects')
  const [form, setForm] = useState<ProjectCreate>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
  })
  const set = (k: keyof ProjectCreate, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="space-y-4"
    >
      {error != null && <ErrorMessage error={error} />}
      <div>
        <label className="label">{t('form_name')}</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('form_description')}</label>
        <input
          className="input"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('cancel')}
        </button>
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}

function MembersPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation('projects')
  const { t: tc } = useTranslation('common')
  const { data: members = [], isLoading } = useProjectMembers(project.id)
  const { data: users = [] } = useUsers()
  const { data: groups = [] } = useGroups()
  const addMember = useAddProjectMember(project.id)
  const removeMember = useRemoveProjectMember(project.id)
  const [memberType, setMemberType] = useState<'user' | 'group'>('user')
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const memberIds = new Set(
    members.filter((m) => m.member_type === memberType).map((m) => m.member_id)
  )

  const availableUsers = users.filter((u) => !memberIds.has(u.id) && !u.deleted_at)
  const availableGroups = groups.filter((g) => !memberIds.has(g.id) && !g.deleted_at)

  const handleAdd = () => {
    const data: ProjectMemberAdd = { member_type: memberType, member_id: selectedId }
    addMember.mutate(data, { onSuccess: () => setSelectedId('') })
  }

  const getMemberLabel = (memberId: string, type: 'user' | 'group') => {
    if (type === 'user') {
      return users.find((u) => u.id === memberId)?.email ?? memberId
    }
    return groups.find((g) => g.id === memberId)?.name ?? memberId
  }

  return (
    <Modal title={t('modal_members', { name: project.name })} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <select
            className="input w-28"
            value={memberType}
            onChange={(e) => {
              setMemberType(e.target.value as 'user' | 'group')
              setSelectedId('')
            }}
          >
            <option value="user">{t('member_type_user')}</option>
            <option value="group">{t('member_type_group')}</option>
          </select>
          <select
            className="input flex-1"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">{t('select_member')}</option>
            {memberType === 'user'
              ? availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))
              : availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
          </select>
          <button
            className="btn-primary"
            disabled={!selectedId || addMember.isPending}
            onClick={handleAdd}
          >
            {t('add_member')}
          </button>
        </div>
        {addMember.error != null && <ErrorMessage error={addMember.error} />}
        {isLoading ? (
          <p className="text-sw-muted text-sm">{tc('loading')}</p>
        ) : members.length === 0 ? (
          <p className="text-sw-muted text-sm">{t('no_members')}</p>
        ) : (
          <ul className="divide-y divide-sw-border border border-sw-border rounded-lg overflow-hidden">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={m.member_type === 'group' ? 'badge-blue' : 'badge-gray'}>
                    {m.member_type === 'group' ? t('member_type_group') : t('member_type_user')}
                  </span>
                  <span className="text-sm">{getMemberLabel(m.member_id, m.member_type)}</span>
                </div>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => removeMember.mutate(m.member_id)}
                  disabled={removeMember.isPending}
                >
                  {tc('remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

export function Projects() {
  const { t } = useTranslation('projects')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const [showDeleted, setShowDeleted] = useState(false)

  const { data: projects = [], isLoading } = useProjects(showDeleted)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const restoreProject = useRestoreProject()

  const columns = [
    { header: t('col_name'), key: 'name' as const },
    {
      header: t('col_description'),
      render: (row: Project) => <span className="text-sw-muted">{row.description ?? '—'}</span>,
    },
    {
      header: tc('status'),
      render: (row: Project) =>
        row.deleted_at ? (
          <span className="badge-gray">{tc('deleted')}</span>
        ) : (
          <span className="badge-green">{tc('active')}</span>
        ),
    },
    {
      header: tc('actions'),
      render: (row: Project) =>
        row.deleted_at ? (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => restoreProject.mutate(row.id)}
          >
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'members', project: row })}
            >
              {t('members')}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'edit', project: row })}
            >
              {tc('edit')}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setModal({ kind: 'confirmDelete', project: row })}
            >
              {tc('delete')}
            </button>
          </div>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={<FolderKanban size={20} />}
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            {t('new_project')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sw-border flex justify-end">
          <Toggle checked={showDeleted} onChange={setShowDeleted} label={tc('show_deleted')} />
        </div>
        <Table
          columns={columns}
          data={projects}
          isLoading={isLoading}
          emptyMessage={t('no_projects')}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title={t('modal_create')} onClose={close} size="sm">
          <ProjectForm
            onSubmit={(data) => createProject.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createProject.isPending}
            error={createProject.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title={t('modal_edit', { name: modal.project.name })} onClose={close} size="sm">
          <ProjectForm
            initial={modal.project}
            onSubmit={(data) =>
              updateProject.mutate({ id: modal.project.id, data }, { onSuccess: close })
            }
            onCancel={close}
            isLoading={updateProject.isPending}
            error={updateProject.error}
          />
        </Modal>
      )}

      {modal.kind === 'members' && <MembersPanel project={modal.project} onClose={close} />}

      {modal.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('confirm_delete', { name: modal.project.name })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => deleteProject.mutate(modal.project.id, { onSuccess: close })}
          onCancel={close}
          isPending={deleteProject.isPending}
        />
      )}
    </div>
  )
}
