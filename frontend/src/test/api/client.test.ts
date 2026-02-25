import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import { apiClient, authApi } from '@/api/client'

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
  it('clears localStorage and redirects on 401', async () => {
    localStorage.setItem('access_token', 'old-token')
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () => new HttpResponse(null, { status: 401 }))
    )

    await expect(apiClient.get('/api/instruments')).rejects.toThrow()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(window.location.href).toBe('/login')
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
