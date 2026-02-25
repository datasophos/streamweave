import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeAdminUser } from '@/mocks/handlers'
import { App } from '@/App'

describe('RequireAuth guard', () => {
  it('renders a spinner while auth is loading', () => {
    setupAuthToken()
    // Delay the response so isLoading stays true during the synchronous check
    server.use(
      http.get(`${TEST_BASE}/users/me`, async () => {
        await new Promise((r) => setTimeout(r, 500))
        return HttpResponse.json(makeUser())
      })
    )

    renderWithProviders(<App />, { routerProps: { initialEntries: ['/'] } })

    // Auth starts as isLoading:true, so spinner is shown synchronously before any promise resolves
    expect(document.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', async () => {
    // No token; auth resolves immediately as unauthenticated
    server.use(http.get(`${TEST_BASE}/users/me`, () => new HttpResponse(null, { status: 401 })))

    renderWithProviders(<App />, { routerProps: { initialEntries: ['/'] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  it('renders protected content when authenticated', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))

    renderWithProviders(<App />, { routerProps: { initialEntries: ['/'] } })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    })
  })
})

describe('RequireAdmin guard', () => {
  it('redirects to / when user is not admin', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))

    renderWithProviders(<App />, {
      routerProps: { initialEntries: ['/admin/instruments'] },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: /instruments/i })).not.toBeInTheDocument()
  })

  it('renders admin content when user is admin', async () => {
    setupAuthToken()
    server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))

    renderWithProviders(<App />, {
      routerProps: { initialEntries: ['/admin/instruments'] },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /^instruments$/i })).toBeInTheDocument()
    })
  })
})
