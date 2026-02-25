import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeTransfer } from '@/mocks/handlers'
import { useTransfers, useTransfer } from '@/hooks/useTransfers'
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

describe('useTransfers', () => {
  it('fetches /api/transfers with no params', async () => {
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, () =>
        HttpResponse.json([makeTransfer({ id: 'xfer-uuid-1' })])
      )
    )

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useTransfers(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].id).toBe('xfer-uuid-1')
  })

  it('passes params as query string', async () => {
    let capturedSearch: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/transfers`, ({ request }) => {
        capturedSearch = new URL(request.url).search
        return HttpResponse.json([])
      })
    )

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useTransfers({ status: 'failed' }), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedSearch).toContain('status=failed')
  })
})

describe('useTransfer', () => {
  it('fetches /api/transfers/:id when id is non-empty', async () => {
    server.use(
      http.get(`${TEST_BASE}/api/transfers/:id`, ({ params }) =>
        HttpResponse.json(makeTransfer({ id: params.id as string }))
      )
    )

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useTransfer('xfer-uuid-1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.id).toBe('xfer-uuid-1')
  })

  it('does not fetch when id is empty', async () => {
    let requestCount = 0
    server.use(
      http.get(`${TEST_BASE}/api/transfers/:id`, () => {
        requestCount++
        return HttpResponse.json(makeTransfer())
      })
    )

    const { Wrapper } = makeWrapper()
    renderHook(() => useTransfer(''), { wrapper: Wrapper })

    await new Promise((r) => setTimeout(r, 50))
    expect(requestCount).toBe(0)
  })
})
