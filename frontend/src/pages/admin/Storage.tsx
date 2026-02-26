import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
  | { kind: 'confirmDelete'; location: StorageLocation }

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
  const { t } = useTranslation('storage')
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
        <label className="label">{t('form_name')}</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('form_type')}</label>
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
        <label className="label">{t('form_base_path')}</label>
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
          {t('form_enabled')}
        </label>
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

export function Storage() {
  const { t } = useTranslation('storage')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })

  const { data: locations = [], isLoading } = useStorageLocations()
  const create = useCreateStorageLocation()
  const update = useUpdateStorageLocation()
  const del = useDeleteStorageLocation()

  const columns = [
    { header: tc('name'), key: 'name' as const },
    {
      header: t('col_type'),
      render: (row: StorageLocation) => {
        const cls =
          row.type === 'posix'
            ? 'badge-blue'
            : row.type === 's3'
              ? 'badge-yellow'
              : row.type === 'nfs'
                ? 'badge-green'
                : 'badge-gray'
        return <span className={cls}>{row.type.toUpperCase()}</span>
      },
    },
    { header: t('col_base_path'), key: 'base_path' as const },
    {
      header: tc('status'),
      render: (row: StorageLocation) =>
        row.enabled ? (
          <span className="badge-green">{tc('enabled')}</span>
        ) : (
          <span className="badge-gray">{tc('disabled')}</span>
        ),
    },
    {
      header: tc('actions'),
      render: (row: StorageLocation) => (
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setModal({ kind: 'edit', location: row })}
          >
            {tc('edit')}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => setModal({ kind: 'confirmDelete', location: row })}
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
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            {t('new_storage_location')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <Table
          columns={columns}
          data={locations}
          isLoading={isLoading}
          emptyMessage={t('no_locations')}
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title={t('modal_new')} onClose={close}>
          <StorageForm
            onSubmit={(data) => create.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={create.isPending}
            error={create.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title={t('modal_edit')} onClose={close}>
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

      {modal.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('confirm_delete', { name: modal.location.name })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => del.mutate(modal.location.id, { onSuccess: close })}
          onCancel={close}
          isPending={del.isPending}
        />
      )}
    </div>
  )
}
