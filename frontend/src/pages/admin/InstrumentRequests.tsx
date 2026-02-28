import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useInstrumentRequests, useReviewInstrumentRequest } from '@/hooks/useInstrumentRequests'
import type { InstrumentRequestRecord } from '@/api/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const FREQ_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  every_4h: 'Every 4 hours',
  daily: 'Daily',
  weekly: 'Weekly',
  not_sure: 'Not sure',
}

function RequestDetailModal({
  request,
  onClose,
}: {
  request: InstrumentRequestRecord
  onClose: () => void
}) {
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved')
  const [notes, setNotes] = useState(request.admin_notes ?? '')
  const review = useReviewInstrumentRequest()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    try {
      await review.mutateAsync({
        id: request.id,
        data: { status, admin_notes: notes || undefined },
      })
      onClose()
    } catch {
      // error is surfaced via review.isError
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-sw-surface border border-sw-border rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-sw-fg">Review Request</h2>

        <div className="space-y-1.5 text-sm bg-sw-hover rounded-lg p-4">
          <div>
            <span className="font-medium text-sw-fg">Instrument: </span>
            <span className="text-sw-fg-2">{request.name}</span>
          </div>
          <div>
            <span className="font-medium text-sw-fg">Requester: </span>
            <span className="text-sw-fg-2">
              {request.requester_email ?? `${request.requester_id.slice(0, 8)}…`}
            </span>
          </div>
          <div>
            <span className="font-medium text-sw-fg">Location: </span>
            <span className="text-sw-fg-2">{request.location}</span>
          </div>
          <div>
            <span className="font-medium text-sw-fg">Frequency: </span>
            <span className="text-sw-fg-2">
              {FREQ_LABELS[request.harvest_frequency] ?? request.harvest_frequency}
            </span>
          </div>
          {request.description && (
            <div>
              <span className="font-medium text-sw-fg">Description: </span>
              <span className="text-sw-fg-2">{request.description}</span>
            </div>
          )}
          <div>
            <span className="font-medium text-sw-fg">Justification: </span>
            <span className="text-sw-fg-2">{request.justification}</span>
          </div>
          <div>
            <span className="font-medium text-sw-fg">Submitted: </span>
            <span className="text-sw-fg-2">
              {new Date(request.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sw-fg">Status: </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[request.status]}`}
            >
              {STATUS_LABELS[request.status]}
            </span>
          </div>
        </div>

        <div className="border-t border-sw-border pt-4 space-y-3">
          <div className="space-y-2">
            <label className="label">Decision</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="approved"
                  checked={status === 'approved'}
                  onChange={() => setStatus('approved')}
                />
                <span className="text-sm text-sw-fg">Approve</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="rejected"
                  checked={status === 'rejected'}
                  onChange={() => setStatus('rejected')}
                />
                <span className="text-sm text-sw-fg">Reject</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label">Admin Notes (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes visible to the requester…"
            />
          </div>
        </div>

        {review.isError && (
          <p className="text-sm text-sw-error-fg">Failed to submit review. Please try again.</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary" disabled={review.isPending}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={status === 'approved' ? 'btn-primary' : 'btn-danger'}
            disabled={review.isPending}
          >
            {review.isPending ? 'Saving…' : status === 'approved' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function InstrumentRequests() {
  const { data: requests, isLoading, isError } = useInstrumentRequests()
  const [viewing, setViewing] = useState<InstrumentRequestRecord | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? requests : requests?.filter((r) => r.status === filter)

  return (
    <div>
      <PageHeader
        title="Instrument Requests"
        description="Review user requests to add instruments to the harvest system."
        icon={<ClipboardList size={20} />}
      />

      {viewing && <RequestDetailModal request={viewing} onClose={() => setViewing(null)} />}

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <label className="label mb-0">Filter:</label>
          <select className="input w-36" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {isLoading && <p className="text-sw-fg-muted">Loading…</p>}
        {isError && <p className="text-sw-error-fg">Failed to load requests.</p>}

        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sw-border text-left">
                  <th className="pb-2 pr-4 text-sw-fg-muted font-medium">Instrument</th>
                  <th className="pb-2 pr-4 text-sw-fg-muted font-medium">Requester</th>
                  <th className="pb-2 pr-4 text-sw-fg-muted font-medium">Status</th>
                  <th className="pb-2 pr-4 text-sw-fg-muted font-medium">Submitted</th>
                  <th className="pb-2 text-sw-fg-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!filtered || filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sw-fg-muted">
                      No requests found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((req) => (
                    <tr key={req.id} className="border-b border-sw-border-sub">
                      <td className="py-2 pr-4 font-medium text-sw-fg">{req.name}</td>
                      <td className="py-2 pr-4 text-sw-fg-muted">
                        {req.requester_email ?? `${req.requester_id.slice(0, 8)}…`}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[req.status]}`}
                        >
                          {STATUS_LABELS[req.status]}
                        </span>
                        {req.admin_notes && (
                          <p className="text-xs text-sw-fg-faint mt-0.5 max-w-[150px] truncate">
                            {req.admin_notes}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-sw-fg-muted text-xs">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => setViewing(req)}
                          className="btn-secondary text-xs py-1"
                        >
                          {req.status === 'pending' ? 'Review' : 'Re-review'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
