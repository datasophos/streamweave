import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser, makeHookConfig, makeInstrument } from '@/mocks/handlers'
import { Hooks } from '@/pages/admin/Hooks'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Hooks admin page', () => {
  it('renders hook configurations in table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ name: 'My Hook', implementation: 'builtin' })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('My Hook')).toBeInTheDocument()
      expect(screen.getByText('builtin')).toBeInTheDocument()
    })
  })

  it('shows Post-transfer badge for post_transfer hooks', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ trigger: 'post_transfer' })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('Post-transfer')).toBeInTheDocument()
    })
  })

  it('shows Pre-transfer badge for pre_transfer hooks', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ trigger: 'pre_transfer' })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('Pre-transfer')).toBeInTheDocument()
    })
  })

  it('shows instrument name in Scope column when instrument_id is set', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      ),
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ instrument_id: 'inst-uuid-1' })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('Bruker NMR')).toBeInTheDocument()
    })
  })

  it('shows truncated instrument_id when not in instrument map', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ instrument_id: 'unknown-inst-id' })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('unknown-')).toBeInTheDocument()
    })
  })

  it('shows Global when no instrument_id', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ instrument_id: null })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('Global')).toBeInTheDocument()
    })
  })

  it('shows Disabled badge for disabled hook', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ enabled: false })])
      )
    )

    renderWithProviders(<Hooks />)

    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
  })

  it('"New Hook" button opens create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Hooks />)

    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    expect(screen.getByRole('heading', { name: /new hook configuration/i })).toBeInTheDocument()
  })

  it('create form submits builtin hook via POST', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'My Builtin Hook')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'My Builtin Hook', implementation: 'builtin' })
    })
  })

  it('switching to python_script shows script path field', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Hooks />)

    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const combos = screen.getAllByRole('combobox')
    // Trigger is combos[0], Implementation is combos[1]
    const implSelect = combos[1]
    await user.selectOptions(implSelect, 'python_script')

    await waitFor(() => {
      expect(screen.getByPlaceholderText('/hooks/my_hook.py')).toBeInTheDocument()
    })
  })

  it('switching to http_webhook shows webhook URL field', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Hooks />)

    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[1], 'http_webhook')

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/https:\/\/example.com\/webhook/i)).toBeInTheDocument()
    })
  })

  it('python_script hook sends script_path in POST', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Script Hook')

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[1], 'python_script')

    await waitFor(() => screen.getByPlaceholderText('/hooks/my_hook.py'))
    await user.type(screen.getByPlaceholderText('/hooks/my_hook.py'), '/hooks/custom.py')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({
        name: 'Script Hook',
        implementation: 'python_script',
        script_path: '/hooks/custom.py',
      })
    })
  })

  it('create form with all fields changed sends correct data', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Full Hook')
    await user.type(textboxes[1], 'A full description')

    // Change trigger to pre_transfer
    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[0], 'pre_transfer')

    // Priority field
    const priorityInput = screen.getByRole('spinbutton')
    await user.clear(priorityInput)
    await user.type(priorityInput, '5')

    // Uncheck enabled
    await user.click(screen.getByRole('checkbox'))

    // Type in builtin name
    const builtinInput = screen.getByPlaceholderText(/nemo_status_check/i)
    await user.type(builtinInput, 'my_builtin')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({
        name: 'Full Hook',
        description: 'A full description',
        trigger: 'pre_transfer',
        enabled: false,
        builtin_name: 'my_builtin',
      })
    })
  })

  it('modal closes when Cancel is clicked', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Hooks />)

    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))
    expect(screen.getByRole('heading', { name: /new hook configuration/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /new hook configuration/i })
      ).not.toBeInTheDocument()
    })
  })

  it('modal closes on Escape key', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Hooks />)

    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /new hook configuration/i })
      ).not.toBeInTheDocument()
    })
  })

  it('shows error on API failure', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json({ detail: 'Hook name taken' }, { status: 422 })
      )
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Dup')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/hook name taken/i)).toBeInTheDocument()
    })
  })

  it('edit modal pre-populates with hook values', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ name: 'Existing Hook', priority: 5 })])
      )
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => expect(screen.getByText('Existing Hook')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    await waitFor(() => {
      const textboxes = screen.getAllByRole('textbox')
      expect((textboxes[0] as HTMLInputElement).value).toBe('Existing Hook')
    })
  })

  it('edit form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ id: 'hook-patch-id', name: 'Old Hook' })])
      )
    )

    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/hooks/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeHookConfig())
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => expect(screen.getByText('Old Hook')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    await waitFor(() => screen.getByRole('heading', { name: /edit hook configuration/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/hooks/hook-patch-id')
    })
  })

  it('instrument select can be changed to a specific instrument', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      )
    )

    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    // Wait for instrument options to load
    await waitFor(() => {
      expect(screen.getByText('Bruker NMR')).toBeInTheDocument()
    })

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Scoped Hook')

    const combos = screen.getAllByRole('combobox')
    // Instrument select is combos[2] (trigger, implementation, instrument)
    await user.selectOptions(combos[2], 'inst-uuid-1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ instrument_id: 'inst-uuid-1' })
    })
  })

  it('save button shows Saving… while mutation is in progress', async () => {
    setupAdmin()
    let resolvePost: () => void
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async () => {
        await new Promise<void>((res) => {
          resolvePost = res
        })
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Pending Hook')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    resolvePost!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
    })
  })

  it('http_webhook hook sends webhook_url in POST', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Webhook Hook')

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[1], 'http_webhook')

    await waitFor(() => screen.getByPlaceholderText(/https:\/\/example.com\/webhook/i))
    await user.type(
      screen.getByPlaceholderText(/https:\/\/example.com\/webhook/i),
      'https://my.server/hook'
    )
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({
        name: 'Webhook Hook',
        implementation: 'http_webhook',
        webhook_url: 'https://my.server/hook',
      })
    })
  })

  it('instrument_id onChange covers empty-value branch (global selection)', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-uuid-1', name: 'Bruker NMR' })])
      )
    )

    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/hooks`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeHookConfig(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getByRole('button', { name: /new hook/i }))
    await user.click(screen.getByRole('button', { name: /new hook/i }))

    await waitFor(() => screen.getByText('Bruker NMR'))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Global Hook')

    // Select an instrument, then clear it back to the "— Global —" option
    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[2], 'inst-uuid-1')
    // Select the "— Global —" option by its visible text
    await user.selectOptions(combos[2], '— Global —')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      // instrument_id should be absent (undefined) from the posted body
      expect((postedBody as Record<string, unknown>).instrument_id).toBeUndefined()
    })
  })

  it('delete button opens confirm dialog with hook name in title', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/hooks`, () =>
        HttpResponse.json([makeHookConfig({ name: 'Delete Me' })])
      )
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => expect(screen.getByText('Delete Me')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Delete Me/i })).toBeInTheDocument()
    })
  })

  it('delete sends DELETE when user confirms via dialog', async () => {
    setupAdmin()

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/hooks/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toContain('/api/hooks/')
    })
  })

  it('delete does not send DELETE when user cancels via dialog', async () => {
    setupAdmin()

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/api/hooks/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Hooks />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })
    expect(deleteRequestMade).toBe(false)
  })
})
