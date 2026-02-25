import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeInstrument } from '@/mocks/handlers'
import {
  useInstruments,
  useCreateInstrument,
  useUpdateInstrument,
  useDeleteInstrument,
  useInstrument,
} from '@/hooks/useInstruments'
import { makeTestQueryClient } from '@/test/utils'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useInstruments', () => {
  it('returns instrument data from API', async () => {
    const qc = makeTestQueryClient()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'SAXS Diffractometer' })]),
      ),
    )

    const { result } = renderHook(() => useInstruments(), { wrapper: wrapper(qc) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('SAXS Diffractometer')
  })

  it('does not fetch when id is empty string (useInstrument)', async () => {
    const qc = makeTestQueryClient()
    let requestCount = 0
    server.use(
      http.get(`${TEST_BASE}/api/instruments/:id`, () => {
        requestCount++
        return HttpResponse.json(makeInstrument())
      }),
    )

    renderHook(() => useInstrument(''), { wrapper: wrapper(qc) })
    // Wait a tick to ensure no fetch fires
    await new Promise((r) => setTimeout(r, 50))
    expect(requestCount).toBe(0)
  })
})

describe('useCreateInstrument', () => {
  it('sends POST to /api/instruments and invalidates instruments query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/instruments`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeInstrument(), { status: 201 })
      }),
    )

    const { result } = renderHook(() => useCreateInstrument(), { wrapper: wrapper(qc) })

    result.current.mutate({
      name: 'New Microscope',
      cifs_host: '10.0.0.1',
      cifs_share: 'data',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect((postedBody as { name: string }).name).toBe('New Microscope')
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['instruments'] }),
    )
  })
})

describe('useUpdateInstrument', () => {
  it('sends PATCH to /api/instruments/:id', async () => {
    const qc = makeTestQueryClient()
    let patchedUrl: string | undefined

    server.use(
      http.patch(`${TEST_BASE}/api/instruments/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeInstrument({ name: 'Updated' }))
      }),
    )

    const { result } = renderHook(() => useUpdateInstrument(), { wrapper: wrapper(qc) })

    result.current.mutate({ id: 'inst-uuid-1', data: { name: 'Updated' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(patchedUrl).toBe('/api/instruments/inst-uuid-1')
  })
})

describe('useDeleteInstrument', () => {
  it('sends DELETE to /api/instruments/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let deletedUrl: string | undefined

    server.use(
      http.delete(`${TEST_BASE}/api/instruments/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { result } = renderHook(() => useDeleteInstrument(), { wrapper: wrapper(qc) })
    result.current.mutate('inst-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deletedUrl).toBe('/api/instruments/inst-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['instruments'] }),
    )
  })
})
