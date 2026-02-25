import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/useUsers'
import { useAuth } from '@/contexts/AuthContext'
import type { User, UserCreate } from '@/api/types'

type ModalState = { kind: 'none' } | { kind: 'create' } | { kind: 'editRole'; user: User }

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
        <label className="label">Email *</label>
        <input
          className="input"
          type="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Password *</label>
        <input
          className="input"
          type="password"
          required
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Role</label>
        <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

export function Users() {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const { user: me } = useAuth()

  const { data: users = [], isLoading } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  const [editRole, setEditRole] = useState<'admin' | 'user'>('user')

  const handleEditRole = (u: User) => {
    setEditRole(u.role)
    setModal({ kind: 'editRole', user: u })
  }

  const columns = [
    { header: 'Email', key: 'email' as const },
    {
      header: 'Role',
      render: (row: User) => (
        <span className={row.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{row.role}</span>
      ),
    },
    {
      header: 'Status',
      render: (row: User) =>
        row.is_active ? (
          <span className="badge-green">Active</span>
        ) : (
          <span className="badge-red">Inactive</span>
        ),
    },
    {
      header: 'Verified',
      render: (row: User) =>
        row.is_verified ? (
          <span className="badge-green">Yes</span>
        ) : (
          <span className="badge-yellow">No</span>
        ),
    },
    {
      header: 'Actions',
      render: (row: User) => (
        <div className="flex gap-2">
          <button className="btn btn-sm btn-secondary" onClick={() => handleEditRole(row)}>
            Edit Role
          </button>
          {row.id !== me?.id && (
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (confirm(`Delete user ${row.email}?`)) deleteUser.mutate(row.id)
              }}
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage user accounts and roles"
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            New User
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <Table
          columns={columns}
          data={users}
          isLoading={isLoading}
          emptyMessage="No users found."
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title="Create User" onClose={close} size="sm">
          <CreateUserForm
            onSubmit={(data) => createUser.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createUser.isPending}
            error={createUser.error}
          />
        </Modal>
      )}

      {modal.kind === 'editRole' && (
        <Modal title={`Edit Role: ${modal.user.email}`} onClose={close} size="sm">
          <div className="space-y-4">
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={close} className="btn-secondary">
                Cancel
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
                {updateUser.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {updateUser.error != null && <ErrorMessage error={updateUser.error} />}
          </div>
        </Modal>
      )}
    </div>
  )
}
