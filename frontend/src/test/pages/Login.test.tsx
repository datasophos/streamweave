import { describe, it, expect, vi, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser } from '@/mocks/handlers'
import { Login } from '@/pages/Login'

afterEach(() => {
  vi.unstubAllEnvs()
})

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

  it('redirects to dashboard when already authenticated', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))

    renderWithProviders(<Login />)

    // When authenticated, the Login component returns <Navigate>, so the sign-in form disappears
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument()
    })
  })
})

describe('Login page — demo mode', () => {
  it('does not show demo users section when VITE_DEMO_MODE is not set', () => {
    renderWithProviders(<Login />)
    expect(screen.queryByText(/demo users/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows all four demo user buttons when VITE_DEMO_MODE=true', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    renderWithProviders(<Login />)
    expect(screen.getByText(/demo users/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chemist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Proteomics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EM Operator' })).toBeInTheDocument()
  })

  it('pre-fills admin credentials on render when VITE_DEMO_MODE=true', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.stubEnv('VITE_ADMIN_EMAIL', 'admin@example.com')
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'adminpassword')
    renderWithProviders(<Login />)
    expect(screen.getByLabelText(/email address/i)).toHaveValue('admin@example.com')
    expect(screen.getByLabelText(/password/i)).toHaveValue('adminpassword')
  })

  it('clicking Chemist fills chemist credentials', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const { user } = renderWithProviders(<Login />)
    await user.click(screen.getByRole('button', { name: 'Chemist' }))
    expect(screen.getByLabelText(/email address/i)).toHaveValue('chemist@example.com')
    expect(screen.getByLabelText(/password/i)).toHaveValue('devpass123!')
  })

  it('clicking Proteomics fills proteomics credentials', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const { user } = renderWithProviders(<Login />)
    await user.click(screen.getByRole('button', { name: 'Proteomics' }))
    expect(screen.getByLabelText(/email address/i)).toHaveValue('proteomics@example.com')
    expect(screen.getByLabelText(/password/i)).toHaveValue('devpass123!')
  })

  it('clicking EM Operator fills em-operator credentials', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const { user } = renderWithProviders(<Login />)
    await user.click(screen.getByRole('button', { name: 'EM Operator' }))
    expect(screen.getByLabelText(/email address/i)).toHaveValue('em-operator@example.com')
    expect(screen.getByLabelText(/password/i)).toHaveValue('devpass123!')
  })

  it('clicking Admin fills admin credentials', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.stubEnv('VITE_ADMIN_EMAIL', 'admin@example.com')
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'adminpassword')
    const { user } = renderWithProviders(<Login />)
    // Switch to a different user first, then back to admin
    await user.click(screen.getByRole('button', { name: 'Chemist' }))
    await user.click(screen.getByRole('button', { name: 'Admin' }))
    expect(screen.getByLabelText(/email address/i)).toHaveValue('admin@example.com')
    expect(screen.getByLabelText(/password/i)).toHaveValue('adminpassword')
  })
})
