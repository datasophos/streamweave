import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'

interface Column<T> {
  header: string
  key?: keyof T
  render?: (row: T) => ReactNode
  className?: string
  sortable?: boolean
  sortKey?: keyof T
}

interface PaginationControls {
  skip: number
  limit: number
  total: number
  onPageChange: (newSkip: number) => void
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  isLoading?: boolean
  rowClassName?: (row: T) => string
  pagination?: PaginationControls
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  emptyMessage,
  isLoading,
  rowClassName,
  pagination,
}: TableProps<T>) {
  const { t } = useTranslation('common')
  const empty = emptyMessage ?? t('no_records')

  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortCol) return data
    return [...data].sort((a, b) => {
      const av = a[sortCol as keyof T] ?? ''
      const bv = b[sortCol as keyof T] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortCol, sortDir])

  function handleSort(col: Column<T>) {
    const key = String(col.sortKey ?? col.key)
    if (sortCol === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }

  if (isLoading) {
    return (
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
    )
  }

  const pageStart = pagination ? pagination.skip + 1 : 0
  const pageEnd = pagination ? Math.min(pagination.skip + pagination.limit, pagination.total) : 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max divide-y divide-sw-border">
        <thead className="bg-sw-subtle">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase tracking-wider ${
                  col.className ?? ''
                }`}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col)}
                    className="inline-flex items-center gap-1 hover:text-sw-fg transition-colors"
                  >
                    {col.header}
                    {sortCol === String(col.sortKey ?? col.key) ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-sw-surface divide-y divide-sw-border-sub">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sw-fg-faint text-sm"
              >
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-sw-hover transition-colors ${rowClassName ? rowClassName(row) : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`px-4 py-3 text-sm text-sw-fg ${col.className ?? ''}`}
                  >
                    {col.render
                      ? col.render(row)
                      : col.key !== undefined
                        ? String(row[col.key] ?? '')
                        : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-sw-border text-sm text-sw-fg-muted">
          <button
            type="button"
            disabled={pagination.skip === 0}
            onClick={() => pagination.onPageChange(Math.max(0, pagination.skip - pagination.limit))}
            className="btn-secondary disabled:opacity-40"
          >
            {t('previous')}
          </button>
          <span>
            {pageStart}–{pageEnd} {t('of')} {pagination.total}
          </span>
          <button
            type="button"
            disabled={pagination.skip + pagination.limit >= pagination.total}
            onClick={() => pagination.onPageChange(pagination.skip + pagination.limit)}
            className="btn-secondary disabled:opacity-40"
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  )
}
