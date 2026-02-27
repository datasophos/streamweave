import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Toggle } from '@/components/Toggle'
import {
  useInstruments,
  useCreateInstrument,
  useUpdateInstrument,
  useDeleteInstrument,
  useRestoreInstrument,
  useServiceAccounts,
  useCreateServiceAccount,
  useDeleteServiceAccount,
  useRestoreServiceAccount,
} from '@/hooks/useInstruments'
import type {
  Instrument,
  ServiceAccount,
  InstrumentCreate,
  ServiceAccountCreate,
} from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'createInstrument' }
  | { kind: 'editInstrument'; instrument: Instrument }
  | { kind: 'confirmDeleteInstrument'; instrument: Instrument }
  | { kind: 'createServiceAccount' }
  | { kind: 'confirmDeleteServiceAccount'; sa: ServiceAccount }

function InstrumentForm({
  initial,
  serviceAccounts,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initial?: Partial<Instrument>
  serviceAccounts: ServiceAccount[]
  onSubmit: (data: InstrumentCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { t } = useTranslation('instruments')
  const [form, setForm] = useState<InstrumentCreate>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    pid: initial?.pid ?? '',
    cifs_host: initial?.cifs_host ?? '',
    cifs_share: initial?.cifs_share ?? '',
    cifs_base_path: initial?.cifs_base_path ?? '',
    service_account_id: initial?.service_account_id ?? '',
    transfer_adapter: initial?.transfer_adapter ?? 'rclone',
    enabled: initial?.enabled ?? true,
  })
  const [invalid, setInvalid] = useState(new Set<string>())

  const set = (k: keyof InstrumentCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const markInvalid = (field: string) => () => setInvalid((prev) => new Set(prev).add(field))
  const clearInvalid = (field: string) => () =>
    setInvalid((prev) => {
      const n = new Set(prev)
      n.delete(field)
      return n
    })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ ...form, service_account_id: form.service_account_id || undefined })
      }}
      className="space-y-4"
    >
      {error != null && <ErrorMessage error={error} />}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="inst-name" className="label">
            {t('form_name')}
          </label>
          <input
            id="inst-name"
            className="input"
            required
            value={form.name}
            aria-invalid={invalid.has('name') || undefined}
            onChange={(e) => {
              clearInvalid('name')()
              set('name', e.target.value)
            }}
            onInvalid={markInvalid('name')}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="inst-description" className="label">
            {t('form_description')}
          </label>
          <input
            id="inst-description"
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-location" className="label">
            {t('form_location')}
          </label>
          <input
            id="inst-location"
            className="input"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-pid" className="label">
            {t('form_pid')}
          </label>
          <input
            id="inst-pid"
            className="input"
            value={form.pid}
            onChange={(e) => set('pid', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-cifs-host" className="label">
            {t('form_cifs_host')}
          </label>
          <input
            id="inst-cifs-host"
            className="input"
            required
            value={form.cifs_host}
            aria-invalid={invalid.has('cifs_host') || undefined}
            onChange={(e) => {
              clearInvalid('cifs_host')()
              set('cifs_host', e.target.value)
            }}
            onInvalid={markInvalid('cifs_host')}
          />
        </div>
        <div>
          <label htmlFor="inst-cifs-share" className="label">
            {t('form_cifs_share')}
          </label>
          <input
            id="inst-cifs-share"
            className="input"
            required
            value={form.cifs_share}
            aria-invalid={invalid.has('cifs_share') || undefined}
            onChange={(e) => {
              clearInvalid('cifs_share')()
              set('cifs_share', e.target.value)
            }}
            onInvalid={markInvalid('cifs_share')}
          />
        </div>
        <div>
          <label htmlFor="inst-base-path" className="label">
            {t('form_base_path')}
          </label>
          <input
            id="inst-base-path"
            className="input"
            value={form.cifs_base_path}
            onChange={(e) => set('cifs_base_path', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-adapter" className="label">
            {t('form_adapter')}
          </label>
          <select
            id="inst-adapter"
            className="input"
            value={form.transfer_adapter}
            onChange={(e) => set('transfer_adapter', e.target.value)}
          >
            <option value="rclone">rclone</option>
            <option value="globus">Globus</option>
            <option value="rsync">rsync</option>
          </select>
        </div>
        <div>
          <label htmlFor="inst-sa" className="label">
            {t('form_service_account')}
          </label>
          <select
            id="inst-sa"
            className="input"
            value={form.service_account_id}
            onChange={(e) => set('service_account_id', e.target.value)}
          >
            <option value="">{t('form_none')}</option>
            {serviceAccounts.map((sa) => (
              <option key={sa.id} value={sa.id}>
                {sa.name} ({sa.username})
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={form.enabled as boolean}
            onChange={(e) => set('enabled', e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-sw-fg-2">
            {t('form_enabled')}
          </label>
        </div>
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

function ServiceAccountForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  onSubmit: (data: ServiceAccountCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { t } = useTranslation('instruments')
  const [form, setForm] = useState<ServiceAccountCreate>({ name: '', username: '', password: '' })
  const [invalid, setInvalid] = useState(new Set<string>())
  const set = (k: keyof ServiceAccountCreate, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const markInvalid = (field: string) => () => setInvalid((prev) => new Set(prev).add(field))
  const clearInvalid = (field: string) => () =>
    setInvalid((prev) => {
      const n = new Set(prev)
      n.delete(field)
      return n
    })

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
        <label htmlFor="sa-name" className="label">
          {t('sa_name')}
        </label>
        <input
          id="sa-name"
          className="input"
          required
          value={form.name}
          aria-invalid={invalid.has('name') || undefined}
          onChange={(e) => {
            clearInvalid('name')()
            set('name', e.target.value)
          }}
          onInvalid={markInvalid('name')}
        />
      </div>
      <div>
        <label htmlFor="sa-domain" className="label">
          {t('sa_domain')}
        </label>
        <input
          id="sa-domain"
          className="input"
          value={form.domain ?? ''}
          onChange={(e) => set('domain', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="sa-username" className="label">
          {t('sa_username')}
        </label>
        <input
          id="sa-username"
          className="input"
          required
          value={form.username}
          aria-invalid={invalid.has('username') || undefined}
          onChange={(e) => {
            clearInvalid('username')()
            set('username', e.target.value)
          }}
          onInvalid={markInvalid('username')}
        />
      </div>
      <div>
        <label htmlFor="sa-password" className="label">
          {t('sa_password')}
        </label>
        <input
          id="sa-password"
          className="input"
          type="password"
          required
          value={form.password}
          aria-invalid={invalid.has('password') || undefined}
          onChange={(e) => {
            clearInvalid('password')()
            set('password', e.target.value)
          }}
          onInvalid={markInvalid('password')}
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

export function Instruments() {
  const { t } = useTranslation('instruments')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const [showDeletedInst, setShowDeletedInst] = useState(false)
  const [showDeletedSA, setShowDeletedSA] = useState(false)

  const { data: instruments = [], isLoading: loadingInstruments } = useInstruments(showDeletedInst)
  const { data: serviceAccounts = [] } = useServiceAccounts(showDeletedSA)
  // For the service account selector in the instrument form, always fetch active only
  const { data: activeSAs = [] } = useServiceAccounts(false)

  const createInst = useCreateInstrument()
  const updateInst = useUpdateInstrument()
  const deleteInst = useDeleteInstrument()
  const restoreInst = useRestoreInstrument()
  const createSA = useCreateServiceAccount()
  const deleteSA = useDeleteServiceAccount()
  const restoreSA = useRestoreServiceAccount()

  const saMap = Object.fromEntries(serviceAccounts.map((sa) => [sa.id, sa]))

  const instrumentColumns = [
    { header: tc('name'), key: 'name' as const },
    { header: t('col_host'), key: 'cifs_host' as const },
    { header: t('col_share'), key: 'cifs_share' as const },
    {
      header: t('col_service_account'),
      render: (row: Instrument) =>
        row.service_account_id
          ? (saMap[row.service_account_id]?.name ?? row.service_account_id)
          : '—',
    },
    { header: t('col_adapter'), key: 'transfer_adapter' as const },
    {
      header: tc('status'),
      render: (row: Instrument) =>
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
      render: (row: Instrument) =>
        row.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restoreInst.mutate(row.id)}>
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'editInstrument', instrument: row })}
            >
              {tc('edit')}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setModal({ kind: 'confirmDeleteInstrument', instrument: row })}
            >
              {tc('delete')}
            </button>
          </div>
        ),
    },
  ]

  const saColumns = [
    { header: tc('name'), key: 'name' as const },
    { header: t('sa_domain'), render: (sa: ServiceAccount) => sa.domain ?? '—' },
    { header: t('col_username'), key: 'username' as const },
    {
      header: t('col_created'),
      render: (sa: ServiceAccount) => new Date(sa.created_at).toLocaleDateString(),
    },
    {
      header: tc('actions'),
      render: (sa: ServiceAccount) =>
        sa.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restoreSA.mutate(sa.id)}>
            {tc('restore')}
          </button>
        ) : (
          <button
            className="btn btn-sm btn-danger"
            onClick={() => setModal({ kind: 'confirmDeleteServiceAccount', sa })}
          >
            {tc('delete')}
          </button>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => setModal({ kind: 'createServiceAccount' })}
            >
              {t('new_service_account')}
            </button>
            <button className="btn-primary" onClick={() => setModal({ kind: 'createInstrument' })}>
              {t('new_instrument')}
            </button>
          </div>
        }
      />

      <div className="card p-0 overflow-hidden mb-8">
        <div className="px-4 py-4 border-b border-sw-border flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-sw-fg">
            <span>🔬</span>
            {t('instruments_section')}
          </h2>
          <Toggle
            id="show-deleted-inst"
            checked={showDeletedInst}
            onChange={setShowDeletedInst}
            label={tc('show_deleted')}
          />
        </div>
        <Table
          columns={instrumentColumns}
          data={instruments}
          isLoading={loadingInstruments}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-sw-border flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-sw-fg">
            <span>🔑</span>
            {t('service_accounts_section')}
          </h2>
          <Toggle
            id="show-deleted-sa"
            checked={showDeletedSA}
            onChange={setShowDeletedSA}
            label={tc('show_deleted')}
          />
        </div>
        <Table
          columns={saColumns}
          data={serviceAccounts}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      {modal.kind === 'createInstrument' && (
        <Modal title={t('modal_new_instrument')} onClose={close}>
          <InstrumentForm
            serviceAccounts={activeSAs}
            onSubmit={(data) => createInst.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createInst.isPending}
            error={createInst.error}
          />
        </Modal>
      )}

      {modal.kind === 'editInstrument' && (
        <Modal title={t('modal_edit_instrument')} onClose={close}>
          <InstrumentForm
            initial={modal.instrument}
            serviceAccounts={activeSAs}
            onSubmit={(data) =>
              updateInst.mutate({ id: modal.instrument.id, data }, { onSuccess: close })
            }
            onCancel={close}
            isLoading={updateInst.isPending}
            error={updateInst.error}
          />
        </Modal>
      )}

      {modal.kind === 'createServiceAccount' && (
        <Modal title={t('modal_new_service_account')} onClose={close} size="sm">
          <ServiceAccountForm
            onSubmit={(data) => createSA.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createSA.isPending}
            error={createSA.error}
          />
        </Modal>
      )}

      {modal.kind === 'confirmDeleteInstrument' && (
        <ConfirmDialog
          title={t('confirm_delete_instrument', { name: modal.instrument.name })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => deleteInst.mutate(modal.instrument.id, { onSuccess: close })}
          onCancel={close}
          isPending={deleteInst.isPending}
        />
      )}

      {modal.kind === 'confirmDeleteServiceAccount' && (
        <ConfirmDialog
          title={t('confirm_delete_sa', { name: modal.sa.name })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => deleteSA.mutate(modal.sa.id, { onSuccess: close })}
          onCancel={close}
          isPending={deleteSA.isPending}
        />
      )}
    </div>
  )
}
