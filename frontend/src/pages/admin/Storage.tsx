import { useState } from 'react'
import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Toggle } from '@/components/Toggle'
import { useToast } from '@/hooks/useToast'
import {
  useStorageLocations,
  useCreateStorageLocation,
  useUpdateStorageLocation,
  useDeleteStorageLocation,
  useRestoreStorageLocation,
  useTestStorageLocation,
} from '@/hooks/useStorage'
import type { StorageLocation, StorageLocationCreate, StorageType } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; location: StorageLocation }
  | { kind: 'confirmDelete'; location: StorageLocation }

// Blank connection config shapes per type
const emptyS3 = () => ({
  bucket: '',
  region: '',
  endpoint_url: '',
  access_key_id: '',
  secret_access_key: '',
})

const emptyCIFS = () => ({
  host: '',
  share: '',
  domain: '',
  username: '',
  password: '',
})

const emptyNFS = () => ({
  host: '',
  export_path: '',
  mount_options: '',
})

function getDefaultConfig(type: StorageType): Record<string, string> | undefined {
  if (type === 's3') return emptyS3()
  if (type === 'cifs') return emptyCIFS()
  if (type === 'nfs') return emptyNFS()
  return undefined
}

function initConfigFromLocation(location: StorageLocation): Record<string, string> | undefined {
  const raw = location.connection_config as Record<string, string | null> | null
  if (!raw) return getDefaultConfig(location.type)
  // Merge raw values into blank template; coerce null → '' for safe input values
  const base = getDefaultConfig(location.type) ?? {}
  const merged = { ...base, ...raw }
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v ?? '']))
}

function S3Fields({
  config,
  isEdit,
  onChange,
}: {
  config: Record<string, string>
  isEdit: boolean
  onChange: (key: string, val: string) => void
}) {
  const { t } = useTranslation('storage')
  return (
    <>
      <div>
        <label className="label">{t('s3_bucket')}</label>
        <input
          className="input"
          required
          value={config.bucket}
          onChange={(e) => onChange('bucket', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('s3_region')}</label>
        <input
          className="input"
          required
          value={config.region}
          onChange={(e) => onChange('region', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('s3_endpoint_url')}</label>
        <input
          className="input"
          value={config.endpoint_url}
          onChange={(e) => onChange('endpoint_url', e.target.value)}
          placeholder="https://s3.example.com"
        />
      </div>
      <div>
        <label className="label">{t('s3_access_key_id')}</label>
        <input
          className="input"
          required
          value={config.access_key_id}
          onChange={(e) => onChange('access_key_id', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('s3_secret_access_key')}</label>
        <input
          className="input"
          type="password"
          required={!isEdit}
          value={config.secret_access_key}
          onChange={(e) => onChange('secret_access_key', e.target.value)}
          placeholder={isEdit ? t('secret_placeholder') : undefined}
          autoComplete="new-password"
        />
      </div>
    </>
  )
}

function CIFSFields({
  config,
  isEdit,
  onChange,
}: {
  config: Record<string, string>
  isEdit: boolean
  onChange: (key: string, val: string) => void
}) {
  const { t } = useTranslation('storage')
  return (
    <>
      <div>
        <label className="label">{t('cifs_host')}</label>
        <input
          className="input"
          required
          value={config.host}
          onChange={(e) => onChange('host', e.target.value)}
          placeholder="fileserver.lab.local"
        />
      </div>
      <div>
        <label className="label">{t('cifs_share')}</label>
        <input
          className="input"
          required
          value={config.share}
          onChange={(e) => onChange('share', e.target.value)}
          placeholder="data"
        />
      </div>
      <div>
        <label className="label">{t('cifs_domain')}</label>
        <input
          className="input"
          value={config.domain}
          onChange={(e) => onChange('domain', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('cifs_username')}</label>
        <input
          className="input"
          required
          value={config.username}
          onChange={(e) => onChange('username', e.target.value)}
        />
      </div>
      <div>
        <label className="label">{t('cifs_password')}</label>
        <input
          className="input"
          type="password"
          required={!isEdit}
          value={config.password}
          onChange={(e) => onChange('password', e.target.value)}
          placeholder={isEdit ? t('secret_placeholder') : undefined}
          autoComplete="new-password"
        />
      </div>
    </>
  )
}

function NFSFields({
  config,
  onChange,
}: {
  config: Record<string, string>
  onChange: (key: string, val: string) => void
}) {
  const { t } = useTranslation('storage')
  return (
    <>
      <div>
        <label className="label">{t('nfs_host')}</label>
        <input
          className="input"
          required
          value={config.host}
          onChange={(e) => onChange('host', e.target.value)}
          placeholder="nfsserver.lab.local"
        />
      </div>
      <div>
        <label className="label">{t('nfs_export_path')}</label>
        <input
          className="input"
          required
          value={config.export_path}
          onChange={(e) => onChange('export_path', e.target.value)}
          placeholder="/export/data"
        />
      </div>
      <div>
        <label className="label">{t('nfs_mount_options')}</label>
        <input
          className="input"
          value={config.mount_options}
          onChange={(e) => onChange('mount_options', e.target.value)}
          placeholder="rw,hard,intr"
        />
      </div>
    </>
  )
}

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
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState<StorageLocationCreate>({
    name: initial?.name ?? '',
    type: initial?.type ?? 'posix',
    base_path: initial?.base_path ?? '',
    enabled: initial?.enabled ?? true,
    connection_config: initial ? initConfigFromLocation(initial as StorageLocation) : undefined,
  })

  const set = (k: keyof StorageLocationCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const setConfig = (key: string, val: string) => {
    setForm((f) => ({
      ...f,
      // connection_config is always set when setConfig is called (typed storage types)
      connection_config: { ...(f.connection_config as Record<string, string>), [key]: val },
    }))
  }

  const handleTypeChange = (newType: StorageType) => {
    setForm((f) => ({
      ...f,
      type: newType,
      connection_config: getDefaultConfig(newType),
    }))
  }

  const config = (form.connection_config as Record<string, string>) ?? {}

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Strip empty optional fields from connection_config before submitting
    const cleaned = form.connection_config
      ? Object.fromEntries(
          Object.entries(form.connection_config as Record<string, string>).filter(
            ([, v]) => v !== ''
          )
        )
      : undefined
    onSubmit({
      ...form,
      connection_config: Object.keys(cleaned ?? {}).length ? cleaned : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          onChange={(e) => handleTypeChange(e.target.value as StorageType)}
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

      {form.type === 's3' && <S3Fields config={config} isEdit={isEdit} onChange={setConfig} />}
      {form.type === 'cifs' && <CIFSFields config={config} isEdit={isEdit} onChange={setConfig} />}
      {form.type === 'nfs' && <NFSFields config={config} onChange={setConfig} />}

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
  const [showDeleted, setShowDeleted] = useState(false)
  const { showToast } = useToast()

  const { data: locations = [], isLoading } = useStorageLocations(showDeleted)
  const create = useCreateStorageLocation()
  const update = useUpdateStorageLocation()
  const del = useDeleteStorageLocation()
  const restore = useRestoreStorageLocation()
  const testConn = useTestStorageLocation()

  const handleTest = (id: string) => {
    testConn.mutate(id, {
      onSuccess: () => showToast(t('test_ok'), 'success'),
      onError: (err) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        showToast(msg ?? tc('error_default'), 'error')
      },
    })
  }

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
        row.deleted_at ? (
          <span className="badge-gray">{tc('deleted')}</span>
        ) : row.enabled ? (
          <span className="badge-green">{tc('enabled')}</span>
        ) : (
          <span className="badge-gray">{tc('disabled')}</span>
        ),
    },
    {
      header: tc('actions'),
      render: (row: StorageLocation) =>
        row.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restore.mutate(row.id)}>
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => handleTest(row.id)}
              disabled={testConn.isPending && testConn.variables === row.id}
              aria-label={t('test_connection')}
            >
              {t('test_connection')}
            </button>
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
        icon={<HardDrive size={20} />}
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            {t('new_storage_location')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sw-border flex justify-end">
          <Toggle checked={showDeleted} onChange={setShowDeleted} label={tc('show_deleted')} />
        </div>
        <Table
          columns={columns}
          data={locations}
          isLoading={isLoading}
          emptyMessage={t('no_locations')}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
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
