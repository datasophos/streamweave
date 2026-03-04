import { useMemo, useState } from 'react'
import { ScrollText, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { auditApi } from '@/api/client'
import type { AuditLogEntry, PaginatedResponse } from '@/api/types'

const ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  restore: 'Restore',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  restore: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

const ENTITY_TYPES = [
  'instrument',
  'storage_location',
  'service_account',
  'schedule',
  'hook',
  'group',
  'project',
]

const PAGE_SIZE = 50

function ChangesCell({ changes }: { changes: AuditLogEntry['changes'] }) {
  const [expanded, setExpanded] = useState(false)
  if (!changes || Object.keys(changes).length === 0)
    return <span className="text-sw-fg-faint">—</span>
  const fields = Object.keys(changes)
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-sw-brand hover:underline"
      >
        {fields.length} field{fields.length !== 1 ? 's' : ''} {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5">
          {fields.map((field) => (
            <div key={field} className="text-xs font-mono">
              <span className="text-sw-fg-muted">{field}:</span>{' '}
              <span className="line-through text-sw-fg-faint">
                {String(changes[field].before ?? '—')}
              </span>{' '}
              → <span className="text-sw-fg">{String(changes[field].after ?? '—')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AuditLog() {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [skip, setSkip] = useState(0)
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', entityType, action, skip],
    queryFn: async () => {
      const resp = await auditApi.list({
        entity_type: entityType || undefined,
        action: action || undefined,
        limit: PAGE_SIZE,
        skip,
      })
      return resp.data as PaginatedResponse<AuditLogEntry>
    },
  })

  const entries = useMemo(() => {
    const base = data?.items ?? []
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter((row) =>
      ['actor_email', 'entity_id', 'entity_type'].some((k) =>
        String(row[k as keyof typeof row] ?? '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [data, search])

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="A record of all admin actions on managed entities."
        icon={<ScrollText size={20} />}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sw-fg-faint pointer-events-none" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value)
            setSkip(0)
          }}
          className="input w-auto text-sm"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setSkip(0)
          }}
          className="input w-auto text-sm"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {(entityType || action) && (
          <button
            onClick={() => {
              setEntityType('')
              setAction('')
              setSkip(0)
            }}
            className="btn-secondary text-sm"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading && <p className="text-sw-fg-muted py-8 text-center">Loading...</p>}
      {isError && <p className="text-sw-err-fg py-4">Failed to load audit log.</p>}
      {!isLoading && !isError && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sw-border">
                  <th className="text-left py-2 px-3 text-sw-fg-muted font-medium">When</th>
                  <th className="text-left py-2 px-3 text-sw-fg-muted font-medium">Actor</th>
                  <th className="text-left py-2 px-3 text-sw-fg-muted font-medium">Action</th>
                  <th className="text-left py-2 px-3 text-sw-fg-muted font-medium">Entity</th>
                  <th className="text-left py-2 px-3 text-sw-fg-muted font-medium">Entity ID</th>
                  <th className="text-left py-2 px-3 text-sw-fg-muted font-medium">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sw-border-sub">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sw-fg-muted">
                      No audit entries found.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-sw-hover">
                      <td className="py-2 px-3 text-sw-fg-muted whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-sw-fg">{entry.actor_email}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[entry.action] ?? ''}`}
                        >
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sw-fg">
                        {entry.entity_type.replace('_', ' ')}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-sw-fg-muted">
                        {entry.entity_id.slice(0, 8)}…
                      </td>
                      <td className="py-2 px-3">
                        <ChangesCell changes={entry.changes} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-sw-fg-muted">
            <button
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              className="btn-secondary disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {Math.floor(skip / PAGE_SIZE) + 1}</span>
            <button
              disabled={data == null || skip + PAGE_SIZE >= data.total}
              onClick={() => setSkip(skip + PAGE_SIZE)}
              className="btn-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
