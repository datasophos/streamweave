import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import {
  TEST_BASE,
  makeAdminUser,
  makeSchedule,
  makeInstrument,
  makeStorageLocation,
} from '@/mocks/handlers'
import { Schedules } from '@/pages/admin/Schedules'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Schedules admin page', () => {
  it('renders schedules table with instrument and storage names', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      ),
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ id: 'storage-uuid-1', name: 'Archive' })])
      ),
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([
          makeSchedule({
            instrument_id: 'inst-uuid-1',
            default_storage_location_id: 'storage-uuid-1',
          }),
        ])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      expect(screen.getByText('Bruker NMR')).toBeInTheDocument()
      expect(screen.getByText('Archive')).toBeInTheDocument()
      expect(screen.getByText('0 * * * *')).toBeInTheDocument()
    })
  })

  it('"New Schedule" button opens create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Schedules />)

    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))

    expect(screen.getByRole('heading', { name: /new harvest schedule/i })).toBeInTheDocument()
  })

  it('create form submits valid data via POST', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      ),
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ id: 'storage-uuid-1', name: 'Archive' })])
      )
    )

    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/schedules`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeSchedule(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))

    // Wait for dropdowns to populate with options
    await waitFor(() => {
      const combos = screen.getAllByRole('combobox')
      expect(combos[0].querySelectorAll('option').length).toBeGreaterThan(1)
    })

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[0], 'inst-uuid-1')
    await user.selectOptions(combos[1], 'storage-uuid-1')

    const cronInput = screen.getByPlaceholderText('0 * * * *')
    await user.clear(cronInput)
    await user.type(cronInput, '0 2 * * *')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({
        instrument_id: 'inst-uuid-1',
        default_storage_location_id: 'storage-uuid-1',
        cron_expression: '0 2 * * *',
      })
    })
  })

  it('modal closes when Cancel is clicked', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Schedules />)

    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))
    expect(screen.getByRole('heading', { name: /new harvest schedule/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /new harvest schedule/i })
      ).not.toBeInTheDocument()
    })
  })

  it('modal closes on Escape key', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Schedules />)

    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))
    expect(screen.getByRole('heading', { name: /new harvest schedule/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /new harvest schedule/i })
      ).not.toBeInTheDocument()
    })
  })

  it('shows error on API failure', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      ),
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ id: 'storage-uuid-1', name: 'Archive' })])
      ),
      http.post(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json({ detail: 'Schedule conflict' }, { status: 422 })
      )
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))

    // Wait for dropdowns to load
    await waitFor(() => {
      const combos = screen.getAllByRole('combobox')
      expect(combos[0].querySelectorAll('option').length).toBeGreaterThan(1)
    })

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[0], 'inst-uuid-1')
    await user.selectOptions(combos[1], 'storage-uuid-1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/schedule conflict/i)).toBeInTheDocument()
    })
  })

  it('edit modal pre-populates with existing cron value', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ cron_expression: '0 6 * * *' })])
      )
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => expect(screen.getByText('0 6 * * *')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    await waitFor(() => {
      const cronInput = screen.getByPlaceholderText('0 * * * *') as HTMLInputElement
      expect(cronInput.value).toBe('0 6 * * *')
    })
  })

  it('edit form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ id: 'sched-patch-id' })])
      )
    )

    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/schedules/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeSchedule())
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getAllByRole('button', { name: /^edit$/i }))

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    await waitFor(() => screen.getByRole('heading', { name: /edit harvest schedule/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/schedules/sched-patch-id')
    })
  })

  it('delete button opens confirm dialog with cron expression in title', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Schedules />)

    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('delete sends DELETE when user confirms via dialog', async () => {
    setupAdmin()

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/schedules/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toContain('/api/schedules/')
    })
  })

  it('delete does not send DELETE when user cancels via dialog', async () => {
    setupAdmin()

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/api/schedules/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })
    expect(deleteRequestMade).toBe(false)
  })

  it('create form enabled checkbox can be unchecked', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      ),
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ id: 'storage-uuid-1', name: 'Archive' })])
      )
    )

    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/schedules`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeSchedule(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))

    await waitFor(() => {
      const combos = screen.getAllByRole('combobox')
      expect(combos[0].querySelectorAll('option').length).toBeGreaterThan(1)
    })

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[0], 'inst-uuid-1')
    await user.selectOptions(combos[1], 'storage-uuid-1')

    // Uncheck the enabled checkbox
    await user.click(screen.getByRole('checkbox', { name: /^enabled$/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ enabled: false })
    })
  })

  it('save button shows Saving… while mutation is in progress', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      ),
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ id: 'storage-uuid-1', name: 'Archive' })])
      )
    )

    let resolvePost: () => void
    server.use(
      http.post(`${TEST_BASE}/api/schedules`, async () => {
        await new Promise<void>((res) => {
          resolvePost = res
        })
        return HttpResponse.json(makeSchedule(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))

    await waitFor(() => {
      const combos = screen.getAllByRole('combobox')
      expect(combos[0].querySelectorAll('option').length).toBeGreaterThan(1)
    })

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[0], 'inst-uuid-1')
    await user.selectOptions(combos[1], 'storage-uuid-1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    resolvePost!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
    })
  })

  it('shows Synced badge when prefect_deployment_id is set', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ prefect_deployment_id: 'deploy-123' })])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      expect(screen.getByText('Synced')).toBeInTheDocument()
    })
  })

  it('shows Not synced badge when prefect_deployment_id is null', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ prefect_deployment_id: null })])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      expect(screen.getByText('Not synced')).toBeInTheDocument()
    })
  })

  it('shows truncated instrument_id when not in instrument map', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ instrument_id: 'unknown-inst-id' })])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      // Shows first 8 chars when instrument not in map
      expect(screen.getByText('unknown-')).toBeInTheDocument()
    })
  })

  it('shows truncated storage_id when not in storage map', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ default_storage_location_id: 'unknown-stor-id' })])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      expect(screen.getByText('unknown-')).toBeInTheDocument()
    })
  })

  it('cron hint links to crontab.guru', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Schedules />)

    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }))
    await user.click(screen.getByRole('button', { name: /new schedule/i }))

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /crontab\.guru/i })
      expect(link).toHaveAttribute('href', 'https://crontab.guru/')
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  it('shows Deleted badge and Restore button for deleted schedule', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      expect(screen.getByText('Deleted')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
    })
  })

  it('clicking Restore button calls restore endpoint', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([
          makeSchedule({ id: 'sched-restore-id', deleted_at: '2024-01-01T00:00:00Z' }),
        ])
      )
    )

    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/schedules/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeSchedule())
      })
    )

    const { user } = renderWithProviders(<Schedules />)
    await waitFor(() => screen.getByRole('button', { name: /^restore$/i }))
    await user.click(screen.getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(restoredUrl).toBe('/api/schedules/sched-restore-id/restore')
    })
  })

  it('shows Disabled badge for disabled schedule', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/schedules`, () =>
        HttpResponse.json([makeSchedule({ enabled: false })])
      )
    )

    renderWithProviders(<Schedules />)

    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
  })
})
