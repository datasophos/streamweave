import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTransfers } from '@/hooks/useTransfers'
import { useStorageLocations } from '@/hooks/useStorage'
import { PageHeader } from '@/components/PageHeader'
import type { FileTransfer, TransferStatus } from '@/api/types'

const STATUS_BADGE: Record<TransferStatus, string> = {
  pending: 'badge-yellow',
  in_progress: 'badge-blue',
  completed: 'badge-green',
  failed: 'badge-red',
  skipped: 'badge-gray',
}

function formatBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function Transfers() {
  const { t } = useTranslation('transfers')
  const [statusFilter, setStatusFilter] = useState('')

  const params: Record<string, unknown> = {}
  if (statusFilter) params['status'] = statusFilter

  const { data: transfers = [], isLoading } = useTransfers(params)
  const { data: storageLocations = [] } = useStorageLocations()

  const storageMap = Object.fromEntries(storageLocations.map((s) => [s.id, s.name]))

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      {/* Filter */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-48"
        >
          <option value="">{t('all_statuses')}</option>
          <option value="pending">{t('status_pending')}</option>
          <option value="in_progress">{t('status_in_progress')}</option>
          <option value="completed">{t('status_completed')}</option>
          <option value="failed">{t('status_failed')}</option>
          <option value="skipped">{t('status_skipped')}</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sw-fg-faint">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {t('loading')}
          </div>
        ) : transfers.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-sw-fg-faint">{t('no_transfers')}</p>
        ) : (
          <table className="min-w-full divide-y divide-sw-border-sub">
            <thead className="bg-sw-subtle">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_transfer_id')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_destination')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_adapter')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_bytes')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_checksum')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_started')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_completed')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-sw-surface divide-y divide-sw-border-sub">
              {transfers.map((tr: FileTransfer) => (
                <tr key={tr.id} className="hover:bg-sw-hover">
                  <td className="px-4 py-3 text-xs font-mono text-sw-fg-muted">
                    {tr.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className={STATUS_BADGE[tr.status]}>{tr.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-sw-fg-muted">
                    {storageMap[tr.storage_location_id] ?? tr.storage_location_id.slice(0, 8)}
                    {tr.destination_path && (
                      <div className="text-xs text-sw-fg-faint font-mono mt-0.5">
                        {tr.destination_path}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-sw-fg-muted">{tr.transfer_adapter}</td>
                  <td className="px-4 py-3 text-sm text-sw-fg-muted">
                    {formatBytes(tr.bytes_transferred)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tr.checksum_verified === true ? (
                      <span className="badge-green">{t('checksum_verified')}</span>
                    ) : tr.checksum_verified === false ? (
                      <span className="badge-red">{t('checksum_failed')}</span>
                    ) : (
                      <span className="text-sw-fg-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-sw-fg-faint">
                    {tr.started_at ? new Date(tr.started_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-sw-fg-faint">
                    {tr.completed_at ? new Date(tr.completed_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {transfers.some((tr) => tr.status === 'failed') && (
        <div className="mt-4 p-4 bg-sw-err-bg border border-sw-err-bd rounded-md">
          <h3 className="text-sm font-medium text-sw-err-fg mb-2">{t('failed_transfers')}</h3>
          <ul className="space-y-1">
            {transfers
              .filter((tr) => tr.status === 'failed')
              .map((tr) => (
                <li key={tr.id} className="text-xs text-sw-err-fg">
                  <span className="font-mono">{tr.id.slice(0, 8)}</span>:{' '}
                  {tr.error_message ?? 'Unknown error'}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
