import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser, makeStorageLocation } from '@/mocks/handlers'
import { Storage } from '@/pages/admin/Storage'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Storage admin page', () => {
  it('renders storage locations table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ name: 'NAS Archive', base_path: '/nas/data' })])
      )
    )

    renderWithProviders(<Storage />)

    await waitFor(() => {
      expect(screen.getByText('NAS Archive')).toBeInTheDocument()
      expect(screen.getByText('/nas/data')).toBeInTheDocument()
    })
  })

  it('"New Storage Location" button opens create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Storage />)

    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))

    expect(screen.getByRole('heading', { name: /new storage location/i })).toBeInTheDocument()
  })

  it('create form submits valid data via POST', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeStorageLocation(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Storage />)

    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'My Storage')
    await user.type(screen.getByPlaceholderText('/storage/archive'), '/mnt/data')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'My Storage', base_path: '/mnt/data' })
    })
  })

  it('modal closes when Cancel is clicked', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Storage />)

    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))
    expect(screen.getByRole('heading', { name: /new storage location/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /new storage location/i })
      ).not.toBeInTheDocument()
    })
  })

  it('modal closes on Escape key', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Storage />)

    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))
    expect(screen.getByRole('heading', { name: /new storage location/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /new storage location/i })
      ).not.toBeInTheDocument()
    })
  })

  it('shows error message on API failure', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json({ detail: 'Name already taken' }, { status: 422 })
      )
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Dup')
    await user.type(screen.getByPlaceholderText('/storage/archive'), '/data')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/name already taken/i)).toBeInTheDocument()
    })
  })

  it('edit modal pre-populates with existing values', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ name: 'Old Archive', base_path: '/old/path' })])
      )
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => expect(screen.getByText('Old Archive')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    await waitFor(() => {
      const textboxes = screen.getAllByRole('textbox')
      expect((textboxes[0] as HTMLInputElement).value).toBe('Old Archive')
    })
  })

  it('edit form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ id: 'storage-patch-id', name: 'Old Name' })])
      )
    )

    let patchedUrl: string | undefined
    server.use(
      http.patch(`${TEST_BASE}/api/storage-locations/:id`, ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        return HttpResponse.json(makeStorageLocation())
      })
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    await waitFor(() => screen.getByRole('heading', { name: /edit storage location/i }))

    const nameInput = screen.getAllByRole('textbox')[0] as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/storage-locations/storage-patch-id')
    })
  })

  it('delete calls window.confirm with storage name', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ name: 'Confirm Me' })])
      )
    )

    const confirmSpy = vi.mocked(window.confirm)
    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => expect(screen.getByText('Confirm Me')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Confirm Me'))
  })

  it('delete sends DELETE when user confirms', async () => {
    setupAdmin()
    vi.mocked(window.confirm).mockReturnValue(true)

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/storage-locations/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await waitFor(() => {
      expect(deletedUrl).toContain('/api/storage-locations/')
    })
  })

  it('delete does not send DELETE when user cancels', async () => {
    setupAdmin()
    vi.mocked(window.confirm).mockReturnValueOnce(false)

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/api/storage-locations/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => screen.getAllByRole('button', { name: /^delete$/i }))

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    await new Promise((r) => setTimeout(r, 50))
    expect(deleteRequestMade).toBe(false)
  })

  it('create form enabled checkbox can be unchecked', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeStorageLocation(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Disabled Storage')
    await user.type(screen.getByPlaceholderText('/storage/archive'), '/mnt/archive')

    // Uncheck the enabled checkbox
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'Disabled Storage', enabled: false })
    })
  })

  it('create form type select can be changed', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeStorageLocation(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'S3 Bucket')
    await user.selectOptions(screen.getByRole('combobox'), 's3')
    await user.type(screen.getByPlaceholderText('/storage/archive'), 's3://my-bucket')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'S3 Bucket', type: 's3' })
    })
  })

  it('save button shows Saving… while mutation is in progress', async () => {
    setupAdmin()
    let resolvePost: () => void
    server.use(
      http.post(`${TEST_BASE}/api/storage-locations`, async () => {
        await new Promise<void>((res) => {
          resolvePost = res
        })
        return HttpResponse.json(makeStorageLocation(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Storage />)
    await waitFor(() => screen.getByRole('button', { name: /new storage location/i }))
    await user.click(screen.getByRole('button', { name: /new storage location/i }))

    const textboxes = screen.getAllByRole('textbox')
    await user.type(textboxes[0], 'Pending Storage')
    await user.type(screen.getByPlaceholderText('/storage/archive'), '/mnt/pending')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    resolvePost!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
    })
  })

  it('shows Disabled badge for disabled storage location', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/storage-locations`, () =>
        HttpResponse.json([makeStorageLocation({ enabled: false })])
      )
    )

    renderWithProviders(<Storage />)

    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })
  })
})
