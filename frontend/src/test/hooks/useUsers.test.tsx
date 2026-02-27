import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser } from '@/mocks/handlers'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from '@/hooks/useUsers'
import { makeTestQueryClient } from '@/test/utils'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useUsers', () => {
  it('returns users from /api/admin/users', async () => {
    const qc = makeTestQueryClient()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ email: 'alice@test.com' })])
      )
    )

    const { result } = renderHook(() => useUsers(), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].email).toBe('alice@test.com')
  })
})

describe('useCreateUser', () => {
  it('calls /auth/register and invalidates users query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/auth/register`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeUser(), { status: 201 })
      })
    )

    const { result } = renderHook(() => useCreateUser(), { wrapper: wrapper(qc) })
    result.current.mutate({ email: 'new@test.com', password: 'secret', role: 'user' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((postedBody as { email: string }).email).toBe('new@test.com')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['users'] }))
  })
})

describe('useUpdateUser', () => {
  it('sends PATCH to /users/:id and invalidates users query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/users/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeUser({ role: 'admin' }))
      })
    )

    const { result } = renderHook(() => useUpdateUser(), { wrapper: wrapper(qc) })
    result.current.mutate({ id: 'user-uuid-1', data: { role: 'admin' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(patchedUrl).toBe('/users/user-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['users'] }))
  })
})

describe('useDeleteUser', () => {
  it('sends DELETE to /users/:id and invalidates users query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/admin/users/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { result } = renderHook(() => useDeleteUser(), { wrapper: wrapper(qc) })
    result.current.mutate('user-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deletedUrl).toBe('/api/admin/users/user-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['users'] }))
  })
})

describe('useRestoreUser', () => {
  it('sends POST to /api/admin/users/:id/restore and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/admin/users/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeUser())
      })
    )

    const { result } = renderHook(() => useRestoreUser(), { wrapper: wrapper(qc) })
    result.current.mutate('user-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(restoredUrl).toBe('/api/admin/users/user-uuid-1/restore')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['users'] }))
  })
})

describe('useUsers with includeDeleted', () => {
  it('passes include_deleted=true param when includeDeleted is true', async () => {
    const qc = makeTestQueryClient()
    let capturedParams: URLSearchParams | null = null
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, ({ request }) => {
        capturedParams = new URL(request.url).searchParams
        return HttpResponse.json([makeUser()])
      })
    )

    const { result } = renderHook(() => useUsers(true), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedParams!.get('include_deleted')).toBe('true')
  })
})
