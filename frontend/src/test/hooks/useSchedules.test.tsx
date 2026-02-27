import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { TEST_BASE, makeSchedule } from '@/mocks/handlers'
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useRestoreSchedule,
} from '@/hooks/useSchedules'
import { makeTestQueryClient } from '@/test/utils'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useSchedules', () => {
  it('returns schedules from API', async () => {
    const qc = makeTestQueryClient()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ cron_expression: '0 2 * * *' })])
      )
    )

    const { result } = renderHook(() => useSchedules(), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].cron_expression).toBe('0 2 * * *')
  })
})

describe('useCreateSchedule', () => {
  it('sends POST to /api/schedules and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/schedules`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeSchedule(), { status: 201 })
      })
    )

    const { result } = renderHook(() => useCreateSchedule(), { wrapper: wrapper(qc) })
    result.current.mutate({
      instrument_id: 'inst-uuid-1',
      default_storage_location_id: 'storage-uuid-1',
      cron_expression: '0 3 * * *',
      enabled: true,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((postedBody as { cron_expression: string }).cron_expression).toBe('0 3 * * *')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['schedules'] }))
  })
})

describe('useUpdateSchedule', () => {
  it('sends PATCH to /api/schedules/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/schedules/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeSchedule())
      })
    )

    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: wrapper(qc) })
    result.current.mutate({ id: 'sched-uuid-1', data: { cron_expression: '0 4 * * *' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(patchedUrl).toBe('/api/schedules/sched-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['schedules'] }))
  })
})

describe('useDeleteSchedule', () => {
  it('sends DELETE to /api/schedules/:id and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/schedules/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { result } = renderHook(() => useDeleteSchedule(), { wrapper: wrapper(qc) })
    result.current.mutate('sched-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deletedUrl).toBe('/api/schedules/sched-uuid-1')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['schedules'] }))
  })
})

describe('useRestoreSchedule', () => {
  it('sends POST to /api/schedules/:id/restore and invalidates query', async () => {
    const qc = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/schedules/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeSchedule())
      })
    )

    const { result } = renderHook(() => useRestoreSchedule(), { wrapper: wrapper(qc) })
    result.current.mutate('sched-uuid-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(restoredUrl).toBe('/api/schedules/sched-uuid-1/restore')
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['schedules'] }))
  })
})

describe('useSchedules with includeDeleted', () => {
  it('passes include_deleted=true param when includeDeleted is true', async () => {
    const qc = makeTestQueryClient()
    let capturedParams: URLSearchParams | null = null
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, ({ request }) => {
        capturedParams = new URL(request.url).searchParams
        return HttpResponse.json([makeSchedule()])
      })
    )

    const { result } = renderHook(() => useSchedules(true), { wrapper: wrapper(qc) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedParams!.get('include_deleted')).toBe('true')
  })
})
