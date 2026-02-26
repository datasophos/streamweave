import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  useInstruments,
  useCreateInstrument,
  useUpdateInstrument,
  useDeleteInstrument,
  useServiceAccounts,
  useCreateServiceAccount,
  useDeleteServiceAccount,
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
  | { kind: 'createServiceAccount' }

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
  const [form, setForm] = useState<InstrumentCreate>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    cifs_host: initial?.cifs_host ?? '',
    cifs_share: initial?.cifs_share ?? '',
    cifs_base_path: initial?.cifs_base_path ?? '',
    service_account_id: initial?.service_account_id ?? '',
    transfer_adapter: initial?.transfer_adapter ?? 'rclone',
    enabled: initial?.enabled ?? true,
  })

  const set = (k: keyof InstrumentCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

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
            Name *
          </label>
          <input
            id="inst-name"
            className="input"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="inst-description" className="label">
            Description
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
            Location
          </label>
          <input
            id="inst-location"
            className="input"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-cifs-host" className="label">
            CIFS Host *
          </label>
          <input
            id="inst-cifs-host"
            className="input"
            required
            value={form.cifs_host}
            onChange={(e) => set('cifs_host', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-cifs-share" className="label">
            CIFS Share *
          </label>
          <input
            id="inst-cifs-share"
            className="input"
            required
            value={form.cifs_share}
            onChange={(e) => set('cifs_share', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="inst-base-path" className="label">
            Base Path
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
            Transfer Adapter
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
            Service Account
          </label>
          <select
            id="inst-sa"
            className="input"
            value={form.service_account_id}
            onChange={(e) => set('service_account_id', e.target.value)}
          >
            <option value="">— None —</option>
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
            Enabled
          </label>
        </div>
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
  const [form, setForm] = useState<ServiceAccountCreate>({ name: '', username: '', password: '' })
  const set = (k: keyof ServiceAccountCreate, v: string) => setForm((f) => ({ ...f, [k]: v }))

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
          Name *
        </label>
        <input
          id="sa-name"
          className="input"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="sa-domain" className="label">
          Domain
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
          Username *
        </label>
        <input
          id="sa-username"
          className="input"
          required
          value={form.username}
          onChange={(e) => set('username', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="sa-password" className="label">
          Password *
        </label>
        <input
          id="sa-password"
          className="input"
          type="password"
          required
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
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

export function Instruments() {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })

  const { data: instruments = [], isLoading: loadingInstruments } = useInstruments()
  const { data: serviceAccounts = [] } = useServiceAccounts()

  const createInst = useCreateInstrument()
  const updateInst = useUpdateInstrument()
  const deleteInst = useDeleteInstrument()
  const createSA = useCreateServiceAccount()
  const deleteSA = useDeleteServiceAccount()

  const saMap = Object.fromEntries(serviceAccounts.map((sa) => [sa.id, sa]))

  const instrumentColumns = [
    { header: 'Name', key: 'name' as const },
    { header: 'Host', key: 'cifs_host' as const },
    { header: 'Share', key: 'cifs_share' as const },
    {
      header: 'Service Account',
      render: (row: Instrument) =>
        row.service_account_id
          ? (saMap[row.service_account_id]?.name ?? row.service_account_id)
          : '—',
    },
    { header: 'Adapter', key: 'transfer_adapter' as const },
    {
      header: 'Status',
      render: (row: Instrument) =>
        row.enabled ? (
          <span className="badge-green">Enabled</span>
        ) : (
          <span className="badge-gray">Disabled</span>
        ),
    },
    {
      header: 'Actions',
      render: (row: Instrument) => (
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setModal({ kind: 'editInstrument', instrument: row })}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Delete ${row.name}?`)) deleteInst.mutate(row.id)
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  const saColumns = [
    { header: 'Name', key: 'name' as const },
    { header: 'Domain', render: (sa: ServiceAccount) => sa.domain ?? '—' },
    { header: 'Username', key: 'username' as const },
    {
      header: 'Created',
      render: (sa: ServiceAccount) => new Date(sa.created_at).toLocaleDateString(),
    },
    {
      header: 'Actions',
      render: (sa: ServiceAccount) => (
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm(`Delete ${sa.name}?`)) deleteSA.mutate(sa.id)
          }}
        >
          Delete
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Instruments"
        description="Manage scientific instruments and CIFS service accounts"
        action={
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => setModal({ kind: 'createServiceAccount' })}
            >
              New Service Account
            </button>
            <button className="btn-primary" onClick={() => setModal({ kind: 'createInstrument' })}>
              New Instrument
            </button>
          </div>
        }
      />

      <div className="card p-0 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-sw-border">
          <h2 className="text-base font-semibold text-sw-fg">Instruments</h2>
        </div>
        <Table columns={instrumentColumns} data={instruments} isLoading={loadingInstruments} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-sw-border">
          <h2 className="text-base font-semibold text-sw-fg">Service Accounts</h2>
        </div>
        <Table columns={saColumns} data={serviceAccounts} />
      </div>

      {modal.kind === 'createInstrument' && (
        <Modal title="New Instrument" onClose={close}>
          <InstrumentForm
            serviceAccounts={serviceAccounts}
            onSubmit={(data) => createInst.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createInst.isPending}
            error={createInst.error}
          />
        </Modal>
      )}

      {modal.kind === 'editInstrument' && (
        <Modal title="Edit Instrument" onClose={close}>
          <InstrumentForm
            initial={modal.instrument}
            serviceAccounts={serviceAccounts}
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
        <Modal title="New Service Account" onClose={close} size="sm">
          <ServiceAccountForm
            onSubmit={(data) => createSA.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={createSA.isPending}
            error={createSA.error}
          />
        </Modal>
      )}
    </div>
  )
}
