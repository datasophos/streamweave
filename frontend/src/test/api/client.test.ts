import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import {
  apiClient,
  authApi,
  instrumentsApi,
  serviceAccountsApi,
  storageApi,
  schedulesApi,
  hooksApi,
  transfersApi,
  usersApi,
  projectsApi,
} from '@/api/client'

describe('apiClient request interceptor', () => {
  it('attaches Bearer token from localStorage when present', async () => {
    localStorage.setItem('access_token', 'my-jwt-token')

    let capturedAuth: string | null = null
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization')
        return HttpResponse.json([])
      })
    )

    await apiClient.get('/api/instruments')
    expect(capturedAuth).toBe('Bearer my-jwt-token')
  })

  it('omits Authorization header when no token in localStorage', async () => {
    let capturedAuth: string | null = 'present'
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization')
        return HttpResponse.json([])
      })
    )

    await apiClient.get('/api/instruments')
    expect(capturedAuth).toBeNull()
  })
})

describe('apiClient response interceptor', () => {
  it('clears localStorage and redirects to /login when 401 fires on the login page', async () => {
    localStorage.setItem('access_token', 'old-token')
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () => new HttpResponse(null, { status: 401 }))
    )

    await expect(apiClient.get('/api/instruments')).rejects.toThrow()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('includes ?next param when 401 fires on a non-login page', async () => {
    localStorage.setItem('access_token', 'old-token')
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () => new HttpResponse(null, { status: 401 }))
    )
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/dashboard', search: '', href: '' },
      writable: true,
    })

    await expect(apiClient.get('/api/instruments')).rejects.toThrow()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(window.location.href).toBe('/login?next=%2Fdashboard')
  })
})

describe('API resource methods — single-item and mutation endpoints', () => {
  it('instrumentsApi.get calls /api/instruments/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/instruments/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await instrumentsApi.get('inst-1')
    expect(url).toBe('/api/instruments/inst-1')
  })

  it('serviceAccountsApi.get calls /api/service-accounts/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await serviceAccountsApi.get('sa-1')
    expect(url).toBe('/api/service-accounts/sa-1')
  })

  it('serviceAccountsApi.update calls PATCH /api/service-accounts/:id', async () => {
    let url: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/service-accounts/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await serviceAccountsApi.update('sa-1', { name: 'updated' })
    expect(url).toBe('/api/service-accounts/sa-1')
  })

  it('storageApi.get calls /api/storage-locations/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await storageApi.get('sl-1')
    expect(url).toBe('/api/storage-locations/sl-1')
  })

  it('schedulesApi.get calls /api/schedules/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/schedules/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await schedulesApi.get('sched-1')
    expect(url).toBe('/api/schedules/sched-1')
  })

  it('hooksApi.get calls /api/hooks/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/hooks/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await hooksApi.get('hook-1')
    expect(url).toBe('/api/hooks/hook-1')
  })

  it('transfersApi.get calls /api/transfers/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/transfers/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await transfersApi.get('xfer-1')
    expect(url).toBe('/api/transfers/xfer-1')
  })

  it('usersApi.get calls /users/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/users/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await usersApi.get('user-1')
    expect(url).toBe('/users/user-1')
  })

  it('projectsApi.list calls GET /api/projects', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/projects`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json([])
      })
    )
    await projectsApi.list()
    expect(url).toBe('/api/projects')
  })

  it('projectsApi.get calls GET /api/projects/:id', async () => {
    let url: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/projects/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await projectsApi.get('proj-1')
    expect(url).toBe('/api/projects/proj-1')
  })

  it('projectsApi.create calls POST /api/projects', async () => {
    let url: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/projects`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({}, { status: 201 })
      })
    )
    await projectsApi.create({ name: 'Proj' })
    expect(url).toBe('/api/projects')
  })

  it('projectsApi.update calls PATCH /api/projects/:id', async () => {
    let url: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/projects/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      })
    )
    await projectsApi.update('proj-1', { name: 'Updated' })
    expect(url).toBe('/api/projects/proj-1')
  })

  it('projectsApi.delete calls DELETE /api/projects/:id', async () => {
    let url: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/projects/:id`, ({ request }) => {
        url = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )
    await projectsApi.delete('proj-1')
    expect(url).toBe('/api/projects/proj-1')
  })
})

describe('authApi.login', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sends form-encoded body with "username" field (not "email")', async () => {
    let contentType: string | null = null
    let body: string | null = null

    server.use(
      http.post(`${TEST_BASE}/auth/jwt/login`, async ({ request }) => {
        contentType = request.headers.get('Content-Type')
        body = await request.text()
        return HttpResponse.json({ access_token: 'tok', token_type: 'bearer' })
      })
    )

    await authApi.login('user@test.com', 'secret')

    expect(contentType).toContain('application/x-www-form-urlencoded')
    expect(body).toContain('username=user%40test.com')
    expect(body).not.toContain('email=')
  })

  it('returns the access token on success', async () => {
    const resp = await authApi.login('user@test.com', 'password')
    expect(resp.data.access_token).toBe('test-token')
  })
})

describe('authApi.requestVerification', () => {
  it('sends POST to /auth/request-verify-token', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/auth/request-verify-token`, async ({ request }) => {
        capturedBody = await request.json()
        return new HttpResponse(null, { status: 202 })
      })
    )

    await authApi.requestVerification('user@test.com')
    expect((capturedBody as { email: string }).email).toBe('user@test.com')
  })
})
