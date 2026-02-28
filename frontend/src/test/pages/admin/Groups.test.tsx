import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser, makeGroup, makeGroupMember, makeUser } from '@/mocks/handlers'
import { Groups } from '@/pages/admin/Groups'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Groups admin page', () => {
  it('renders groups in table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([
          makeGroup({ id: 'g1', name: 'Lab A' }),
          makeGroup({ id: 'g2', name: 'Lab B' }),
        ])
      )
    )

    renderWithProviders(<Groups />)

    await waitFor(() => {
      expect(screen.getByText('Lab A')).toBeInTheDocument()
      expect(screen.getByText('Lab B')).toBeInTheDocument()
    })
  })

  it('"New Group" button opens create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Groups />)

    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    expect(screen.getByRole('heading', { name: /create group/i })).toBeInTheDocument()
  })

  it('create form submits POST to /api/groups', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/groups`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeGroup(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    const [nameInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'My Group')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'My Group' })
    })
  })

  it('create modal closes on Cancel', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Groups />)

    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create group/i })).not.toBeInTheDocument()
    })
  })

  it('create modal closes on Escape', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Groups />)

    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create group/i })).not.toBeInTheDocument()
    })
  })

  it('"Edit" button opens edit modal with group name', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Target Group' })])
      )
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Target Group')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit group: target group/i })).toBeInTheDocument()
    })
  })

  it('edit form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g-patch-id', name: 'Old Name' })])
      )
    )

    let patchedUrl: string | undefined
    let patchedBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/api/groups/:id`, async ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        patchedBody = await request.json()
        return HttpResponse.json(makeGroup({ id: 'g-patch-id', name: 'New Name' }))
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await waitFor(() => screen.getByRole('heading', { name: /edit group/i }))

    const nameInput = screen.getAllByRole('textbox')[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/groups/g-patch-id')
      expect(patchedBody).toMatchObject({ name: 'New Name' })
    })
  })

  it('"Delete" button opens confirm dialog', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Del Group' })])
      )
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Del Group')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /del group/i })).toBeInTheDocument()
    })
  })

  it('delete sends DELETE to /api/groups/:id when confirmed', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g-del-id', name: 'To Delete' })])
      )
    )

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/groups/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('To Delete')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toBe('/api/groups/g-del-id')
    })
  })

  it('shows Deleted badge and Restore button for deleted group', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    renderWithProviders(<Groups />)

    await waitFor(() => {
      expect(screen.getByText('Deleted')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
    })
  })

  it('restore button calls restore endpoint', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g-restore-id', deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/groups/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeGroup({ id: 'g-restore-id' }))
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => screen.getByRole('button', { name: /^restore$/i }))
    await user.click(screen.getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(restoredUrl).toBe('/api/groups/g-restore-id/restore')
    })
  })

  it('"Members" button opens members panel', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () =>
        HttpResponse.json([makeGroupMember({ user_id: 'user-uuid-1' })])
      )
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /members of lab group/i })).toBeInTheDocument()
    })
  })

  it('members panel shows existing members', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () =>
        HttpResponse.json([makeGroupMember({ user_id: 'user-uuid-1' })])
      ),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'user-uuid-1', email: 'member@test.com' })])
      )
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByText('member@test.com')).toBeInTheDocument()
    })
  })

  it('members panel remove button calls DELETE', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () =>
        HttpResponse.json([makeGroupMember({ group_id: 'g1', user_id: 'user-uuid-1' })])
      ),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'user-uuid-1', email: 'member@test.com' })])
      )
    )

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/groups/:id/members/:userId`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() => expect(screen.getByText('member@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^remove$/i }))

    await waitFor(() => {
      expect(deletedUrl).toBe('/api/groups/g1/members/user-uuid-1')
    })
  })

  it('"Show deleted" toggle sends include_deleted=true to API', async () => {
    setupAdmin()
    let receivedUrl: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/groups`, ({ request }) => {
        receivedUrl = request.url
        const deleted = new URL(request.url).searchParams.get('include_deleted')
        return HttpResponse.json(
          deleted === 'true' ? [makeGroup({ deleted_at: '2024-01-01T00:00:00Z' })] : []
        )
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => screen.getByRole('checkbox'))

    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(receivedUrl).toContain('include_deleted=true')
    })
    expect(screen.getByText('Deleted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json({ detail: 'Group already exists' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    const [nameInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'Duplicate')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/group already exists/i)).toBeInTheDocument()
    })
  })

  it('members panel shows no members message when list is empty', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() => {
      expect(screen.getByText(/no members/i)).toBeInTheDocument()
    })
  })

  it('add member button calls addMember API when user is selected', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'u-new', email: 'new@test.com' })])
      ),
      http.post(`${TEST_BASE}/api/groups/:id/members`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeGroupMember(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of/i })).toBeInTheDocument()
    )
    await user.selectOptions(screen.getByRole('combobox'), 'u-new')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => {
      expect(postedBody).toMatchObject({ user_id: 'u-new' })
    })
  })

  it('create form shows saving state while mutation is pending', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/groups`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json(makeGroup(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    const [nameInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'Slow Group')
    user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })
  })

  it('handleAdd guard: clicking disabled Add button does not trigger mutation', async () => {
    setupAdmin()
    let mutationCalled = false
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () => HttpResponse.json([])),
      http.post(`${TEST_BASE}/api/groups/:id/members`, () => {
        mutationCalled = true
        return HttpResponse.json(makeGroupMember(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of/i })).toBeInTheDocument()
    )
    // No user selected — button is disabled; fireEvent bypasses the disabled check
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    })
    // Give time for any potential mutation to fire
    await new Promise((r) => setTimeout(r, 50))
    expect(mutationCalled).toBe(false)
  })

  it('members panel shows user id when user is not in users list', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () =>
        HttpResponse.json([makeGroupMember({ group_id: 'g1', user_id: 'unknown-user-id' })])
      ),
      http.get(`${TEST_BASE}/api/admin/users`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByText('unknown-user-id')).toBeInTheDocument()
    })
  })

  it('members panel shows error when add member fails', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'u-fail', email: 'fail@test.com' })])
      ),
      http.post(`${TEST_BASE}/api/groups/:id/members`, () =>
        HttpResponse.json({ detail: 'User already a member' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of/i })).toBeInTheDocument()
    )
    await user.selectOptions(screen.getByRole('combobox'), 'u-fail')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(screen.getByText(/user already a member/i)).toBeInTheDocument()
    })
  })

  it('description field onChange updates form value and is submitted', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/groups`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeGroup(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => screen.getByRole('button', { name: /new group/i }))
    await user.click(screen.getByRole('button', { name: /new group/i }))

    const [nameInput, descInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'My Group')
    await user.type(descInput, 'A test description')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'My Group', description: 'A test description' })
    })
  })

  it('shows group description when non-null', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ description: 'Genomics lab' })])
      )
    )

    renderWithProviders(<Groups />)

    await waitFor(() => {
      expect(screen.getByText('Genomics lab')).toBeInTheDocument()
    })
  })

  it('MembersPanel Escape key handler closes panel', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Lab Group' })])
      ),
      http.get(`${TEST_BASE}/api/groups/:id/members`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Groups />)
    await waitFor(() => expect(screen.getByText('Lab Group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of lab group/i })).toBeInTheDocument()
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /members of lab group/i })
      ).not.toBeInTheDocument()
    })
  })
})
