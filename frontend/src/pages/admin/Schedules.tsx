import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Toggle } from '@/components/Toggle'
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useRestoreSchedule,
} from '@/hooks/useSchedules'
import { useInstruments } from '@/hooks/useInstruments'
import { useStorageLocations } from '@/hooks/useStorage'
import type { HarvestSchedule, HarvestScheduleCreate } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; schedule: HarvestSchedule }
  | { kind: 'confirmDelete'; schedule: HarvestSchedule }

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
  const { t } = useTranslation('schedules')
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
        <label className="label">{t('form_instrument')}</label>
        <select
          className="input"
          required
          value={form.instrument_id}
          onChange={(e) => set('instrument_id', e.target.value)}
        >
          <option value="">{t('select_instrument')}</option>
          {instruments.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t('form_storage')}</label>
        <select
          className="input"
          required
          value={form.default_storage_location_id}
          onChange={(e) => set('default_storage_location_id', e.target.value)}
        >
          <option value="">{t('select_storage')}</option>
          {storageLocations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t('form_cron')}</label>
        <input
          className="input font-mono"
          required
          value={form.cron_expression}
          onChange={(e) => set('cron_expression', e.target.value)}
          placeholder="0 * * * *"
        />
        <p className="mt-1 text-xs text-sw-fg-faint">
          {t('form_cron_hint')} — {t('form_cron_help')}{' '}
          <a
            href="https://crontab.guru/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline hover:text-sw-fg-muted"
          >
            crontab.guru
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="sched-enabled"
          checked={form.enabled as boolean}
          onChange={(e) => set('enabled', e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="sched-enabled" className="text-sm font-medium text-sw-fg-2">
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

export function Schedules() {
  const { t } = useTranslation('schedules')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const [showDeleted, setShowDeleted] = useState(false)

  const { data: schedules = [], isLoading } = useSchedules(showDeleted)
  const { data: instruments = [] } = useInstruments()
  const { data: storageLocations = [] } = useStorageLocations()

  const create = useCreateSchedule()
  const update = useUpdateSchedule()
  const del = useDeleteSchedule()
  const restore = useRestoreSchedule()

  const instMap = Object.fromEntries(instruments.map((i) => [i.id, i.name]))
  const storageMap = Object.fromEntries(storageLocations.map((s) => [s.id, s.name]))

  const columns = [
    {
      header: t('col_instrument'),
      render: (row: HarvestSchedule) => instMap[row.instrument_id] ?? row.instrument_id.slice(0, 8),
    },
    {
      header: t('col_storage'),
      render: (row: HarvestSchedule) =>
        storageMap[row.default_storage_location_id] ?? row.default_storage_location_id.slice(0, 8),
    },
    {
      header: t('col_cron'),
      render: (row: HarvestSchedule) => (
        <code className="text-xs bg-sw-subtle px-1 py-0.5 rounded text-sw-fg-2">
          {row.cron_expression}
        </code>
      ),
    },
    {
      header: t('col_prefect'),
      render: (row: HarvestSchedule) =>
        row.prefect_deployment_id ? (
          <span className="badge-green">{t('synced')}</span>
        ) : (
          <span className="badge-yellow">{t('not_synced')}</span>
        ),
    },
    {
      header: tc('status'),
      render: (row: HarvestSchedule) =>
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
      render: (row: HarvestSchedule) =>
        row.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restore.mutate(row.id)}>
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'edit', schedule: row })}
            >
              {tc('edit')}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setModal({ kind: 'confirmDelete', schedule: row })}
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
            {t('new_schedule')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sw-border flex justify-end">
          <Toggle checked={showDeleted} onChange={setShowDeleted} label={tc('show_deleted')} />
        </div>
        <Table
          columns={columns}
          data={schedules}
          isLoading={isLoading}
          emptyMessage={t('no_schedules')}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title={t('modal_new')} onClose={close}>
          <ScheduleForm
            onSubmit={(data) => create.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={create.isPending}
            error={create.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title={t('modal_edit')} onClose={close}>
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

      {modal.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('confirm_delete', { cron: modal.schedule.cron_expression })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => del.mutate(modal.schedule.id, { onSuccess: close })}
          onCancel={close}
          isPending={del.isPending}
        />
      )}
    </div>
  )
}
