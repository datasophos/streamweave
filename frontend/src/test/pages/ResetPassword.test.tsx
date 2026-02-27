import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import { ResetPassword } from '@/pages/ResetPassword'

describe('ResetPassword page', () => {
  it('shows "Checking reset link..." while validating token', () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json({ detail: 'RESET_PASSWORD_INVALID_PASSWORD' }, { status: 400 })
      })
    )

    renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=validtoken'] },
    })

    expect(screen.getByText(/checking reset link/i)).toBeInTheDocument()
  })

  it('shows "Invalid reset link" immediately when no token is provided', async () => {
    renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password'] },
    })

    await waitFor(() => {
      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument()
    })
  })

  it('shows "Invalid reset link" when token is rejected with RESET_PASSWORD_BAD_TOKEN', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () =>
        HttpResponse.json({ detail: 'RESET_PASSWORD_BAD_TOKEN' }, { status: 400 })
      )
    )

    renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=badtoken'] },
    })

    await waitFor(() => {
      expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument()
    })
  })

  it('shows "Request new link" button when token is invalid', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () =>
        HttpResponse.json({ detail: 'RESET_PASSWORD_BAD_TOKEN' }, { status: 400 })
      )
    )

    renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=badtoken'] },
    })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /request new link/i })).toBeInTheDocument()
    })
  })

  it('shows reset form when token is valid (sentinel gets other error)', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () =>
        HttpResponse.json({ detail: 'RESET_PASSWORD_INVALID_PASSWORD' }, { status: 400 })
      )
    )

    renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=goodtoken'] },
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    })
  })

  it('shows reset form when sentinel reset call succeeds', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () => new HttpResponse(null, { status: 200 }))
    )

    renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=goodtoken'] },
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })
  })

  it('shows "Passwords do not match." when passwords differ', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () =>
        HttpResponse.json({ detail: 'RESET_PASSWORD_INVALID_PASSWORD' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=goodtoken'] },
    })

    await waitFor(() => screen.getByLabelText(/new password/i))

    // Override to return success for the actual reset
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () => new HttpResponse(null, { status: 200 }))
    )

    await user.type(screen.getByLabelText(/new password/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different456')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('shows "Password must be at least 8 characters." for short password', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () =>
        HttpResponse.json({ detail: 'RESET_PASSWORD_INVALID_PASSWORD' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=goodtoken'] },
    })

    await waitFor(() => screen.getByLabelText(/new password/i))

    await user.type(screen.getByLabelText(/new password/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows error on API failure during actual reset', async () => {
    // First call (sentinel): return a non-bad-token error to set tokenValid=true
    let callCount = 0
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ detail: 'RESET_PASSWORD_INVALID_PASSWORD' }, { status: 400 })
        }
        return new HttpResponse(null, { status: 500 })
      })
    )

    const { user } = renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=goodtoken'] },
    })

    await waitFor(() => screen.getByLabelText(/new password/i))

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  it('navigates to /login on successful password reset', async () => {
    let callCount = 0
    server.use(
      http.post(`${TEST_BASE}/auth/reset-password`, () => {
        callCount++
        if (callCount === 1) {
          // sentinel: return non-bad-token error to set tokenValid=true
          return HttpResponse.json({ detail: 'RESET_PASSWORD_INVALID_PASSWORD' }, { status: 400 })
        }
        // actual reset: success
        return new HttpResponse(null, { status: 200 })
      })
    )

    const { user } = renderWithProviders(<ResetPassword />, {
      routerProps: { initialEntries: ['/reset-password?token=goodtoken'] },
    })

    await waitFor(() => screen.getByLabelText(/new password/i))

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    // After successful reset, the form should disappear (navigated away)
    await waitFor(() => {
      expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
    })
  })
})
