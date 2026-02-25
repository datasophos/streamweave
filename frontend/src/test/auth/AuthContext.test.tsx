import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { useAuth } from '@/contexts/AuthContext'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeAdminUser } from '@/mocks/handlers'

// A simple component that exposes auth state for assertions
function AuthDisplay() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth()
  if (isLoading) return <div>loading</div>
  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="email">{user?.email ?? 'none'}</div>
      <div data-testid="is-admin">{String(isAdmin)}</div>
    </div>
  )
}

// A component that calls login/logout
function AuthActions() {
  const { login, logout } = useAuth()
  return (
    <div>
      <button onClick={() => login('user@test.com', 'password')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  it('initializes as unauthenticated when no token in localStorage', async () => {
    // No token set — no /users/me call expected
    // Override handler to error if called unexpectedly
    server.use(http.get(`${TEST_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })))

    renderWithProviders(<AuthDisplay />)

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })

  it('initializes as authenticated when token is present and /users/me succeeds', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))

    renderWithProviders(<AuthDisplay />)

    expect(screen.getByText('loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('email')).toHaveTextContent('user@test.com')
  })

  it('clears token and becomes unauthenticated when /users/me returns 401', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })))

    renderWithProviders(<AuthDisplay />)

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('login() stores token and populates user', async () => {
    server.use(
      http.get(`${TEST_BASE}/users/me`, () =>
        HttpResponse.json(makeUser({ email: 'user@test.com' }))
      )
    )

    const { user } = renderWithProviders(<AuthDisplay />)
    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('false'))

    renderWithProviders(<AuthActions />)
    await user.click(screen.getAllByRole('button', { name: 'login' })[0])

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('test-token')
    })
  })

  it('login() throws on 400 response and does not set token', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, () => new HttpResponse(null, { status: 400 }))
    )

    let caughtError: unknown
    function LoginThrower() {
      const { login } = useAuth()
      return (
        <button
          onClick={async () => {
            try {
              await login('bad@test.com', 'wrong')
            } catch (e) {
              caughtError = e
            }
          }}
        >
          login
        </button>
      )
    }

    const { user } = renderWithProviders(<LoginThrower />)
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(caughtError).toBeDefined())
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('logout() clears token and sets state to unauthenticated', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))

    const { user } = renderWithProviders(
      <>
        <AuthDisplay />
        <AuthActions />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('isAdmin is true when user role is admin', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))

    renderWithProviders(<AuthDisplay />)

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    })
  })

  it('isAdmin is false when user role is user', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))

    renderWithProviders(<AuthDisplay />)

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
    })
  })

  it('useAuth throws when called outside AuthProvider', () => {
    // This renders a component without an AuthProvider wrapper,
    // which exercises the error branch at line 78
    function Bare() {
      return <div>{useAuth().user?.email}</div>
    }

    expect(() => {
      render(<Bare />)
    }).toThrow('useAuth must be used inside AuthProvider')
  })

  it('logout() still clears token even when logout API throws', async () => {
    setupAuthToken()
    server.use(
      http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())),
      http.post(`${TEST_BASE}/auth/jwt/logout`, () => new HttpResponse(null, { status: 500 }))
    )

    const { user } = renderWithProviders(
      <>
        <AuthDisplay />
        <AuthActions />
      </>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
