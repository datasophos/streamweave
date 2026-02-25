import { describe, it, expect, vi, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE } from '@/mocks/handlers'
import { useHealth } from '@/hooks/useHealth'
import { makeTestQueryClient } from '@/test/utils'

afterEach(() => {
  vi.useRealTimers()
})

function makeWrapper() {
  const qc = makeTestQueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useHealth', () => {
  it('fetches /health on mount and returns status', async () => {
    server.use(http.get(`${TEST_BASE}/health`, () => HttpResponse.json({ status: 'ok' })))

    const { result } = renderHook(() => useHealth(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('ok')
  })

  it('refetches after 30 seconds (polling)', async () => {
    vi.useFakeTimers()
    let requestCount = 0

    server.use(
      http.get(`${TEST_BASE}/health`, () => {
        requestCount++
        return HttpResponse.json({ status: 'ok' })
      }),
    )

    renderHook(() => useHealth(), { wrapper: makeWrapper() })

    // Let the initial fetch complete without running all timers
    // (runAllTimersAsync triggers infinite loop with gcTime:0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(requestCount).toBeGreaterThanOrEqual(1)

    const countAfterFirst = requestCount

    // Advance exactly 30 seconds to trigger one refetch interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(requestCount).toBeGreaterThan(countAfterFirst)
  })
})
