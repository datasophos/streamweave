import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Trans } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'

interface RequestForm {
  instrument_name: string
  location: string
  contact_email: string
  description: string
  justification: string
}

export function InstrumentRequest() {
  const { t } = useTranslation('request')
  const [form, setForm] = useState<RequestForm>({
    instrument_name: '',
    location: '',
    contact_email: '',
    description: '',
    justification: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const set = (k: keyof RequestForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // In a full implementation, this would POST to an API endpoint.
    // For now, show a success state.
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div>
        <PageHeader title={t('title')} />
        <div className="card max-w-lg mx-auto text-center">
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
          <h2 className="text-xl font-semibold text-sw-fg mb-2">{t('success_title')}</h2>
          <p className="text-sw-fg-muted mb-6">
            <Trans
              i18nKey="success_message"
              ns="request"
              values={{
                instrument_name: form.instrument_name,
                contact_email: form.contact_email,
              }}
              components={{ bold: <strong /> }}
            />
          </p>
          <button
            onClick={() => {
              setSubmitted(false)
              setForm({
                instrument_name: '',
                location: '',
                contact_email: '',
                description: '',
                justification: '',
              })
            }}
            className="btn-secondary"
          >
            {t('submit_another')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <div className="card max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="label">{t('form_contact_email')}</label>
            <input
              className="input"
              type="email"
              required
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              placeholder={t('placeholder_contact_email')}
            />
          </div>
          <div>
            <label className="label">{t('form_description')}</label>
            <textarea
              className="input"
              rows={3}
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
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">
              {t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
