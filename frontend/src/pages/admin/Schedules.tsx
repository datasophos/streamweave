import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
} from '@/hooks/useSchedules'
import { useInstruments } from '@/hooks/useInstruments'
import { useStorageLocations } from '@/hooks/useStorage'
import type { HarvestSchedule, HarvestScheduleCreate } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; schedule: HarvestSchedule }

function ScheduleForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initial?: Partial<HarvestSchedule>
  onSubmit: (data: HarvestScheduleCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { data: instruments = [] } = useInstruments()
  const { data: storageLocations = [] } = useStorageLocations()

  const [form, setForm] = useState<HarvestScheduleCreate>({
    instrument_id: initial?.instrument_id ?? '',
    default_storage_location_id: initial?.default_storage_location_id ?? '',
    cron_expression: initial?.cron_expression ?? '0 * * * *',
    enabled: initial?.enabled ?? true,
  })
  const set = (k: keyof HarvestScheduleCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

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
        <label className="label">Instrument *</label>
        <select
          className="input"
          required
          value={form.instrument_id}
          onChange={(e) => set('instrument_id', e.target.value)}
        >
          <option value="">— Select instrument —</option>
          {instruments.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Default Storage Location *</label>
        <select
          className="input"
          required
          value={form.default_storage_location_id}
          onChange={(e) => set('default_storage_location_id', e.target.value)}
        >
          <option value="">— Select storage —</option>
          {storageLocations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Cron Expression *</label>
        <input
          className="input font-mono"
          required
          value={form.cron_expression}
          onChange={(e) => set('cron_expression', e.target.value)}
          placeholder="0 * * * *"
        />
        <p className="mt-1 text-xs text-gray-400">
          Standard 5-field cron: minute hour day month weekday
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="sched-enabled"
          checked={form.enabled ?? true}
          onChange={(e) => set('enabled', e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="sched-enabled" className="text-sm font-medium text-gray-700">
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

export function Schedules() {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })

  const { data: schedules = [], isLoading } = useSchedules()
  const { data: instruments = [] } = useInstruments()
  const { data: storageLocations = [] } = useStorageLocations()

  const create = useCreateSchedule()
  const update = useUpdateSchedule()
  const del = useDeleteSchedule()

  const instMap = Object.fromEntries(instruments.map((i) => [i.id, i.name]))
  const storageMap = Object.fromEntries(storageLocations.map((s) => [s.id, s.name]))

  const columns = [
    {
      header: 'Instrument',
      render: (row: HarvestSchedule) => instMap[row.instrument_id] ?? row.instrument_id.slice(0, 8),
    },
    {
      header: 'Storage',
      render: (row: HarvestSchedule) =>
        storageMap[row.default_storage_location_id] ?? row.default_storage_location_id.slice(0, 8),
    },
    {
      header: 'Cron',
      render: (row: HarvestSchedule) => (
        <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{row.cron_expression}</code>
      ),
    },
    {
      header: 'Prefect',
      render: (row: HarvestSchedule) =>
        row.prefect_deployment_id ? (
          <span className="badge-green">Synced</span>
        ) : (
          <span className="badge-yellow">Not synced</span>
        ),
    },
    {
      header: 'Status',
      render: (row: HarvestSchedule) =>
        row.enabled ? (
          <span className="badge-green">Enabled</span>
        ) : (
          <span className="badge-gray">Disabled</span>
        ),
    },
    {
      header: 'Actions',
      render: (row: HarvestSchedule) => (
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setModal({ kind: 'edit', schedule: row })}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm('Delete this schedule?')) del.mutate(row.id)
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
        title="Harvest Schedules"
        description="Configure when each instrument is harvested"
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            New Schedule
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <Table
          columns={columns}
          data={schedules}
          isLoading={isLoading}
          emptyMessage="No schedules configured."
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title="New Harvest Schedule" onClose={close}>
          <ScheduleForm
            onSubmit={(data) => create.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={create.isPending}
            error={create.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title="Edit Harvest Schedule" onClose={close}>
          <ScheduleForm
            initial={modal.schedule}
            onSubmit={(data) =>
              update.mutate({ id: modal.schedule.id, data }, { onSuccess: close })
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
