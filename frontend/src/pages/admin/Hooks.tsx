import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  useHookConfigs,
  useCreateHookConfig,
  useUpdateHookConfig,
  useDeleteHookConfig,
} from '@/hooks/useHooks'
import { useInstruments } from '@/hooks/useInstruments'
import type { HookConfig, HookConfigCreate, HookTrigger, HookImplementation } from '@/api/types'

type ModalState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; hook: HookConfig }

function HookForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initial?: Partial<HookConfig>
  onSubmit: (data: HookConfigCreate) => void
  onCancel: () => void
  isLoading: boolean
  error: unknown
}) {
  const { data: instruments = [] } = useInstruments()
  const [form, setForm] = useState<HookConfigCreate>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    trigger: initial?.trigger ?? 'post_transfer',
    implementation: initial?.implementation ?? 'builtin',
    builtin_name: initial?.builtin_name ?? '',
    script_path: initial?.script_path ?? '',
    webhook_url: initial?.webhook_url ?? '',
    instrument_id: initial?.instrument_id ?? undefined,
    priority: initial?.priority ?? 0,
    enabled: initial?.enabled ?? true,
  })
  const set = (k: keyof HookConfigCreate, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="space-y-4"
    >
      {error != null && <ErrorMessage error={error} />}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Trigger *</label>
          <select
            className="input"
            value={form.trigger}
            onChange={(e) => set('trigger', e.target.value as HookTrigger)}
          >
            <option value="pre_transfer">Pre-transfer</option>
            <option value="post_transfer">Post-transfer</option>
          </select>
        </div>
        <div>
          <label className="label">Implementation *</label>
          <select
            className="input"
            value={form.implementation}
            onChange={(e) => set('implementation', e.target.value as HookImplementation)}
          >
            <option value="builtin">Built-in</option>
            <option value="python_script">Python Script</option>
            <option value="http_webhook">HTTP Webhook</option>
          </select>
        </div>
        {form.implementation === 'builtin' && (
          <div className="col-span-2">
            <label className="label">Built-in Name</label>
            <input
              className="input"
              value={form.builtin_name}
              onChange={(e) => set('builtin_name', e.target.value)}
              placeholder="e.g. nemo_status_check"
            />
          </div>
        )}
        {form.implementation === 'python_script' && (
          <div className="col-span-2">
            <label className="label">Script Path</label>
            <input
              className="input font-mono"
              value={form.script_path}
              onChange={(e) => set('script_path', e.target.value)}
              placeholder="/hooks/my_hook.py"
            />
          </div>
        )}
        {form.implementation === 'http_webhook' && (
          <div className="col-span-2">
            <label className="label">Webhook URL</label>
            <input
              className="input"
              type="url"
              value={form.webhook_url}
              onChange={(e) => set('webhook_url', e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>
        )}
        <div>
          <label className="label">Instrument (blank = global)</label>
          <select
            className="input"
            value={form.instrument_id ?? ''}
            onChange={(e) => set('instrument_id', e.target.value || undefined)}
          >
            <option value="">— Global —</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <input
            className="input"
            type="number"
            value={form.priority}
            onChange={(e) => set('priority', parseInt(e.target.value))}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="hook-enabled"
            checked={form.enabled as boolean}
            onChange={(e) => set('enabled', e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="hook-enabled" className="text-sm font-medium text-gray-700">
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

export function Hooks() {
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })

  const { data: hooks = [], isLoading } = useHookConfigs()
  const { data: instruments = [] } = useInstruments()

  const create = useCreateHookConfig()
  const update = useUpdateHookConfig()
  const del = useDeleteHookConfig()

  const instMap = Object.fromEntries(instruments.map((i) => [i.id, i.name]))

  const columns = [
    { header: 'Name', key: 'name' as const },
    {
      header: 'Trigger',
      render: (row: HookConfig) => (
        <span className={row.trigger === 'pre_transfer' ? 'badge-yellow' : 'badge-blue'}>
          {row.trigger === 'pre_transfer' ? 'Pre-transfer' : 'Post-transfer'}
        </span>
      ),
    },
    { header: 'Implementation', key: 'implementation' as const },
    {
      header: 'Scope',
      render: (row: HookConfig) =>
        row.instrument_id ? instMap[row.instrument_id] ?? row.instrument_id.slice(0, 8) : 'Global',
    },
    { header: 'Priority', key: 'priority' as const },
    {
      header: 'Status',
      render: (row: HookConfig) =>
        row.enabled ? (
          <span className="badge-green">Enabled</span>
        ) : (
          <span className="badge-gray">Disabled</span>
        ),
    },
    {
      header: 'Actions',
      render: (row: HookConfig) => (
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setModal({ kind: 'edit', hook: row })}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Delete hook "${row.name}"?`)) del.mutate(row.id)
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
        title="Hook Configurations"
        description="Configure pre- and post-transfer hooks"
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            New Hook
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <Table
          columns={columns}
          data={hooks}
          isLoading={isLoading}
          emptyMessage="No hooks configured."
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title="New Hook Configuration" onClose={close} size="lg">
          <HookForm
            onSubmit={(data) => create.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={create.isPending}
            error={create.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title="Edit Hook Configuration" onClose={close} size="lg">
          <HookForm
            initial={modal.hook}
            onSubmit={(data) => update.mutate({ id: modal.hook.id, data }, { onSuccess: close })}
            onCancel={close}
            isLoading={update.isPending}
            error={update.error}
          />
        </Modal>
      )}
    </div>
  )
}
