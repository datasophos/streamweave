import { useState } from 'react'
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
  const [statusFilter, setStatusFilter] = useState('')

  const params: Record<string, unknown> = {}
  if (statusFilter) params['status'] = statusFilter

  const { data: transfers = [], isLoading } = useTransfers(params)
  const { data: storageLocations = [] } = useStorageLocations()

  const storageMap = Object.fromEntries(storageLocations.map((s) => [s.id, s.name]))

  return (
    <div>
      <PageHeader title="Transfer History" description="Track the status of all file transfers" />

      {/* Filter */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-48"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
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
            Loading…
          </div>
        ) : transfers.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">No transfers found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transfer ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Destination
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Adapter
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bytes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Checksum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {transfers.map((t: FileTransfer) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{t.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_BADGE[t.status]}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {storageMap[t.storage_location_id] ?? t.storage_location_id.slice(0, 8)}
                    {t.destination_path && (
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {t.destination_path}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.transfer_adapter}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatBytes(t.bytes_transferred)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {t.checksum_verified === true ? (
                      <span className="badge-green">Verified</span>
                    ) : t.checksum_verified === false ? (
                      <span className="badge-red">Failed</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {t.started_at ? new Date(t.started_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {transfers.some((t) => t.status === 'failed') && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-sm font-medium text-red-800 mb-2">Failed Transfers</h3>
          <ul className="space-y-1">
            {transfers
              .filter((t) => t.status === 'failed')
              .map((t) => (
                <li key={t.id} className="text-xs text-red-700">
                  <span className="font-mono">{t.id.slice(0, 8)}</span>:{' '}
                  {t.error_message ?? 'Unknown error'}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
