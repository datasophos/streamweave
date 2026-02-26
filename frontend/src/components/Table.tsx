import type { ReactNode } from 'react'

interface Column<T> {
  header: string
  key?: keyof T
  render?: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  isLoading?: boolean
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  emptyMessage = 'No records found.',
  isLoading,
}: TableProps<T>) {
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
        Loading…
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-sw-border">
        <thead className="bg-sw-subtle">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-4 py-3 text-left text-xs font-medium text-sw-fg-muted uppercase tracking-wider ${
                  col.className ?? ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-sw-surface divide-y divide-sw-border-sub">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sw-fg-faint text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.id} className="hover:bg-sw-hover transition-colors">
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
    </div>
  )
}
