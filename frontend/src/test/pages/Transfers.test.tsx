import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeTransfer } from '@/mocks/handlers'
import { Transfers } from '@/pages/user/Transfers'

function setupAuth() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

describe('Transfers page', () => {
  it('renders transfer rows after loading', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ id: 'xfer-aabbccdd-1234-5678-90ab-cdef12345678' })]),
      ),
    )

    renderWithProviders(<Transfers />)

    await waitFor(() => {
      // Table shows truncated ID
      expect(screen.getByText(/xfer-aab/)).toBeInTheDocument()
    })
  })

  it('shows "No transfers found." when empty', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/transfers`, () => HttpResponse.json([])))

    renderWithProviders(<Transfers />)

    await waitFor(() => {
      expect(screen.getByText(/no transfers found/i)).toBeInTheDocument()
    })
  })

  it('status filter dropdown sends status param to API', async () => {
    setupAuth()
    let capturedSearch: string | undefined

    server.use(
      http.get(`${TEST_BASE}/api/transfers`, ({ request }) => {
        capturedSearch = new URL(request.url).search
        return HttpResponse.json([])
      }),
    )

    const { user } = renderWithProviders(<Transfers />)

    await waitFor(() => {
      expect(screen.getByText(/no transfers found/i)).toBeInTheDocument()
    })

    await user.selectOptions(
      screen.getByRole('combobox'),
      'completed',
    )

    await waitFor(() => {
      expect(capturedSearch).toContain('status=completed')
    })
  })

  it('shows failed transfers summary block when any transfer has failed', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([
          makeTransfer({ id: 'xfer-good', status: 'completed', error_message: null }),
          makeTransfer({ id: 'xfer-bad', status: 'failed', error_message: 'Connection refused' }),
        ]),
      ),
    )

    renderWithProviders(<Transfers />)

    await waitFor(() => {
      expect(screen.getByText(/failed transfers/i)).toBeInTheDocument()
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument()
    })
  })

  it('does not show failed summary block when no failures', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ status: 'completed' })]),
      ),
    )

    renderWithProviders(<Transfers />)

    await waitFor(() => {
      expect(screen.queryByText(/failed transfers/i)).not.toBeInTheDocument()
    })
  })

  it('shows Verified badge for checksum_verified=true', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ checksum_verified: true })]),
      ),
    )

    renderWithProviders(<Transfers />)

    await waitFor(() => {
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })
  })

  it('shows Failed badge for checksum_verified=false', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ checksum_verified: false })]),
      ),
    )

    renderWithProviders(<Transfers />)

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })
  })
})
