import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/PageHeader'

interface RequestForm {
  instrument_name: string
  location: string
  contact_email: string
  description: string
  justification: string
}

export function InstrumentRequest() {
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
        <PageHeader title="Request Instrument Harvest" />
        <div className="card max-w-lg mx-auto text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Submitted</h2>
          <p className="text-gray-500 mb-6">
            Your request for <strong>{form.instrument_name}</strong> has been submitted.
            An administrator will review it and contact you at {form.contact_email}.
          </p>
          <button onClick={() => { setSubmitted(false); setForm({ instrument_name: '', location: '', contact_email: '', description: '', justification: '' }) }} className="btn-secondary">
            Submit Another Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Request Instrument Harvest"
        description="Request that a new instrument be added to the harvest system"
      />

      <div className="card max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Instrument Name *</label>
            <input
              className="input"
              required
              value={form.instrument_name}
              onChange={(e) => set('instrument_name', e.target.value)}
              placeholder="e.g. TEM Microscope Lab 3"
            />
          </div>
          <div>
            <label className="label">Physical Location *</label>
            <input
              className="input"
              required
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Building A, Room 204"
            />
          </div>
          <div>
            <label className="label">Contact Email *</label>
            <input
              className="input"
              type="email"
              required
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              placeholder="your@email.edu"
            />
          </div>
          <div>
            <label className="label">Instrument Description</label>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the instrument and the type of data it generates…"
            />
          </div>
          <div>
            <label className="label">Justification *</label>
            <textarea
              className="input"
              rows={4}
              required
              value={form.justification}
              onChange={(e) => set('justification', e.target.value)}
              placeholder="Why does this instrument need automated data harvesting? What project/grant is this for?"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary">
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
