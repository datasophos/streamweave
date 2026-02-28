import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Trans } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { useCreateInstrumentRequest, useInstrumentRequests } from '@/hooks/useInstrumentRequests'
import type { InstrumentRequestRecord } from '@/api/types'

interface RequestForm {
  instrument_name: string
  location: string
  harvest_frequency: string
  description: string
  justification: string
}

const EMPTY_FORM: RequestForm = {
  instrument_name: '',
  location: '',
  harvest_frequency: '',
  description: '',
  justification: '',
}

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

function RequestModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('request')
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [submittedName, setSubmittedName] = useState('')
  const createRequest = useCreateInstrumentRequest()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (k: keyof RequestForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await createRequest.mutateAsync({
        name: form.instrument_name,
        location: form.location,
        harvest_frequency: form.harvest_frequency,
        description: form.description || undefined,
        justification: form.justification,
      })
      setSubmittedName(form.instrument_name)
      setSubmitted(true)
    } catch {
      // error is surfaced via createRequest.isError
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-sw-surface border border-sw-border rounded-xl shadow-xl w-full max-w-4xl mx-4 p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-sw-fg">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-sw-fg-muted hover:text-sw-fg transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-sw-ok-bg p-3">
                <svg
                  className="h-8 w-8 text-sw-ok-fg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-sw-fg mb-2">{t('success_title')}</h3>
            <p className="text-sw-fg-muted mb-6">
              <Trans
                i18nKey="success_message"
                ns="request"
                values={{ instrument_name: submittedName }}
                components={{ bold: <strong /> }}
              />
            </p>
            <button
              onClick={() => {
                setSubmitted(false)
                setForm(EMPTY_FORM)
              }}
              className="btn-secondary"
            >
              {t('submit_another')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">{t('form_instrument_name')}</label>
                <input
                  className="input"
                  required
                  value={form.instrument_name}
                  onChange={(e) => set('instrument_name', e.target.value)}
                  placeholder={t('placeholder_instrument_name')}
                />
              </div>
              <div>
                <label className="label">{t('form_location')}</label>
                <input
                  className="input"
                  required
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder={t('placeholder_location')}
                />
              </div>
              <div>
                <label className="label">{t('form_harvest_frequency')}</label>
                <select
                  className="input"
                  required
                  value={form.harvest_frequency}
                  onChange={(e) => set('harvest_frequency', e.target.value)}
                >
                  <option value="" disabled />
                  <option value="hourly">{t('freq_hourly')}</option>
                  <option value="every_4h">{t('freq_every_4h')}</option>
                  <option value="daily">{t('freq_daily')}</option>
                  <option value="weekly">{t('freq_weekly')}</option>
                  <option value="not_sure">{t('freq_not_sure')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('form_description')}</label>
                <textarea
                  className="input"
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={t('placeholder_description')}
                />
              </div>
              <div>
                <label className="label">{t('form_justification')}</label>
                <textarea
                  className="input"
                  rows={4}
                  required
                  value={form.justification}
                  onChange={(e) => set('justification', e.target.value)}
                  placeholder={t('placeholder_justification')}
                />
              </div>
            </div>
            {createRequest.isError && (
              <p className="text-sm text-sw-error-fg">{t('submit_error')}</p>
            )}
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={createRequest.isPending}>
                {createRequest.isPending ? t('submitting') : t('submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function RequestDetailModal({
  req,
  onClose,
}: {
  req: InstrumentRequestRecord
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-sw-surface border border-sw-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-sw-fg">{req.name}</h2>
          <button
            onClick={onClose}
            className="text-sw-fg-muted hover:text-sw-fg transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[req.status]}`}
          >
            {STATUS_LABELS[req.status]}
          </span>
          <span className="text-xs text-sw-fg-faint">
            {new Date(req.created_at).toLocaleDateString()}
          </span>
        </div>
        {req.admin_notes && (
          <div>
            <p className="text-xs font-medium text-sw-fg-muted uppercase tracking-wide mb-1">
              Admin Notes
            </p>
            <p className="text-sm text-sw-fg">{req.admin_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RequestRow({ req }: { req: InstrumentRequestRecord }) {
  const [detailOpen, setDetailOpen] = useState(false)
  return (
    <>
      <tr className="border-b border-sw-border-sub">
        <td className="py-2 pr-4 font-medium text-sw-fg">{req.name}</td>
        <td className="py-2 pr-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[req.status]}`}
            >
              {STATUS_LABELS[req.status]}
            </span>
            {req.admin_notes && (
              <button
                onClick={() => setDetailOpen(true)}
                className="text-sw-fg-faint hover:text-sw-fg-muted transition-colors"
                aria-label="View admin notes"
                title="View admin notes"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </td>
        <td className="py-2 text-sw-fg-muted text-xs">
          {new Date(req.created_at).toLocaleDateString()}
        </td>
      </tr>
      {detailOpen && <RequestDetailModal req={req} onClose={() => setDetailOpen(false)} />}
    </>
  )
}

export function InstrumentRequest() {
  const { t } = useTranslation('request')
  const [modalOpen, setModalOpen] = useState(false)
  const { data: requests, isLoading } = useInstrumentRequests()

  return (
    <div>
      <PageHeader
        title={t('my_requests_title')}
        description={t('my_requests_description')}
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            {t('request_instrument_btn')}
          </button>
        }
      />

      <div className="card">
        {isLoading && <p className="text-sw-fg-muted">Loading…</p>}

        {!isLoading && (!requests || requests.length === 0) && (
          <p className="text-center py-8 text-sw-fg-muted">{t('no_requests')}</p>
        )}

        {!isLoading && requests && requests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sw-border text-left">
                  <th className="pb-2 pr-4 text-sw-fg-muted font-medium">Name</th>
                  <th className="pb-2 pr-4 text-sw-fg-muted font-medium">Status</th>
                  <th className="pb-2 text-sw-fg-muted font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <RequestRow key={req.id} req={req} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && <RequestModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
