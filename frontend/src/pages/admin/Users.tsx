import { useState } from 'react'
import { Users as UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from '@/hooks/useUsers'
import { Toggle } from '@/components/Toggle'
import { useAuth } from '@/contexts/AuthContext'
import type { User, UserCreate } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'editRole'; user: User }
  | { kind: 'confirmDelete'; user: User }

function CreateUserForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  onSubmit: (data: UserCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { t } = useTranslation('users')
  const [form, setForm] = useState<UserCreate>({ email: '', password: '', role: 'user' })
  const set = (k: keyof UserCreate, v: string) => setForm((f) => ({ ...f, [k]: v }))

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
        <label className="label">{t('form_email')}</label>
        <input
          className="input"
          type="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('form_password')}</label>
        <input
          className="input"
          type="password"
          required
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('form_role')}</label>
        <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
          <option value="user">{t('role_user')}</option>
          <option value="admin">{t('role_admin')}</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('cancel')}
        </button>
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? t('creating') : t('create_user')}
        </button>
      </div>
    </form>
  )
}

export function Users() {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const { user: me } = useAuth()
  const [showDeleted, setShowDeleted] = useState(false)

  const { data: users = [], isLoading } = useUsers(showDeleted)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const restoreUser = useRestoreUser()

  const [editRole, setEditRole] = useState<'admin' | 'user'>('user')

  const handleEditRole = (u: User) => {
    setEditRole(u.role)
    setModal({ kind: 'editRole', user: u })
  }

  const columns = [
    { header: t('col_email'), key: 'email' as const },
    {
      header: t('col_role'),
      render: (row: User) => (
        <span className={row.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{row.role}</span>
      ),
    },
    {
      header: tc('status'),
      render: (row: User) =>
        row.deleted_at ? (
          <span className="badge-gray">{tc('deleted')}</span>
        ) : row.is_active ? (
          <span className="badge-green">{t('status_active')}</span>
        ) : (
          <span className="badge-red">{t('status_inactive')}</span>
        ),
    },
    {
      header: t('col_verified'),
      render: (row: User) =>
        row.is_verified ? (
          <span className="badge-green">{t('verified_yes')}</span>
        ) : (
          <span className="badge-yellow">{t('verified_no')}</span>
        ),
    },
    {
      header: tc('actions'),
      render: (row: User) =>
        row.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restoreUser.mutate(row.id)}>
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-sm btn-secondary" onClick={() => handleEditRole(row)}>
              {t('edit_role')}
            </button>
            {row.id !== me?.id && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => setModal({ kind: 'confirmDelete', user: row })}
              >
                {tc('delete')}
              </button>
            )}
          </div>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={<UsersIcon size={20} />}
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            {t('new_user')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sw-border flex justify-end">
          <Toggle checked={showDeleted} onChange={setShowDeleted} label={tc('show_deleted')} />
        </div>
        <Table
          columns={columns}
          data={users}
          isLoading={isLoading}
          emptyMessage={t('no_users')}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title={t('modal_create')} onClose={close} size="sm">
          <CreateUserForm
            onSubmit={(data) => createUser.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createUser.isPending}
            error={createUser.error}
          />
        </Modal>
      )}

      {modal.kind === 'editRole' && (
        <Modal title={t('modal_edit_role', { email: modal.user.email })} onClose={close} size="sm">
          <div className="space-y-4">
            <div>
              <label className="label">{t('form_role')}</label>
              <select
                className="input"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
              >
                <option value="user">{t('role_user')}</option>
                <option value="admin">{t('role_admin')}</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={close} className="btn-secondary">
                {t('cancel')}
              </button>
              <button
                onClick={() =>
                  updateUser.mutate(
                    { id: modal.user.id, data: { role: editRole } },
                    { onSuccess: close }
                  )
                }
                disabled={updateUser.isPending}
                className="btn-primary"
              >
                {updateUser.isPending ? t('saving') : t('save')}
              </button>
            </div>
            {updateUser.error != null && <ErrorMessage error={updateUser.error} />}
          </div>
        </Modal>
      )}

      {modal.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('confirm_delete', { email: modal.user.email })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => deleteUser.mutate(modal.user.id, { onSuccess: close })}
          onCancel={close}
          isPending={deleteUser.isPending}
        />
      )}
    </div>
  )
}
