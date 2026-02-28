import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Toggle } from '@/components/Toggle'
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useRestoreGroup,
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
} from '@/hooks/useGroups'
import { useUsers } from '@/hooks/useUsers'
import type { Group, GroupCreate } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; group: Group }
  | { kind: 'confirmDelete'; group: Group }
  | { kind: 'members'; group: Group }

function GroupForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initial?: { name?: string | null; description?: string | null }
  onSubmit: (data: GroupCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { t } = useTranslation('groups')
  const [form, setForm] = useState<GroupCreate>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
  })
  const set = (k: keyof GroupCreate, v: string) => setForm((f) => ({ ...f, [k]: v }))

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

function MembersPanel({ group, onClose }: { group: Group; onClose: () => void }) {
  const { t } = useTranslation('groups')
  const { t: tc } = useTranslation('common')
  const { data: members = [], isLoading } = useGroupMembers(group.id)
  const { data: users = [] } = useUsers()
  const addMember = useAddGroupMember(group.id)
  const removeMember = useRemoveGroupMember(group.id)
  const [selectedUserId, setSelectedUserId] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const memberUserIds = new Set(members.map((m) => m.user_id))
  const availableUsers = users.filter((u) => !memberUserIds.has(u.id) && !u.deleted_at)

  const handleAdd = () => {
    addMember.mutate({ user_id: selectedUserId }, { onSuccess: () => setSelectedUserId('') })
  }

  const getUserEmail = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user?.email ?? userId
  }

  return (
    <Modal title={t('modal_members', { name: group.name })} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">{t('select_user')}</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={!selectedUserId || addMember.isPending}
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
              <li key={m.user_id} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm">{getUserEmail(m.user_id)}</span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => removeMember.mutate(m.user_id)}
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

export function Groups() {
  const { t } = useTranslation('groups')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const [showDeleted, setShowDeleted] = useState(false)

  const { data: groups = [], isLoading } = useGroups(showDeleted)
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const restoreGroup = useRestoreGroup()

  const columns = [
    { header: t('col_name'), key: 'name' as const },
    {
      header: t('col_description'),
      render: (row: Group) => <span className="text-sw-muted">{row.description ?? '—'}</span>,
    },
    {
      header: tc('status'),
      render: (row: Group) =>
        row.deleted_at ? (
          <span className="badge-gray">{tc('deleted')}</span>
        ) : (
          <span className="badge-green">{tc('active')}</span>
        ),
    },
    {
      header: tc('actions'),
      render: (row: Group) =>
        row.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restoreGroup.mutate(row.id)}>
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'members', group: row })}
            >
              {t('members')}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'edit', group: row })}
            >
              {tc('edit')}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setModal({ kind: 'confirmDelete', group: row })}
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
        icon={<UsersRound size={20} />}
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            {t('new_group')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sw-border flex justify-end">
          <Toggle checked={showDeleted} onChange={setShowDeleted} label={tc('show_deleted')} />
        </div>
        <Table
          columns={columns}
          data={groups}
          isLoading={isLoading}
          emptyMessage={t('no_groups')}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title={t('modal_create')} onClose={close} size="sm">
          <GroupForm
            onSubmit={(data) => createGroup.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createGroup.isPending}
            error={createGroup.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title={t('modal_edit', { name: modal.group.name })} onClose={close} size="sm">
          <GroupForm
            initial={modal.group}
            onSubmit={(data) =>
              updateGroup.mutate({ id: modal.group.id, data }, { onSuccess: close })
            }
            onCancel={close}
            isLoading={updateGroup.isPending}
            error={updateGroup.error}
          />
        </Modal>
      )}

      {modal.kind === 'members' && <MembersPanel group={modal.group} onClose={close} />}

      {modal.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('confirm_delete', { name: modal.group.name })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => deleteGroup.mutate(modal.group.id, { onSuccess: close })}
          onCancel={close}
          isPending={deleteGroup.isPending}
        />
      )}
    </div>
  )
}
