import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser, makeUser } from '@/mocks/handlers'
import { Users } from '@/pages/admin/Users'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Users admin page', () => {
  it('renders users in table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([
          makeUser({ email: 'alice@test.com', role: 'user' }),
          makeAdminUser({ email: 'admin@test.com' }),
        ])
      )
    )

    renderWithProviders(<Users />)

    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeInTheDocument()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })
  })

  it('"New User" button opens create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Users />)

    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))

    expect(screen.getByRole('heading', { name: /create user/i })).toBeInTheDocument()
  })

  it('create user form submits via POST to /auth/register', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/auth/register`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeUser(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))

    await user.type(screen.getByRole('textbox'), 'new@test.com')
    // password is type="password", not role=textbox
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    await user.type(passwordInput, 'mypassword')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ email: 'new@test.com', password: 'mypassword' })
    })
  })

  it('create modal closes when Cancel is clicked', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Users />)

    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))
    expect(screen.getByRole('heading', { name: /create user/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create user/i })).not.toBeInTheDocument()
    })
  })

  it('create modal closes on Escape key', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Users />)

    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create user/i })).not.toBeInTheDocument()
    })
  })

  it('shows error on create failure', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/auth/register`, () =>
        HttpResponse.json({ detail: 'Email already registered' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))

    await user.type(screen.getByRole('textbox'), 'existing@test.com')
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    await user.type(passwordInput, 'password')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
    })
  })

  it('"Edit Role" button opens role modal with current role', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com', role: 'user' })])
      )
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit role/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /edit role: other@test.com/i })
      ).toBeInTheDocument()
    })
  })

  it('edit role form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([
          makeUser({ id: 'user-patch-id', email: 'patch@test.com', role: 'user' }),
        ])
      )
    )

    let patchedUrl: string | undefined
    let patchedBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/users/:id`, async ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        patchedBody = await request.json()
        return HttpResponse.json(makeUser({ id: 'user-patch-id', role: 'admin' }))
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('patch@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit role/i }))
    await waitFor(() => screen.getByRole('heading', { name: /edit role: patch@test.com/i }))

    // Change role to admin
    const roleSelect = screen.getByRole('combobox')
    await user.selectOptions(roleSelect, 'admin')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/users/user-patch-id')
      expect(patchedBody).toMatchObject({ role: 'admin' })
    })
  })

  it('edit role modal closes on Cancel', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com' })])
      )
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit role/i }))
    await waitFor(() => screen.getByRole('heading', { name: /edit role/i }))

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /edit role/i })).not.toBeInTheDocument()
    })
  })

  it('create button shows Creating… while mutation is in progress', async () => {
    setupAdmin()
    let resolvePost: () => void
    server.use(
      http.post(`${TEST_BASE}/auth/register`, async () => {
        await new Promise<void>((res) => {
          resolvePost = res
        })
        return HttpResponse.json(makeUser(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))

    await user.type(screen.getByRole('textbox'), 'pending@test.com')
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    await user.type(passwordInput, 'password')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument()
    })

    resolvePost!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /creating/i })).not.toBeInTheDocument()
    })
  })

  it('edit role save button shows Saving… while mutation is in progress', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com' })])
      )
    )

    let resolvePatch: () => void
    server.use(
      http.patch(`${TEST_BASE}/users/:id`, async () => {
        await new Promise<void>((res) => {
          resolvePatch = res
        })
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit role/i }))
    await waitFor(() => screen.getByRole('heading', { name: /edit role/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    resolvePatch!()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
    })
  })

  it('delete button not shown for current admin user', async () => {
    setupAdmin()
    // Current user is admin-uuid-1 (makeAdminUser default id)
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeAdminUser({ id: 'admin-uuid-1', email: 'admin@test.com' })])
      )
    )

    renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('admin@test.com')).toBeInTheDocument())

    // Should have Edit Role button but no Delete button
    expect(screen.getByRole('button', { name: /edit role/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('delete button is shown for other users', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com' })])
      )
    )

    renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('delete button opens confirm dialog with user email in title', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com' })])
      )
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /other@test\.com/i })).toBeInTheDocument()
    })
  })

  it('delete sends DELETE to /users/:id when confirmed via dialog', async () => {
    setupAdmin()

    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'del-user-id', email: 'del@test.com' })])
      )
    )

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/admin/users/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('del@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toBe('/api/admin/users/del-user-id')
    })
  })

  it('delete does not send DELETE when cancelled via dialog', async () => {
    setupAdmin()

    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com' })])
      )
    )

    let deleteRequestMade = false
    server.use(
      http.delete(`${TEST_BASE}/users/:id`, () => {
        deleteRequestMade = true
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })
    expect(deleteRequestMade).toBe(false)
  })

  it('shows Deleted badge and Restore button for deleted user', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    renderWithProviders(<Users />)

    await waitFor(() => {
      expect(screen.getByText('Deleted')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
    })
  })

  it('clicking Restore button calls restore endpoint', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'user-restore-id', deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/admin/users/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => screen.getByRole('button', { name: /^restore$/i }))
    await user.click(screen.getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(restoredUrl).toBe('/api/admin/users/user-restore-id/restore')
    })
  })

  it('shows Inactive badge for inactive user', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ is_active: false })])
      )
    )

    renderWithProviders(<Users />)

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('create form role select can be changed to admin', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/auth/register`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeUser(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => screen.getByRole('button', { name: /new user/i }))
    await user.click(screen.getByRole('button', { name: /new user/i }))

    await user.type(screen.getByRole('textbox'), 'admin-new@test.com')
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    await user.type(passwordInput, 'password')

    // Change role to admin using the first combobox (role select)
    await user.selectOptions(screen.getByRole('combobox'), 'admin')

    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ email: 'admin-new@test.com', role: 'admin' })
    })
  })

  it('shows error when edit role PATCH fails', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'other-id', email: 'other@test.com', role: 'user' })])
      ),
      http.patch(`${TEST_BASE}/users/:id`, () =>
        HttpResponse.json({ detail: 'Permission denied' }, { status: 403 })
      )
    )

    const { user } = renderWithProviders(<Users />)
    await waitFor(() => expect(screen.getByText('other@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit role/i }))
    await waitFor(() => screen.getByRole('heading', { name: /edit role/i }))

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
    })
  })

  it('shows No badge for unverified user', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ is_verified: false })])
      )
    )

    renderWithProviders(<Users />)

    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument()
    })
  })
})
