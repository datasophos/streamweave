import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser, makeInstrumentRequest } from '@/mocks/handlers'
import { InstrumentRequests } from '@/pages/admin/InstrumentRequests'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('InstrumentRequests admin page', () => {
  it('shows loading state initially', () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json([])
      })
    )
    renderWithProviders(<InstrumentRequests />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state when request fails', async () => {
    setupAdmin()
    server.use(
      http.get(
        `${TEST_BASE}/api/instrument-requests`,
        () => new HttpResponse(null, { status: 500 })
      )
    )
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText(/failed to load requests/i)).toBeInTheDocument()
    })
  })

  it('renders "No requests found." when empty', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/instrument-requests`, () => HttpResponse.json([])))
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText(/no requests found/i)).toBeInTheDocument()
    })
  })

  it('renders pending request with Review button', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ status: 'pending' })])
      )
    )
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText('Bruker NMR')).toBeInTheDocument()
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument()
    })
  })

  it('renders approved request with Re-review button', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ status: 'approved' })])
      )
    )
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: 'Re-review' })).toBeInTheDocument()
    })
  })

  it('shows requester email in table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ requester_email: 'lab@example.com' })])
      )
    )
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText('lab@example.com')).toBeInTheDocument()
    })
  })

  it('falls back to truncated requester_id when email is null', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([
          makeInstrumentRequest({ requester_id: 'abcdef12-uuid', requester_email: null }),
        ])
      )
    )
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText('abcdef12…')).toBeInTheDocument()
    })
  })

  it('opens review modal when Review is clicked', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest()])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByText('Review Request')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /reject/i })).toBeInTheDocument()
  })

  it('modal shows request details including requester', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([
          makeInstrumentRequest({
            name: 'Bruker NMR',
            location: 'Lab 3B',
            requester_email: 'lab@example.com',
          }),
        ])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByText('Lab 3B')).toBeInTheDocument()
    expect(screen.getAllByText('lab@example.com').length).toBeGreaterThanOrEqual(1)
  })

  it('opens modal on Re-review button click for approved request', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ status: 'approved' })])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByRole('button', { name: 'Re-review' }))
    await user.click(screen.getByRole('button', { name: 'Re-review' }))
    expect(screen.getByText('Review Request')).toBeInTheDocument()
  })

  it('closes modal when Escape is pressed', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest()])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    await waitFor(() => screen.getByText('Review Request'))
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Review Request')).not.toBeInTheDocument()
    })
  })

  it('closes modal when Cancel is clicked', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest()])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText('Review Request')).not.toBeInTheDocument()
    })
  })

  it('submits approval and closes modal', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest()])
      ),
      http.patch(`${TEST_BASE}/api/instrument-requests/:id`, () =>
        HttpResponse.json(makeInstrumentRequest({ status: 'approved' }))
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    // Submit button shows "Approve" by default (radio defaults to approved)
    await user.click(screen.getByRole('button', { name: /^approve$/i }))
    await waitFor(() => {
      expect(screen.queryByText('Review Request')).not.toBeInTheDocument()
    })
  })

  it('filter dropdown shows only filtered results', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([
          makeInstrumentRequest({ id: 'r1', status: 'pending', name: 'Pending NMR' }),
          makeInstrumentRequest({ id: 'r2', status: 'approved', name: 'Approved Mass Spec' }),
        ])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequests />)
    await waitFor(() => screen.getByText('Pending NMR'))

    await user.selectOptions(screen.getByRole('combobox'), 'pending')

    await waitFor(() => {
      expect(screen.getByText('Pending NMR')).toBeInTheDocument()
      expect(screen.queryByText('Approved Mass Spec')).not.toBeInTheDocument()
    })
  })

  it('shows table headers', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/instrument-requests`, () => HttpResponse.json([])))
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText('Instrument')).toBeInTheDocument()
      expect(screen.getByText('Requester')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.queryByText('Location')).not.toBeInTheDocument()
      expect(screen.queryByText('Frequency')).not.toBeInTheDocument()
    })
  })

  it('renders admin notes in status column when present', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([
          makeInstrumentRequest({ status: 'rejected', admin_notes: 'Budget constraints.' }),
        ])
      )
    )
    renderWithProviders(<InstrumentRequests />)
    await waitFor(() => {
      expect(screen.getByText('Budget constraints.')).toBeInTheDocument()
    })
  })
})
