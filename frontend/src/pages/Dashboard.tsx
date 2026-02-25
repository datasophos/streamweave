import { useHealth } from '@/hooks/useHealth'
import { useTransfers } from '@/hooks/useTransfers'
import { useInstruments } from '@/hooks/useInstruments'
import { useFiles } from '@/hooks/useFiles'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/PageHeader'
import type { FileTransfer, TransferStatus } from '@/api/types'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </div>
  )
}

const STATUS_BADGE: Record<TransferStatus, string> = {
  pending: 'badge-yellow',
  in_progress: 'badge-blue',
  completed: 'badge-green',
  failed: 'badge-red',
  skipped: 'badge-gray',
}

function TransferRow({ t }: { t: FileTransfer }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-900 font-mono">{t.id.slice(0, 8)}…</td>
      <td className="px-4 py-3 text-sm">
        <span className={STATUS_BADGE[t.status]}>{t.status}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {t.bytes_transferred != null ? `${(t.bytes_transferred / 1024).toFixed(1)} KB` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {t.started_at ? new Date(t.started_at).toLocaleString() : '—'}
      </td>
    </tr>
  )
}

export function Dashboard() {
  const { isAdmin } = useAuth()
  const { data: health } = useHealth()
  const { data: transfers } = useTransfers()
  const { data: instruments } = useInstruments()
  const { data: files } = useFiles()

  const recent = transfers?.slice(0, 10) ?? []
  const completed = transfers?.filter((t) => t.status === 'completed').length ?? 0
  const failed = transfers?.filter((t) => t.status === 'failed').length ?? 0
  const inProgress = transfers?.filter((t) => t.status === 'in_progress').length ?? 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of instrument harvests and transfer activity"
      />

      {/* System health */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-gray-500">System status:</span>
        {health?.status === 'ok' ? (
          <span className="badge-green">Healthy</span>
        ) : (
          <span className="badge-red">Unavailable</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isAdmin && (
          <StatCard label="Instruments" value={instruments?.length ?? '—'} />
        )}
        <StatCard label="Total Files" value={files?.length ?? '—'} />
        <StatCard label="Transfers" value={transfers?.length ?? '—'} sub={`${completed} completed`} />
        <StatCard label="In Progress" value={inProgress} />
        <StatCard label="Failed" value={failed} />
      </div>

      {/* Recent transfers */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Transfers</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No transfers yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bytes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {recent.map((t) => <TransferRow key={t.id} t={t} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Instrument status (admin only) */}
      {isAdmin && instruments && instruments.length > 0 && (
        <div className="card mt-6 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Instrument Status</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adapter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {instruments.map((inst) => (
                <tr key={inst.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{inst.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inst.cifs_host}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{inst.transfer_adapter}</td>
                  <td className="px-4 py-3 text-sm">
                    {inst.enabled ? (
                      <span className="badge-green">Enabled</span>
                    ) : (
                      <span className="badge-gray">Disabled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
