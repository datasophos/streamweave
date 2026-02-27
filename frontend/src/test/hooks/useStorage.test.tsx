import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeStorageLocation } from '@/mocks/handlers'
import {
  useStorageLocations,
  useCreateStorageLocation,
  useUpdateStorageLocation,
  useDeleteStorageLocation,
  useRestoreStorageLocation,
  useTestStorageLocation,
} from '@/hooks/useStorage'
import { makeTestQueryClient } from '@/test/utils'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useStorageLocations', () => {
  it('returns storage locations from API', async () => {
    const qc = makeTestQueryClient()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ name: 'NAS Archive' })])
      )
    )

    const { result } = renderHook(() => useStorageLocations(), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('NAS Archive')
  })
})

describe('useCreateStorageLocation', () => {
  it('sends POST to /api/storage-locations and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeStorageLocation(), { status: 201 })
      })
    )

    const { result } = renderHook(() => useCreateStorageLocation(), { wrapper: wrapper(qc) })
    result.current.mutate({ name: 'New Storage', type: 'posix', base_path: '/data', enabled: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((postedBody as { name: string }).name).toBe('New Storage')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['storage'] }))
  })
})

describe('useUpdateStorageLocation', () => {
  it('sends PATCH to /api/storage-locations/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/storage-locations/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeStorageLocation({ name: 'Updated' }))
      })
    )

    const { result } = renderHook(() => useUpdateStorageLocation(), { wrapper: wrapper(qc) })
    result.current.mutate({ id: 'storage-uuid-1', data: { name: 'Updated' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(patchedUrl).toBe('/api/storage-locations/storage-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['storage'] }))
  })
})

describe('useDeleteStorageLocation', () => {
  it('sends DELETE to /api/storage-locations/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/storage-locations/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { result } = renderHook(() => useDeleteStorageLocation(), { wrapper: wrapper(qc) })
    result.current.mutate('storage-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deletedUrl).toBe('/api/storage-locations/storage-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['storage'] }))
  })
})

describe('useRestoreStorageLocation', () => {
  it('sends POST to /api/storage-locations/:id/restore and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeStorageLocation())
      })
    )

    const { result } = renderHook(() => useRestoreStorageLocation(), { wrapper: wrapper(qc) })
    result.current.mutate('storage-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(restoredUrl).toBe('/api/storage-locations/storage-uuid-1/restore')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['storage'] }))
  })
})

describe('useTestStorageLocation', () => {
  it('sends GET to /api/storage-locations/:id/test', async () => {
    const qc = makeTestQueryClient()
    let testedUrl: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations/:id/test`, ({ request }) => {
        testedUrl = new URL(request.url).pathname
        return HttpResponse.json({ status: 'ok', type: 'posix', name: 'Archive' })
      })
    )

    const { result } = renderHook(() => useTestStorageLocation(), { wrapper: wrapper(qc) })
    result.current.mutate('storage-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(testedUrl).toBe('/api/storage-locations/storage-uuid-1/test')
  })
})

describe('useStorageLocations with includeDeleted', () => {
  it('passes include_deleted=true param when includeDeleted is true', async () => {
    const qc = makeTestQueryClient()
    let capturedParams: URLSearchParams | null = null
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, ({ request }) => {
        capturedParams = new URL(request.url).searchParams
        return HttpResponse.json([makeStorageLocation()])
      })
    )

    const { result } = renderHook(() => useStorageLocations(true), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedParams!.get('include_deleted')).toBe('true')
  })
})
