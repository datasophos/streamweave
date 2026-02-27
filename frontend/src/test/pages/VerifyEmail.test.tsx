import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import { VerifyEmail } from '@/pages/VerifyEmail'

describe('VerifyEmail page', () => {
  it('shows verifying message while pending', () => {
    server.use(
      http.post(`${TEST_BASE}/auth/verify`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return new HttpResponse(null, { status: 200 })
      })
    )

    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify-email?token=abc123'] },
    })

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument()
  })

  it('shows success state when token is valid', async () => {
    server.use(http.post(`${TEST_BASE}/auth/verify`, () => new HttpResponse(null, { status: 200 })))

    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify-email?token=abc123'] },
    })

    await waitFor(() => {
      expect(screen.getByText(/email verified!/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error state on API failure', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/verify`, () =>
        HttpResponse.json({ detail: 'VERIFY_USER_INVALID_TOKEN' }, { status: 400 })
      )
    )

    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify-email?token=bad-token'] },
    })

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/verification link is invalid or has expired/i)).toBeInTheDocument()
  })

  it('shows already-verified message when detail is VERIFY_USER_ALREADY_VERIFIED', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/verify`, () =>
        HttpResponse.json({ detail: 'VERIFY_USER_ALREADY_VERIFIED' }, { status: 400 })
      )
    )

    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify-email?token=old-token'] },
    })

    await waitFor(() => {
      expect(screen.getByText(/your email is already verified/i)).toBeInTheDocument()
    })
  })

  it('shows no-token error when token param is missing', async () => {
    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify-email'] },
    })

    await waitFor(() => {
      expect(screen.getByText(/no verification token provided/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
  })

  it('shows Back to login link on error', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/verify`, () =>
        HttpResponse.json({ detail: 'VERIFY_USER_INVALID_TOKEN' }, { status: 400 })
      )
    )

    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify-email?token=bad'] },
    })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument()
    })
  })
})
