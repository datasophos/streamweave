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
      <p className="text-sm font-medium text-sw-fg-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-sw-fg">{value}</p>
      {sub && <p className="mt-1 text-sm text-sw-fg-faint">{sub}</p>}
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
    <tr className="hover:bg-sw-hover">
      <td className="px-4 py-3 text-sm text-sw-fg font-mono">{t.id.slice(0, 8)}…</td>
      <td className="px-4 py-3 text-sm">
        <span className={STATUS_BADGE[t.status]}>{t.status}</span>
      </td>
      <td className="px-4 py-3 text-sm text-sw-fg-muted">
        {t.bytes_transferred != null ? `${(t.bytes_transferred / 1024).toFixed(1)} KB` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-sw-fg-faint">
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
        <span className="text-sm text-sw-fg-muted">System status:</span>
        {health?.status === 'ok' ? (
          <span className="badge-green">Healthy</span>
        ) : (
          <span className="badge-red">Unavailable</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isAdmin && <StatCard label="Instruments" value={instruments?.length ?? '—'} />}
        <StatCard label="Total Files" value={files?.length ?? '—'} />
        <StatCard
          label="Transfers"
          value={transfers?.length ?? '—'}
          sub={`${completed} completed`}
        />
        <StatCard label="In Progress" value={inProgress} />
        <StatCard label="Failed" value={failed} />
      </div>

      {/* Recent transfers */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-sw-border">
          <h2 className="text-base font-semibold text-sw-fg">Recent Transfers</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-sw-fg-faint">No transfers yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-sw-border-sub">
            <thead className="bg-sw-subtle">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Bytes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="bg-sw-surface divide-y divide-sw-border-sub">
              {recent.map((t) => (
                <TransferRow key={t.id} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Instrument status (admin only) */}
      {isAdmin && instruments && instruments.length > 0 && (
        <div className="card mt-6 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-sw-border">
            <h2 className="text-base font-semibold text-sw-fg">Instrument Status</h2>
          </div>
          <table className="min-w-full divide-y divide-sw-border-sub">
            <thead className="bg-sw-subtle">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Host
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Adapter
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-sw-surface divide-y divide-sw-border-sub">
              {instruments.map((inst) => (
                <tr key={inst.id} className="hover:bg-sw-hover">
                  <td className="px-4 py-3 text-sm font-medium text-sw-fg">{inst.name}</td>
                  <td className="px-4 py-3 text-sm text-sw-fg-muted">{inst.cifs_host}</td>
                  <td className="px-4 py-3 text-sm text-sw-fg-muted">{inst.transfer_adapter}</td>
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
