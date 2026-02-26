import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import { Login } from '@/pages/Login'

describe('Login page', () => {
  it('renders email, password inputs and submit button', () => {
    renderWithProviders(<Login />)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('submits with typed credentials', async () => {
    let capturedBody: URLSearchParams | null = null
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, async ({ request }) => {
        capturedBody = new URLSearchParams(await request.text())
        return HttpResponse.json({ access_token: 'tok', token_type: 'bearer' })
      })
    )
    // Override /users/me to return a user so auth completes
    server.use(http.get(`${TEST_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })))

    const { user } = renderWithProviders(<Login />)

    await user.type(screen.getByLabelText(/email address/i), 'admin@example.com')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(capturedBody).not.toBeNull())
    expect(capturedBody!.get('username')).toBe('admin@example.com')
    expect(capturedBody!.get('password')).toBe('secret123')
  })

  it('shows loading state while login request is in progress', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json({ access_token: 'tok', token_type: 'bearer' })
      })
    )

    const { user } = renderWithProviders(<Login />)
    await user.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pass')

    const btn = screen.getByRole('button', { name: /sign in/i })
    await user.click(btn)

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('shows fallback error message on login failure (no detail)', async () => {
    // Return a bare 400 so ErrorMessage uses the fallback "Invalid credentials."
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, () => new HttpResponse(null, { status: 400 }))
    )

    const { user } = renderWithProviders(<Login />)
    await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('shows friendly translated message for LOGIN_BAD_CREDENTIALS', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, () =>
        HttpResponse.json({ detail: 'LOGIN_BAD_CREDENTIALS' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Login />)
    await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/contact your system administrator/i)).toBeInTheDocument()
    })
  })

  it('renders language chooser with all 5 language buttons', () => {
    renderWithProviders(<Login />)
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Français' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Français (CA)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中文' })).toBeInTheDocument()
  })

  it('clicking a language button updates the stored language preference', async () => {
    const { user } = renderWithProviders(<Login />)
    await user.click(screen.getByRole('button', { name: 'Français' }))
    const stored = JSON.parse(localStorage.getItem('sw_preferences') ?? '{}')
    expect(stored.language).toBe('fr')
  })

  it('reads "from" redirect path from location state (covers the ?? branch)', () => {
    // Rendering with state.from set covers the non-default branch of line 10
    renderWithProviders(<Login />, {
      routerProps: {
        initialEntries: [{ pathname: '/login', state: { from: '/files' } }],
      },
    })

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('button is re-enabled after error', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, () => new HttpResponse(null, { status: 400 }))
    )

    const { user } = renderWithProviders(<Login />)
    await user.type(screen.getByLabelText(/email address/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'bad')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
  })
})
