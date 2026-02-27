import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import { ForgotPassword } from '@/pages/ForgotPassword'

describe('ForgotPassword page', () => {
  it('renders email input and submit button', () => {
    renderWithProviders(<ForgotPassword />)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('shows confirmation message on success', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/forgot-password`, () => new HttpResponse(null, { status: 202 }))
    )

    const { user } = renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument()
    })
  })

  it('shows the submitted email in the confirmation message', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/forgot-password`, () => new HttpResponse(null, { status: 202 }))
    )

    const { user } = renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText(/email address/i), 'myemail@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/myemail@example\.com/i)).toBeInTheDocument()
    })
  })

  it('shows error message on API failure', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/forgot-password`, () => new HttpResponse(null, { status: 500 }))
    )

    const { user } = renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  it('button shows "Sending..." while request is in progress', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/forgot-password`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return new HttpResponse(null, { status: 202 })
      })
    )

    const { user } = renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })

  it('button is disabled while loading', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/forgot-password`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return new HttpResponse(null, { status: 202 })
      })
    )

    const { user } = renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })

  it('renders Back to login link', () => {
    renderWithProviders(<ForgotPassword />)
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument()
  })

  it('success state shows Back to login link', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/forgot-password`, () => new HttpResponse(null, { status: 202 }))
    )

    const { user } = renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument()
    })
  })
})
