import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
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

  it('delete instrument calls window.confirm with instrument name', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ name: 'Confirm Me' })])
      )
    )

    const confirmSpy = vi.mocked(window.confirm)
    const { user } = renderWithProviders(<Instruments />)

    await waitFor(() => expect(screen.getByText('Confirm Me')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Confirm Me'))
  })

  it('delete instrument sends DELETE when user confirms', async () => {
    setupAdmin()
    vi.mocked(window.confirm).mockReturnValue(true)

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/instruments/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^delete$/i })).toBeTruthy())

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => {
      expect(deletedUrl).toContain('/api/instruments/')
    })
  })

  it('delete instrument does not send DELETE when user cancels confirm', async () => {
    setupAdmin()
    vi.mocked(window.confirm).mockReturnValueOnce(false)

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/api/instruments/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Instruments />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^delete$/i })).toBeTruthy())

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await new Promise((r) => setTimeout(r, 50))
    expect(deleteRequestMade).toBe(false)
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
