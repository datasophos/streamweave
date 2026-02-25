import { useState } from 'react'
import { useFiles } from '@/hooks/useFiles'
import { useInstruments } from '@/hooks/useInstruments'
import { PageHeader } from '@/components/PageHeader'
import type { FileRecord } from '@/api/types'

function formatBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function MyFiles() {
  const [search, setSearch] = useState('')
  const [instrumentFilter, setInstrumentFilter] = useState('')

  const params: Record<string, unknown> = {}
  if (instrumentFilter) params['instrument_id'] = instrumentFilter

  const { data: files = [], isLoading } = useFiles(params)
  const { data: instruments = [] } = useInstruments()

  const instMap = Object.fromEntries(instruments.map((i) => [i.id, i.name]))

  const filtered = files.filter((f) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.filename.toLowerCase().includes(q) ||
      f.source_path.toLowerCase().includes(q) ||
      f.persistent_id.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <PageHeader title="My Files" description="Browse and search harvested files" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search by filename, path, or persistent ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <select
          value={instrumentFilter}
          onChange={(e) => setInstrumentFilter(e.target.value)}
          className="input sm:w-56"
        >
          <option value="">All instruments</option>
          {instruments.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading files…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            {search || instrumentFilter ? 'No files match your filters.' : 'No files discovered yet.'}
          </p>
        ) : (
          <>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
              {filtered.length} file{filtered.length !== 1 ? 's' : ''}
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instrument</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Persistent ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discovered</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((file: FileRecord) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{file.filename}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{file.source_path}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {instMap[file.instrument_id] ?? file.instrument_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatBytes(file.size_bytes)}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                        {file.persistent_id}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(file.first_discovered_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
