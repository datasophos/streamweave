import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within, act } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import {
  TEST_BASE,
  makeAdminUser,
  makeGroup,
  makeProject,
  makeProjectMember,
  makeUser,
} from '@/mocks/handlers'
import { Projects } from '@/pages/admin/Projects'

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Projects admin page', () => {
  it('renders projects in table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([
          makeProject({ id: 'p1', name: 'Alpha Project' }),
          makeProject({ id: 'p2', name: 'Beta Project' }),
        ])
      )
    )

    renderWithProviders(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Alpha Project')).toBeInTheDocument()
      expect(screen.getByText('Beta Project')).toBeInTheDocument()
    })
  })

  it('"New Project" button opens create modal', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Projects />)

    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    expect(screen.getByRole('heading', { name: /create project/i })).toBeInTheDocument()
  })

  it('create form submits POST to /api/projects', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/projects`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeProject(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    const [nameInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'New Project')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'New Project' })
    })
  })

  it('create modal closes on Cancel', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Projects />)

    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create project/i })).not.toBeInTheDocument()
    })
  })

  it('create modal closes on Escape', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<Projects />)

    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create project/i })).not.toBeInTheDocument()
    })
  })

  it('"Edit" button opens edit modal with project name', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'Target Project' })])
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('Target Project')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /edit project: target project/i })
      ).toBeInTheDocument()
    })
  })

  it('edit form sends PATCH to correct URL', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p-patch-id', name: 'Old Name' })])
      )
    )

    let patchedUrl: string | undefined
    let patchedBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/api/projects/:id`, async ({ request }) => {
        patchedUrl = new URL(request.url).pathname
        patchedBody = await request.json()
        return HttpResponse.json(makeProject({ id: 'p-patch-id', name: 'New Name' }))
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await waitFor(() => screen.getByRole('heading', { name: /edit project/i }))

    const nameInput = screen.getAllByRole('textbox')[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(patchedUrl).toBe('/api/projects/p-patch-id')
      expect(patchedBody).toMatchObject({ name: 'New Name' })
    })
  })

  it('"Delete" button opens confirm dialog', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'Del Project' })])
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('Del Project')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /del project/i })).toBeInTheDocument()
    })
  })

  it('delete sends DELETE to /api/projects/:id when confirmed', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p-del-id', name: 'To Delete' })])
      )
    )

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/projects/:id`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('To Delete')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deletedUrl).toBe('/api/projects/p-del-id')
    })
  })

  it('shows Deleted badge and Restore button for deleted project', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    renderWithProviders(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Deleted')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
    })
  })

  it('restore button calls restore endpoint', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p-restore-id', deleted_at: '2024-01-01T00:00:00Z' })])
      )
    )

    let restoredUrl: string | undefined
    server.use(
      http.post(`${TEST_BASE}/api/projects/:id/restore`, ({ request }) => {
        restoredUrl = new URL(request.url).pathname
        return HttpResponse.json(makeProject({ id: 'p-restore-id' }))
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => screen.getByRole('button', { name: /^restore$/i }))
    await user.click(screen.getByRole('button', { name: /^restore$/i }))

    await waitFor(() => {
      expect(restoredUrl).toBe('/api/projects/p-restore-id/restore')
    })
  })

  it('"Members" button opens members panel', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /members of my project/i })).toBeInTheDocument()
    })
  })

  it('members panel shows user members with type badge', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () =>
        HttpResponse.json([
          makeProjectMember({ id: 'pm1', member_type: 'user', member_id: 'user-uuid-1' }),
        ])
      ),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'user-uuid-1', email: 'proj-member@test.com' })])
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByText('proj-member@test.com')).toBeInTheDocument()
      // Badge text 'User' appears in both the dropdown and the badge span
      expect(screen.getAllByText('User').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('members panel shows group members with type badge', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () =>
        HttpResponse.json([
          makeProjectMember({
            id: 'pm1',
            member_type: 'group',
            member_id: 'group-uuid-1',
          }),
        ])
      ),
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'group-uuid-1', name: 'Research Lab' })])
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByText('Research Lab')).toBeInTheDocument()
      // Badge text 'Group' appears in both the dropdown and the badge span
      expect(screen.getAllByText('Group').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('members panel remove button calls DELETE', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () =>
        HttpResponse.json([
          makeProjectMember({ id: 'pm1', project_id: 'p1', member_id: 'user-uuid-1' }),
        ])
      ),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'user-uuid-1', email: 'member@test.com' })])
      )
    )

    let deletedUrl: string | undefined
    server.use(
      http.delete(`${TEST_BASE}/api/projects/:id/members/:memberId`, ({ request }) => {
        deletedUrl = new URL(request.url).pathname
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() => expect(screen.getByText('member@test.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^remove$/i }))

    await waitFor(() => {
      expect(deletedUrl).toBe('/api/projects/p1/members/user-uuid-1')
    })
  })

  it('"Show deleted" toggle sends include_deleted=true to API', async () => {
    setupAdmin()
    let receivedUrl: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/projects`, ({ request }) => {
        receivedUrl = request.url
        const deleted = new URL(request.url).searchParams.get('include_deleted')
        return HttpResponse.json(
          deleted === 'true' ? [makeProject({ deleted_at: '2024-01-01T00:00:00Z' })] : []
        )
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => screen.getByRole('checkbox'))

    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(receivedUrl).toContain('include_deleted=true')
    })
    expect(screen.getByText('Deleted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
  })

  it('members panel closes on Escape', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of my project/i })).toBeInTheDocument()
    )

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /members of my project/i })
      ).not.toBeInTheDocument()
    })
  })

  it('members panel shows group options when member type is switched to Group', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/groups`, () =>
        HttpResponse.json([makeGroup({ id: 'g1', name: 'Research Lab' })])
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of my project/i })).toBeInTheDocument()
    )
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'group')
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Research Lab' })).toBeInTheDocument()
    })
  })

  it('add member button calls addMember API when member is selected', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'u-proj', email: 'proj@test.com' })])
      ),
      http.post(`${TEST_BASE}/api/projects/:id/members`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeProjectMember(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of/i })).toBeInTheDocument()
    )
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'u-proj')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => {
      expect(postedBody).toMatchObject({ member_type: 'user', member_id: 'u-proj' })
    })
  })

  it('shows error when create fails', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json({ detail: 'Project already exists' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    const [nameInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'Duplicate')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/project already exists/i)).toBeInTheDocument()
    })
  })

  it('create form shows saving state while mutation is pending', async () => {
    setupAdmin()
    server.use(
      http.post(`${TEST_BASE}/api/projects`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json(makeProject(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    const [nameInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'Slow Project')
    user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })
  })

  it('handleAdd guard: clicking disabled Add button does not trigger mutation', async () => {
    setupAdmin()
    let mutationCalled = false
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([])),
      http.post(`${TEST_BASE}/api/projects/:id/members`, () => {
        mutationCalled = true
        return HttpResponse.json(makeProjectMember(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
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

  it('members panel shows member_id when user is not in users list', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () =>
        HttpResponse.json([
          makeProjectMember({ id: 'pm1', member_type: 'user', member_id: 'ghost-user-id' }),
        ])
      ),
      http.get(`${TEST_BASE}/api/admin/users`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByText('ghost-user-id')).toBeInTheDocument()
    })
  })

  it('members panel shows member_id when group is not in groups list', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () =>
        HttpResponse.json([
          makeProjectMember({ id: 'pm1', member_type: 'group', member_id: 'ghost-group-id' }),
        ])
      ),
      http.get(`${TEST_BASE}/api/groups`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))

    await waitFor(() => {
      expect(screen.getByText('ghost-group-id')).toBeInTheDocument()
    })
  })

  it('members panel shows error when add member fails', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([])),
      http.get(`${TEST_BASE}/api/admin/users`, () =>
        HttpResponse.json([makeUser({ id: 'u-fail', email: 'fail@test.com' })])
      ),
      http.post(`${TEST_BASE}/api/projects/:id/members`, () =>
        HttpResponse.json({ detail: 'Member already exists' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of/i })).toBeInTheDocument()
    )
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'u-fail')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(screen.getByText(/member already exists/i)).toBeInTheDocument()
    })
  })

  it('description field onChange updates form value and is submitted', async () => {
    setupAdmin()
    let postedBody: unknown
    server.use(
      http.post(`${TEST_BASE}/api/projects`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json(makeProject(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => screen.getByRole('button', { name: /new project/i }))
    await user.click(screen.getByRole('button', { name: /new project/i }))

    const [nameInput, descInput] = screen.getAllByRole('textbox')
    await user.type(nameInput, 'My Project')
    await user.type(descInput, 'A test description')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(postedBody).toMatchObject({ name: 'My Project', description: 'A test description' })
    })
  })

  it('shows project description when non-null', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ description: 'Proteomics project' })])
      )
    )

    renderWithProviders(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Proteomics project')).toBeInTheDocument()
    })
  })

  it('MembersPanel Escape key handler closes panel', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/projects`, () =>
        HttpResponse.json([makeProject({ id: 'p1', name: 'My Project' })])
      ),
      http.get(`${TEST_BASE}/api/projects/:id/members`, () => HttpResponse.json([]))
    )

    const { user } = renderWithProviders(<Projects />)
    await waitFor(() => expect(screen.getByText('My Project')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^members$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /members of my project/i })).toBeInTheDocument()
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /members of my project/i })
      ).not.toBeInTheDocument()
    })
  })
})
