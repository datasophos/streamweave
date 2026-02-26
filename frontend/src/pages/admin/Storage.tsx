import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  useStorageLocations,
  useCreateStorageLocation,
  useUpdateStorageLocation,
  useDeleteStorageLocation,
} from '@/hooks/useStorage'
import type { StorageLocation, StorageLocationCreate, StorageType } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; location: StorageLocation }

function StorageForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initial?: Partial<StorageLocation>
  onSubmit: (data: StorageLocationCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const [form, setForm] = useState<StorageLocationCreate>({
    name: initial?.name ?? '',
    type: initial?.type ?? 'posix',
    base_path: initial?.base_path ?? '',
    enabled: initial?.enabled ?? true,
  })
  const set = (k: keyof StorageLocationCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

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
        <label className="label">Name *</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Type *</label>
        <select
          className="input"
          value={form.type}
          onChange={(e) => set('type', e.target.value as StorageType)}
        >
          <option value="posix">POSIX</option>
          <option value="s3">S3</option>
          <option value="cifs">CIFS/SMB</option>
          <option value="nfs">NFS</option>
        </select>
      </div>
      <div>
        <label className="label">Base Path *</label>
        <input
          className="input"
          required
          value={form.base_path}
          onChange={(e) => set('base_path', e.target.value)}
          placeholder="/storage/archive"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="sl-enabled"
          checked={form.enabled as boolean}
          onChange={(e) => set('enabled', e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="sl-enabled" className="text-sm font-medium text-sw-fg-2">
          Enabled
        </label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export function Storage() {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })

  const { data: locations = [], isLoading } = useStorageLocations()
  const create = useCreateStorageLocation()
  const update = useUpdateStorageLocation()
  const del = useDeleteStorageLocation()

  const columns = [
    { header: 'Name', key: 'name' as const },
    { header: 'Type', key: 'type' as const },
    { header: 'Base Path', key: 'base_path' as const },
    {
      header: 'Status',
      render: (row: StorageLocation) =>
        row.enabled ? (
          <span className="badge-green">Enabled</span>
        ) : (
          <span className="badge-gray">Disabled</span>
        ),
    },
    {
      header: 'Actions',
      render: (row: StorageLocation) => (
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setModal({ kind: 'edit', location: row })}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Delete ${row.name}?`)) del.mutate(row.id)
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Storage Locations"
        description="Configure destinations for harvested data"
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            New Storage Location
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <Table
          columns={columns}
          data={locations}
          isLoading={isLoading}
          emptyMessage="No storage locations configured."
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title="New Storage Location" onClose={close}>
          <StorageForm
            onSubmit={(data) => create.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={create.isPending}
            error={create.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title="Edit Storage Location" onClose={close}>
          <StorageForm
            initial={modal.location}
            onSubmit={(data) =>
              update.mutate({ id: modal.location.id, data }, { onSuccess: close })
            }
            onCancel={close}
            isLoading={update.isPending}
            error={update.error}
          />
        </Modal>
      )}
    </div>
  )
}
