import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeAdminUser, makeTransfer, makeInstrument } from '@/mocks/handlers'
import { Dashboard } from '@/pages/Dashboard'

function setupAuth(admin = false) {
  setupAuthToken()
  server.use(
    http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(admin ? makeAdminUser() : makeUser()))
  )
}

describe('Dashboard', () => {
  it('shows Healthy badge when health API returns ok', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/health`, () => HttpResponse.json({ status: 'ok' })))

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })
  })

  it('shows Unavailable badge when health API returns non-ok status', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/health`, () => HttpResponse.json({ status: 'error' })))

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })

  it('renders correct counts for completed and failed transfers', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([
          makeTransfer({ id: '1', status: 'completed' }),
          makeTransfer({ id: '2', status: 'completed' }),
          makeTransfer({ id: '3', status: 'failed' }),
          makeTransfer({ id: '4', status: 'in_progress' }),
        ])
      )
    )

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      // StatCard for "Transfers" shows total, sub-text shows completed count
      expect(screen.getByText('4')).toBeInTheDocument() // total transfers
      expect(screen.getByText('2 completed')).toBeInTheDocument()
      // "1" appears in multiple stat cards (In Progress, Failed, Total Files)
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows "No transfers yet." when transfers array is empty', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/transfers`, () => HttpResponse.json([])))

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText(/no transfers yet/i)).toBeInTheDocument()
    })
  })

  it('renders at most 10 recent transfer rows', async () => {
    setupAuth()
    // Use hex-padded UUIDs so id.slice(0,8) produces exactly 8 hex chars
    const transfers = Array.from({ length: 15 }, (_, i) =>
      makeTransfer({ id: `${i.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000` })
    )
    server.use(http.get(`${TEST_BASE}/api/transfers`, () => HttpResponse.json(transfers)))

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      // Each row shows a truncated ID ending with "…"
      const rows = screen.getAllByText(/^[a-f0-9]{8}…$/)
      expect(rows).toHaveLength(10)
    })
  })

  it('admin sees Instruments stat card and Instrument Status table', async () => {
    setupAuth(true)
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'Bruker NMR' })])
      )
    )

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Instrument Status')).toBeInTheDocument()
      expect(screen.getByText('Bruker NMR')).toBeInTheDocument()
    })
  })

  it('shows — for null bytes_transferred in recent transfers row', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ bytes_transferred: null })])
      )
    )

    renderWithProviders(<Dashboard />)

    // The '—' dash appears in the bytes column of the recent transfers table
    await waitFor(() => {
      // Multiple '—' may appear (bytes and started_at cols); just check at least one
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
  })

  it('shows — for null started_at in recent transfers row', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ started_at: null })])
      )
    )

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
  })

  it('shows Disabled badge for disabled instrument in Instrument Status table', async () => {
    setupAuth(true)
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'Offline NMR', enabled: false })])
      )
    )

    renderWithProviders(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Offline NMR')).toBeInTheDocument()
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
  })

  it('shows — for Instruments stat while instruments are still loading (admin)', async () => {
    setupAuth(true)
    // Instruments endpoint hangs — data stays undefined so instruments?.length ?? '—' gives '—'
    server.use(http.get(`${TEST_BASE}/api/instruments`, () => new Promise(() => {})))

    renderWithProviders(<Dashboard />)

    // The Instruments stat card is rendered immediately for admins; before data arrives,
    // instruments is undefined so the value shows '—'
    await waitFor(() => {
      expect(screen.getByText('Instruments')).toBeInTheDocument()
    })
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('non-admin does not see Instrument Status table', async () => {
    setupAuth(false)

    renderWithProviders(<Dashboard />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/no transfers yet/i)).not.toBeNull()
    })

    expect(screen.queryByText('Instrument Status')).not.toBeInTheDocument()
  })
})
