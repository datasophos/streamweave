import { useTranslation } from 'react-i18next'
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

function TransferRow({ t: transfer }: { t: FileTransfer }) {
  return (
    <tr className="hover:bg-sw-hover">
      <td className="px-4 py-3 text-sm text-sw-fg font-mono">{transfer.id.slice(0, 8)}…</td>
      <td className="px-4 py-3 text-sm">
        <span className={STATUS_BADGE[transfer.status]}>{transfer.status}</span>
      </td>
      <td className="px-4 py-3 text-sm text-sw-fg-muted">
        {transfer.bytes_transferred != null
          ? `${(transfer.bytes_transferred / 1024).toFixed(1)} KB`
          : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-sw-fg-faint">
        {transfer.started_at ? new Date(transfer.started_at).toLocaleString() : '—'}
      </td>
    </tr>
  )
}

export function Dashboard() {
  const { t } = useTranslation('dashboard')
  const { isAdmin } = useAuth()
  const { data: health } = useHealth()
  const { data: transfers } = useTransfers()
  const { data: instruments } = useInstruments()
  const { data: files } = useFiles()

  const recent = transfers?.slice(0, 10) ?? []
  const completed = transfers?.filter((tr) => tr.status === 'completed').length ?? 0
  const failed = transfers?.filter((tr) => tr.status === 'failed').length ?? 0
  const inProgress = transfers?.filter((tr) => tr.status === 'in_progress').length ?? 0

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      {/* System health */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-sw-fg-muted">{t('system_status')}</span>
        {health?.status === 'ok' ? (
          <span className="badge-green">{t('healthy')}</span>
        ) : (
          <span className="badge-red">{t('unavailable')}</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isAdmin && <StatCard label={t('stat_instruments')} value={instruments?.length ?? '—'} />}
        <StatCard label={t('stat_total_files')} value={files?.length ?? '—'} />
        <StatCard
          label={t('stat_transfers')}
          value={transfers?.length ?? '—'}
          sub={t('stat_completed', { count: completed })}
        />
        <StatCard label={t('stat_in_progress')} value={inProgress} />
        <StatCard label={t('stat_failed')} value={failed} />
      </div>

      {/* Recent transfers */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-sw-border">
          <h2 className="text-base font-semibold text-sw-fg">{t('recent_transfers')}</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-sw-fg-faint">{t('no_transfers')}</p>
        ) : (
          <table className="min-w-full divide-y divide-sw-border-sub">
            <thead className="bg-sw-subtle">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_id')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_bytes')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_started')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-sw-surface divide-y divide-sw-border-sub">
              {recent.map((tr) => (
                <TransferRow key={tr.id} t={tr} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Instrument status (admin only) */}
      {isAdmin && instruments && instruments.length > 0 && (
        <div className="card mt-6 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-sw-border">
            <h2 className="text-base font-semibold text-sw-fg">{t('instrument_status')}</h2>
          </div>
          <table className="min-w-full divide-y divide-sw-border-sub">
            <thead className="bg-sw-subtle">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_host')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_adapter')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase">
                  {t('col_status')}
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
                      <span className="badge-green">{t('enabled')}</span>
                    ) : (
                      <span className="badge-gray">{t('disabled')}</span>
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
