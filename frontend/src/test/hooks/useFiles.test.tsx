import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeFileRecord } from '@/mocks/handlers'
import { useFiles } from '@/hooks/useFiles'
import { makeTestQueryClient } from '@/test/utils'

function makeWrapper() {
  const qc = makeTestQueryClient()
  return {
    qc,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

describe('useFiles', () => {
  it('fetches /api/files with no params', async () => {
    let requestUrl: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/files`, ({ request }) => {
        requestUrl = request.url
        return HttpResponse.json([makeFileRecord()])
      })
    )

    const { qc, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFiles(), { wrapper: Wrapper })
    void qc

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(new URL(requestUrl!).pathname).toBe('/api/files')
    expect(result.current.data).toHaveLength(1)
  })

  it('passes params as query string', async () => {
    let capturedSearch: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/files`, ({ request }) => {
        capturedSearch = new URL(request.url).search
        return HttpResponse.json([])
      })
    )

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useFiles({ instrument_id: 'inst-abc', status: 'new' }), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedSearch).toContain('instrument_id=inst-abc')
    expect(capturedSearch).toContain('status=new')
  })

  it('uses distinct cache entries per params object', async () => {
    let requestCount = 0
    server.use(
      http.get(`${TEST_BASE}/api/files`, () => {
        requestCount++
        return HttpResponse.json([])
      })
    )

    const { qc, Wrapper } = makeWrapper()
    void qc
    renderHook(() => useFiles({ instrument_id: 'aaa' }), { wrapper: Wrapper })
    renderHook(() => useFiles({ instrument_id: 'bbb' }), { wrapper: Wrapper })

    await waitFor(() => expect(requestCount).toBe(2))
  })
})
