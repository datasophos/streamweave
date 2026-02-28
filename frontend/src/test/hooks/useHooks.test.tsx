import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeBuiltinHook, makeHookConfig } from '@/mocks/handlers'
import {
  useBuiltinHooks,
  useHookConfigs,
  useCreateHookConfig,
  useUpdateHookConfig,
  useDeleteHookConfig,
  useRestoreHookConfig,
} from '@/hooks/useHooks'
import { makeTestQueryClient } from '@/test/utils'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useBuiltinHooks', () => {
  it('returns builtin hooks from /api/hooks/builtins', async () => {
    const qc = makeTestQueryClient()
    server.use(
      http.get(`${TEST_BASE}/api/hooks/builtins`, () =>
        HttpResponse.json([
          makeBuiltinHook({ name: 'file_filter', display_name: 'File Filter' }),
          makeBuiltinHook({ name: 'metadata_enrichment', display_name: 'Metadata Enrichment' }),
        ])
      )
    )

    const { result } = renderHook(() => useBuiltinHooks(), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('file_filter')
    expect(result.current.data![1].display_name).toBe('Metadata Enrichment')
  })
})

describe('useHookConfigs', () => {
  it('returns hook configs from API', async () => {
    const qc = makeTestQueryClient()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ name: 'My Hook' })])
      )
    )

    const { result } = renderHook(() => useHookConfigs(), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('My Hook')
  })
})

describe('useCreateHookConfig', () => {
  it('sends POST to /api/hooks and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { result } = renderHook(() => useCreateHookConfig(), { wrapper: wrapper(qc) })
    result.current.mutate({
      name: 'New Hook',
      trigger: 'post_transfer',
      implementation: 'builtin',
      priority: 0,
      enabled: true,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((postedBody as { name: string }).name).toBe('New Hook')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['hooks'] }))
  })
})

describe('useUpdateHookConfig', () => {
  it('sends PATCH to /api/hooks/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/hooks/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeHookConfig({ name: 'Updated' }))
      })
    )

    const { result } = renderHook(() => useUpdateHookConfig(), { wrapper: wrapper(qc) })
    result.current.mutate({ id: 'hook-uuid-1', data: { name: 'Updated' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(patchedUrl).toBe('/api/hooks/hook-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['hooks'] }))
  })
})

describe('useDeleteHookConfig', () => {
  it('sends DELETE to /api/hooks/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/hooks/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { result } = renderHook(() => useDeleteHookConfig(), { wrapper: wrapper(qc) })
    result.current.mutate('hook-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deletedUrl).toBe('/api/hooks/hook-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['hooks'] }))
  })
})

describe('useRestoreHookConfig', () => {
  it('sends POST to /api/hooks/:id/restore and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/hooks/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeHookConfig())
      })
    )

    const { result } = renderHook(() => useRestoreHookConfig(), { wrapper: wrapper(qc) })
    result.current.mutate('hook-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(restoredUrl).toBe('/api/hooks/hook-uuid-1/restore')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['hooks'] }))
  })
})

describe('useHookConfigs with includeDeleted', () => {
  it('passes include_deleted=true param when includeDeleted is true', async () => {
    const qc = makeTestQueryClient()
    let capturedParams: URLSearchParams | null = null
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, ({ request }) => {
        capturedParams = new URL(request.url).searchParams
        return HttpResponse.json([makeHookConfig()])
      })
    )

    const { result } = renderHook(() => useHookConfigs(true), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedParams!.get('include_deleted')).toBe('true')
  })
})
