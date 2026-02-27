import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser, makeInstrument, makeServiceAccount } from '@/mocks/handlers'
import { Instruments } from '@/pages/admin/Instruments'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Instruments admin page', () => {
  it('renders instruments and service accounts tables', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'HPLC Unit 1' })])
      ),
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ name: 'Lab SA', username: 'labuser' })])
      )
    )

    renderWithProviders(<Instruments />)

    await waitFor(() => {
      expect(screen.getByText('HPLC Unit 1')).toBeInTheDocument()
      expect(screen.getByText('Lab SA')).toBeInTheDocument()
    })
  })

  it('"New Instrument" button opens the create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    expect(screen.getByRole('heading', { name: /new instrument/i })).toBeInTheDocument()
  })

  it('create instrument form submits valid data via POST', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/instruments`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeInstrument(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    const modal =
      screen.getByRole('dialog', { hidden: true }).closest('div[class*="relative"]') ??
      screen.getByRole('heading', { name: /new instrument/i }).closest('div.relative')!

    // Fill required fields
    const nameInput = screen.getByRole('textbox', { name: /^name/i })
    const hostInput = screen.getByRole('textbox', { name: /cifs host/i })
    const shareInput = screen.getByRole('textbox', { name: /cifs share/i })

    await user.type(nameInput, 'Test NMR')
    await user.type(hostInput, '192.168.0.10')
    await user.type(shareInput, 'nmr-data')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({
        name: 'Test NMR',
        cifs_host: '192.168.0.10',
        cifs_share: 'nmr-data',
      })
    })
    void modal
  })

  it('modal closes when Cancel is clicked', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    expect(screen.getByRole('heading', { name: /new instrument/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new instrument/i })).not.toBeInTheDocument()
    })
  })

  it('modal closes on Escape key', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    expect(screen.getByRole('heading', { name: /new instrument/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new instrument/i })).not.toBeInTheDocument()
    })
  })

  it('create instrument modal shows error on API failure', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json({ detail: 'Instrument already exists' }, { status: 422 })
      )
    )

    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    await user.type(screen.getByRole('textbox', { name: /^name/i }), 'Dup')
    await user.type(screen.getByRole('textbox', { name: /cifs host/i }), '1.2.3.4')
    await user.type(screen.getByRole('textbox', { name: /cifs share/i }), 'share')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/instrument already exists/i)).toBeInTheDocument()
    })
  })

  it('edit instrument modal pre-populates with existing values', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([
          makeInstrument({ name: 'Prefilled NMR', cifs_host: '10.0.0.5', cifs_share: 'nmr' }),
        ])
      )
    )

    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => expect(screen.getByText('Prefilled NMR')).toBeInTheDocument())

    // Click edit on the first instrument row
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[0])

    await waitFor(() => {
      const nameInput = screen.getByRole('textbox', { name: /^name/i }) as HTMLInputElement
      expect(nameInput.value).toBe('Prefilled NMR')
    })
  })

  it('edit instrument form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-patch-id', name: 'Old Name' })])
      )
    )

    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/instruments/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeInstrument({ name: 'New Name' }))
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    await waitFor(() => screen.getByRole('heading', { name: /edit instrument/i }))

    const nameInput = screen.getByRole('textbox', { name: /^name/i }) as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/instruments/inst-patch-id')
    })
  })

  it('delete instrument opens confirm dialog with instrument name', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'Confirm Me' })])
      )
    )

    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => expect(screen.getByText('Confirm Me')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirm me/i })).toBeInTheDocument()
      expect(screen.getByText(/admin can restore/i)).toBeInTheDocument()
    })
  })

  it('delete instrument sends DELETE when user confirms in dialog', async () => {
    setupAdmin()

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/instruments/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    const dialog = await screen.findByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toContain('/api/instruments/')
    })
  })

  it('delete instrument does not send DELETE when user cancels dialog', async () => {
    setupAdmin()

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/api/instruments/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    const dialog = await screen.findByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
    })
    expect(deleteRequestMade).toBe(false)
  })

  it('shows service account name in table when service_account_id is in saMap', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ service_account_id: 'sa-uuid-1' })])
      ),
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-uuid-1', name: 'Lab Account' })])
      )
    )

    renderWithProviders(<Instruments />)

    await waitFor(() => {
      // Name appears in both the instruments table (SA column) and the SA table (Name column)
      expect(screen.getAllByText('Lab Account').length).toBeGreaterThan(0)
    })
  })

  it('save button shows Saving… while instrument mutation is in progress', async () => {
    setupAdmin()
    let resolvePost: () => void
    server.use(
      http.post(`${TEST_BASE}/api/instruments`, async () => {
        await new Promise<void>((res) => {
          resolvePost = res
        })
        return HttpResponse.json(makeInstrument(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    await user.type(screen.getByRole('textbox', { name: /^name/i }), 'Test NMR')
    await user.type(screen.getByRole('textbox', { name: /cifs host/i }), '10.0.0.1')
    await user.type(screen.getByRole('textbox', { name: /cifs share/i }), 'data')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    resolvePost!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
    })
  })

  it('service account form shows error on API failure', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json({ detail: 'Name already taken' }, { status: 422 })
      )
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    await user.type(screen.getByLabelText(/^name/i), 'Dup SA')
    await user.type(screen.getByLabelText(/^username/i), 'user')
    await user.type(screen.getByLabelText(/^password/i), 'pass')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])

    await waitFor(() => {
      expect(screen.getByText(/name already taken/i)).toBeInTheDocument()
    })
  })

  it('service account save button shows Saving… while mutation is in progress', async () => {
    setupAdmin()
    let resolvePost: () => void
    server.use(
      http.post(`${TEST_BASE}/api/service-accounts`, async () => {
        await new Promise<void>((res) => {
          resolvePost = res
        })
        return HttpResponse.json(makeServiceAccount(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    await user.type(screen.getByLabelText(/^name/i), 'Pending SA')
    await user.type(screen.getByLabelText(/^username/i), 'pending_user')
    await user.type(screen.getByLabelText(/^password/i), 'pass')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    resolvePost!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
    })
  })

  it('create instrument form sends all fields when filled in', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-uuid-1', name: 'Lab SA' })])
      )
    )

    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/instruments`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeInstrument(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    // Fill ALL form fields to exercise every onChange handler
    await user.type(screen.getByRole('textbox', { name: /^name/i }), 'Full NMR')
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'A full instrument')
    await user.type(screen.getByRole('textbox', { name: /location/i }), 'Lab 1')
    await user.type(screen.getByRole('textbox', { name: /^pid$/i }), 'ark:/12345/abc')
    await user.type(screen.getByRole('textbox', { name: /cifs host/i }), '10.0.0.5')
    await user.type(screen.getByRole('textbox', { name: /cifs share/i }), 'nmr-share')
    await user.type(screen.getByRole('textbox', { name: /base path/i }), '/data/nmr')

    // Change transfer adapter select
    await user.selectOptions(screen.getByRole('combobox', { name: /adapter/i }), 'rsync')

    // Wait for SA options, then select one
    await waitFor(() => screen.getByRole('option', { name: /Lab SA/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: /service account/i }),
      'sa-uuid-1'
    )

    // Uncheck enabled
    await user.click(screen.getByRole('checkbox', { name: /^enabled$/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({
        name: 'Full NMR',
        description: 'A full instrument',
        location: 'Lab 1',
        pid: 'ark:/12345/abc',
        transfer_adapter: 'rsync',
        service_account_id: 'sa-uuid-1',
        enabled: false,
      })
    })
  })

  it('create instrument form includes pid in POST body when filled', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/instruments`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeInstrument(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    await user.type(screen.getByRole('textbox', { name: /^name/i }), 'PID Instrument')
    await user.type(screen.getByRole('textbox', { name: /^pid$/i }), 'doi:10.1234/test')
    await user.type(screen.getByRole('textbox', { name: /cifs host/i }), '10.0.0.1')
    await user.type(screen.getByRole('textbox', { name: /cifs share/i }), 'data')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ pid: 'doi:10.1234/test' })
    })
  })

  it('edit instrument modal pre-populates pid field', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'PID NMR', pid: 'ark:/99999/xyz' })])
      )
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('PID NMR')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    await waitFor(() => {
      const pidInput = screen.getByRole('textbox', { name: /^pid$/i }) as HTMLInputElement
      expect(pidInput.value).toBe('ark:/99999/xyz')
    })
  })

  it('service account form fills domain field', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/service-accounts`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeServiceAccount(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    await user.type(screen.getByLabelText(/^name/i), 'Domain SA')
    await user.type(screen.getByLabelText(/domain/i), 'LAB')
    await user.type(screen.getByLabelText(/^username/i), 'lab_user')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'Domain SA', domain: 'LAB' })
    })
  })

  it('shows Restore button for deleted instrument', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    renderWithProviders(<Instruments />)

    await waitFor(() => {
      const restoreButtons = screen.getAllByRole('button', { name: /^restore$/i })
      expect(restoreButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('clicking Restore instrument button calls restore endpoint', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([
          makeInstrument({ id: 'inst-restore-id', deleted_at: '2024-01-01T00:00:00Z' }),
        ])
      )
    )

    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/instruments/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeInstrument())
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getAllByRole('button', { name: /^restore$/i }))
    await user.click(screen.getAllByRole('button', { name: /^restore$/i })[0])

    await waitFor(() => {
      expect(restoredUrl).toBe('/api/instruments/inst-restore-id/restore')
    })
  })

  it('shows Restore button for deleted service account', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    renderWithProviders(<Instruments />)

    await waitFor(() => {
      const restoreButtons = screen.getAllByRole('button', { name: /^restore$/i })
      expect(restoreButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('clicking Restore service account button calls restore endpoint', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([
          makeServiceAccount({ id: 'sa-restore-id', deleted_at: '2024-01-01T00:00:00Z' }),
        ])
      )
    )

    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/service-accounts/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeServiceAccount())
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => screen.getAllByRole('button', { name: /^restore$/i }))
    await user.click(screen.getAllByRole('button', { name: /^restore$/i })[0])

    await waitFor(() => {
      expect(restoredUrl).toBe('/api/service-accounts/sa-restore-id/restore')
    })
  })

  it('shows Disabled badge for disabled instrument', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'Offline NMR', enabled: false })])
      )
    )

    renderWithProviders(<Instruments />)

    await waitFor(() => {
      expect(screen.getByText('Offline NMR')).toBeInTheDocument()
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
  })

  it('shows raw service_account_id when not in service account map', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ service_account_id: 'unknown-sa-uuid-99' })])
      ),
      http.get(`${TEST_BASE}/api/service-accounts`, () => HttpResponse.json([]))
    )

    renderWithProviders(<Instruments />)

    await waitFor(() => {
      // saMap is empty, so it falls back to the raw service_account_id
      expect(screen.getByText('unknown-sa-uuid-99')).toBeInTheDocument()
    })
  })

  it('delete service account sends DELETE when user confirms in dialog', async () => {
    setupAdmin()

    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-del-id', name: 'SA To Delete' })])
      )
    )

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/service-accounts/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('SA To Delete')).toBeInTheDocument())

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(deleteButtons[deleteButtons.length - 1])

    const dialog = await screen.findByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toContain('/api/service-accounts/')
    })
  })

  it('edit service account button opens modal with pre-populated values including password', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([
          makeServiceAccount({ name: 'Lab SA', username: 'labuser', domain: 'LAB' }),
        ])
      ),
      http.get(`${TEST_BASE}/api/service-accounts/:id/password`, () =>
        HttpResponse.json({ password: 'stored-pass' })
      )
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('Lab SA')).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[editButtons.length - 1])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit service account/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/^name/i) as HTMLInputElement
      expect(nameInput.value).toBe('Lab SA')
      const usernameInput = screen.getByLabelText(/^username/i) as HTMLInputElement
      expect(usernameInput.value).toBe('labuser')
      const domainInput = screen.getByLabelText(/^domain/i) as HTMLInputElement
      expect(domainInput.value).toBe('LAB')
      const pwInput = screen.getByLabelText(/^password/i) as HTMLInputElement
      expect(pwInput.value).toBe('stored-pass')
    })
  })

  it('edit service account form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-patch-id', name: 'Old SA' })])
      )
    )

    let patchedUrl: string | undefined
    let patchBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/api/service-accounts/:id`, async ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        patchBody = await request.json()
        return HttpResponse.json(makeServiceAccount({ name: 'New SA' }))
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('Old SA')).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[editButtons.length - 1])
    await waitFor(() => screen.getByRole('heading', { name: /edit service account/i }))

    const nameInput = screen.getByLabelText(/^name/i) as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'New SA')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/service-accounts/sa-patch-id')
      expect(patchBody).toMatchObject({ name: 'New SA' })
    })
  })

  it('edit service account form does not send password when cleared', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-nopwd-id', name: 'No Pwd SA' })])
      ),
      http.get(`${TEST_BASE}/api/service-accounts/:id/password`, () =>
        HttpResponse.json({ password: '' })
      )
    )

    let patchBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/api/service-accounts/:id`, async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json(makeServiceAccount())
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('No Pwd SA')).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[editButtons.length - 1])
    await waitFor(() => screen.getByRole('heading', { name: /edit service account/i }))

    // Password field is empty — save without touching it
    await waitFor(() => {
      const pwInput = screen.getByLabelText(/^password/i) as HTMLInputElement
      expect(pwInput.value).toBe('')
    })
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchBody).not.toHaveProperty('password')
    })
  })

  it('edit service account form sends password when filled', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-pwd-id', name: 'Pwd SA' })])
      ),
      http.get(`${TEST_BASE}/api/service-accounts/:id/password`, () =>
        HttpResponse.json({ password: '' })
      )
    )

    let patchBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/api/service-accounts/:id`, async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json(makeServiceAccount())
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('Pwd SA')).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[editButtons.length - 1])
    await waitFor(() => screen.getByRole('heading', { name: /edit service account/i }))

    // Wait for form to load, then type the new password
    await waitFor(() => screen.getByLabelText(/^password/i))
    await user.type(screen.getByLabelText(/^password/i), 'newpassword')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchBody).toHaveProperty('password', 'newpassword')
    })
  })

  it('edit service account modal shows error on API failure', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ name: 'Error SA' })])
      )
    )
    server.use(
      http.patch(`${TEST_BASE}/api/service-accounts/:id`, () =>
        HttpResponse.json({ detail: 'Update failed' }, { status: 422 })
      )
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('Error SA')).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[editButtons.length - 1])
    await waitFor(() => screen.getByRole('heading', { name: /edit service account/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument()
    })
  })

  it('delete service account does not send DELETE when user cancels dialog', async () => {
    setupAdmin()

    server.use(
      http.get(`${TEST_BASE}/api/service-accounts`, () =>
        HttpResponse.json([makeServiceAccount({ id: 'sa-del-id', name: 'SA To Delete' })])
      )
    )

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/api/service-accounts/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getByText('SA To Delete')).toBeInTheDocument())

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(deleteButtons[deleteButtons.length - 1])

    const dialog = await screen.findByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
    })
    expect(deleteRequestMade).toBe(false)
  })

  it('required instrument fields get aria-invalid after failed submit attempt', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    // Attempt to submit without filling required fields
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      const nameInput = screen.getByRole('textbox', { name: /^name/i })
      const hostInput = screen.getByRole('textbox', { name: /cifs host/i })
      const shareInput = screen.getByRole('textbox', { name: /cifs share/i })
      expect(nameInput).toHaveAttribute('aria-invalid', 'true')
      expect(hostInput).toHaveAttribute('aria-invalid', 'true')
      expect(shareInput).toHaveAttribute('aria-invalid', 'true')
    })
  })

  it('aria-invalid clears on required instrument field when value is entered', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new instrument/i }))
    await user.click(screen.getByRole('button', { name: /new instrument/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /^name/i })).toHaveAttribute(
        'aria-invalid',
        'true'
      )
    })

    await user.type(screen.getByRole('textbox', { name: /^name/i }), 'NMR Unit')

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /^name/i })).not.toHaveAttribute('aria-invalid')
    })
  })

  it('password eye toggle reveals and hides password in service account form', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    const pwInput = screen.getByLabelText(/^password/i) as HTMLInputElement
    expect(pwInput.type).toBe('password')

    // Eye button only appears once something is typed
    await user.type(pwInput, 'mypassword')
    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(pwInput.type).toBe('text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(pwInput.type).toBe('password')
  })

  it('required service account fields get aria-invalid after failed submit attempt', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])

    await waitFor(() => {
      expect(screen.getByLabelText(/^name/i)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(/^username/i)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('aria-invalid', 'true')
    })
  })

  it('"New Service Account" button opens the service account modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    expect(screen.getByRole('heading', { name: /new service account/i })).toBeInTheDocument()
  })

  it('service account form submits via POST', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/service-accounts`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeServiceAccount(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => screen.getByRole('button', { name: /new service account/i }))
    await user.click(screen.getByRole('button', { name: /new service account/i }))

    // Service account form fields (by label, inside modal)
    const inputs = screen.getAllByRole('textbox')
    // Name, Domain, Username - find them by label text within modal context
    await user.type(screen.getByLabelText(/^name/i), 'My SA')
    await user.type(screen.getByLabelText(/^username/i), 'svc_user')
    // Password is type=password
    await user.type(screen.getByLabelText(/^password/i), 'supersecret')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])
    void inputs

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'My SA', username: 'svc_user' })
    })
  })
})
