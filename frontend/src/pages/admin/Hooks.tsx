import { useState } from 'react'
import { Webhook } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Tooltip } from '@/components/Tooltip'
import { Table } from '@/components/Table'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorMessage } from '@/components/ErrorMessage'
import { Toggle } from '@/components/Toggle'
import {
  useBuiltinHooks,
  useHookConfigs,
  useCreateHookConfig,
  useUpdateHookConfig,
  useDeleteHookConfig,
  useRestoreHookConfig,
} from '@/hooks/useHooks'
import { useInstruments } from '@/hooks/useInstruments'
import type { HookConfig, HookConfigCreate, HookTrigger, HookImplementation } from '@/api/types'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; hook: HookConfig }
  | { kind: 'confirmDelete'; hook: HookConfig }

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
  const { t } = useTranslation('hooks')
  const { data: instruments = [] } = useInstruments()
  const { data: builtins = [] } = useBuiltinHooks()
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
          <label className="label">{t('form_name')}</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="label">{t('form_description')}</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div>
          <label className="label">
            {t('form_trigger')}
            <Tooltip text={t('form_trigger_tip')} id="tip-hook-trigger" />
          </label>
          <select
            className="input"
            value={form.trigger}
            onChange={(e) => set('trigger', e.target.value as HookTrigger)}
          >
            <option value="pre_transfer">{t('trigger_pre')}</option>
            <option value="post_transfer">{t('trigger_post')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('form_implementation')}</label>
          <select
            className="input"
            value={form.implementation}
            onChange={(e) => set('implementation', e.target.value as HookImplementation)}
          >
            <option value="builtin">{t('impl_builtin')}</option>
            <option value="python_script">{t('impl_python')}</option>
            <option value="http_webhook">{t('impl_webhook')}</option>
          </select>
        </div>
        {form.implementation === 'builtin' &&
          (() => {
            const selected = builtins.find((b) => b.name === form.builtin_name)
            const triggerMismatch =
              selected &&
              selected.trigger !== 'both' &&
              ((selected.trigger === 'pre' && form.trigger !== 'pre_transfer') ||
                (selected.trigger === 'post' && form.trigger !== 'post_transfer'))
            return (
              <div className="col-span-2 space-y-1">
                <label className="label">{t('form_builtin_name')}</label>
                <select
                  className="input"
                  value={form.builtin_name}
                  onChange={(e) => set('builtin_name', e.target.value)}
                >
                  <option value="">{t('builtin_select_placeholder')}</option>
                  {builtins.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.display_name}
                    </option>
                  ))}
                </select>
                {selected && <p className="text-xs text-sw-fg-3">{selected.description}</p>}
                {triggerMismatch && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t('builtin_trigger_mismatch', {
                      expected: selected.trigger === 'pre' ? t('trigger_pre') : t('trigger_post'),
                    })}
                  </p>
                )}
              </div>
            )
          })()}
        {form.implementation === 'python_script' && (
          <div className="col-span-2">
            <label className="label">
              {t('form_script_path')}
              <Tooltip text={t('form_script_path_tip')} id="tip-hook-script-path" />
            </label>
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
            <label className="label">{t('form_webhook_url')}</label>
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
          <label className="label">
            {t('form_instrument')}
            <Tooltip text={t('form_instrument_tip')} id="tip-hook-instrument" />
          </label>
          <select
            className="input"
            value={form.instrument_id ?? ''}
            onChange={(e) => set('instrument_id', e.target.value || undefined)}
          >
            <option value="">{t('global_instrument')}</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">
            {t('form_priority')}
            <Tooltip text={t('form_priority_tip')} id="tip-hook-priority" />
          </label>
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
          <label htmlFor="hook-enabled" className="text-sm font-medium text-sw-fg-2">
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

export function Hooks() {
  const { t } = useTranslation('hooks')
  const { t: tc } = useTranslation('common')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const close = () => setModal({ kind: 'none' })
  const [showDeleted, setShowDeleted] = useState(false)

  const { data: hooks = [], isLoading } = useHookConfigs(showDeleted)
  const { data: instruments = [] } = useInstruments()

  const create = useCreateHookConfig()
  const update = useUpdateHookConfig()
  const del = useDeleteHookConfig()
  const restore = useRestoreHookConfig()

  const instMap = Object.fromEntries(instruments.map((i) => [i.id, i.name]))

  const columns = [
    { header: tc('name'), key: 'name' as const },
    {
      header: t('col_trigger'),
      render: (row: HookConfig) => (
        <span className={row.trigger === 'pre_transfer' ? 'badge-yellow' : 'badge-blue'}>
          {row.trigger === 'pre_transfer' ? t('trigger_pre') : t('trigger_post')}
        </span>
      ),
    },
    { header: t('col_implementation'), key: 'implementation' as const },
    {
      header: t('col_scope'),
      render: (row: HookConfig) =>
        row.instrument_id
          ? (instMap[row.instrument_id] ?? row.instrument_id.slice(0, 8))
          : t('scope_global'),
    },
    { header: t('col_priority'), key: 'priority' as const },
    {
      header: tc('status'),
      render: (row: HookConfig) =>
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
      render: (row: HookConfig) =>
        row.deleted_at ? (
          <button className="btn btn-sm btn-secondary" onClick={() => restore.mutate(row.id)}>
            {tc('restore')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setModal({ kind: 'edit', hook: row })}
            >
              {tc('edit')}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setModal({ kind: 'confirmDelete', hook: row })}
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
        icon={<Webhook size={20} />}
        action={
          <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}>
            {t('new_hook')}
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-sw-border flex justify-end">
          <Toggle checked={showDeleted} onChange={setShowDeleted} label={tc('show_deleted')} />
        </div>
        <Table
          columns={columns}
          data={hooks}
          isLoading={isLoading}
          emptyMessage={t('no_hooks')}
          rowClassName={(row) => (row.deleted_at ? 'opacity-50' : '')}
        />
      </div>

      {modal.kind === 'create' && (
        <Modal title={t('modal_new')} onClose={close} size="lg">
          <HookForm
            onSubmit={(data) => create.mutate(data, { onSuccess: close })}
            onCancel={close}
            isLoading={create.isPending}
            error={create.error}
          />
        </Modal>
      )}

      {modal.kind === 'edit' && (
        <Modal title={t('modal_edit')} onClose={close} size="lg">
          <HookForm
            initial={modal.hook}
            onSubmit={(data) => update.mutate({ id: modal.hook.id, data }, { onSuccess: close })}
            onCancel={close}
            isLoading={update.isPending}
            error={update.error}
          />
        </Modal>
      )}

      {modal.kind === 'confirmDelete' && (
        <ConfirmDialog
          title={t('confirm_delete', { name: modal.hook.name })}
          message={tc('delete_warning')}
          confirmLabel={tc('delete')}
          onConfirm={() => del.mutate(modal.hook.id, { onSuccess: close })}
          onCancel={close}
          isPending={del.isPending}
        />
      )}
    </div>
  )
}
