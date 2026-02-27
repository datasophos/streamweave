import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeAdminUser } from '@/mocks/handlers'
import { AuditLog } from '@/pages/admin/AuditLog'

interface AuditLogEntry {
  id: string
  created_at: string
  actor_email: string
  action: string
  entity_type: string
  entity_id: string
  changes: Record<string, { before: unknown; after: unknown }> | null
}

function makeAuditEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'entry-uuid-1',
    created_at: '2024-01-15T10:30:00Z',
    actor_email: 'admin@test.com',
    action: 'create',
    entity_type: 'instrument',
    entity_id: 'inst-uuid-1234-5678',
    changes: null,
    ...overrides,
  }
}

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('AuditLog admin page', () => {
  it('shows loading state initially', () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json([])
      })
    )

    renderWithProviders(<AuditLog />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders table headers', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([])))

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('When')).toBeInTheDocument()
      expect(screen.getByText('Actor')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
      expect(screen.getByText('Entity')).toBeInTheDocument()
      expect(screen.getByText('Entity ID')).toBeInTheDocument()
      expect(screen.getByText('Changes')).toBeInTheDocument()
    })
  })

  it('shows "No audit entries found." when list is empty', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([])))

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText(/no audit entries found/i)).toBeInTheDocument()
    })
  })

  it('shows "Failed to load audit log." on error', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () => new HttpResponse(null, { status: 500 }))
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load audit log/i)).toBeInTheDocument()
    })
  })

  it('renders audit log entries in the table', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([
          makeAuditEntry({
            actor_email: 'alice@test.com',
            action: 'create',
            entity_type: 'instrument',
          }),
        ])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeInTheDocument()
      expect(screen.getAllByText('Create').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows "—" in Changes column when changes is null', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([makeAuditEntry({ changes: null })])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('shows "N fields ▼" button when changes are present', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([
          makeAuditEntry({
            changes: {
              name: { before: 'Old Name', after: 'New Name' },
              enabled: { before: true, after: false },
            },
          }),
        ])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /2 fields/i })).toBeInTheDocument()
    })
  })

  it('expands changes when "N fields" button is clicked', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([
          makeAuditEntry({
            changes: {
              name: { before: 'Old Name', after: 'New Name' },
            },
          }),
        ])
      )
    )

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByRole('button', { name: /1 field/i }))
    await user.click(screen.getByRole('button', { name: /1 field/i }))

    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument()
      expect(screen.getByText('New Name')).toBeInTheDocument()
    })
  })

  it('collapses changes when expanded button is clicked again', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([
          makeAuditEntry({
            changes: { name: { before: 'Old', after: 'New' } },
          }),
        ])
      )
    )

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByRole('button', { name: /1 field/i }))
    await user.click(screen.getByRole('button', { name: /1 field/i }))
    await waitFor(() => screen.getByText('Old'))

    // Click again to collapse
    await user.click(screen.getByRole('button', { name: /1 field/i }))

    await waitFor(() => {
      expect(screen.queryByText('Old')).not.toBeInTheDocument()
    })
  })

  it('renders entity_type with underscore replaced by space', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([makeAuditEntry({ entity_type: 'storage_location' })])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('storage location')).toBeInTheDocument()
    })
  })

  it('renders truncated entity_id', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([makeAuditEntry({ entity_id: 'inst-uuid-1234-5678' })])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      // entity_id is sliced to first 8 chars + ellipsis
      expect(screen.getByText('inst-uui…')).toBeInTheDocument()
    })
  })

  it('Previous button is disabled on first page', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([])))

    renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByRole('button', { name: /previous/i }))
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('Next button is disabled when fewer than 50 entries returned', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([makeAuditEntry()]))
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('Next button is enabled when 50 entries are returned', async () => {
    setupAdmin()
    const entries = Array.from({ length: 50 }, (_, i) => makeAuditEntry({ id: `entry-${i}` }))
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json(entries)))

    renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
  })

  it('clicking Next increments page number', async () => {
    setupAdmin()
    const entries = Array.from({ length: 50 }, (_, i) => makeAuditEntry({ id: `entry-${i}` }))
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json(entries)))

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByText('Page 1'))
    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeInTheDocument()
    })
  })

  it('clicking Previous decrements page number', async () => {
    setupAdmin()
    const entries = Array.from({ length: 50 }, (_, i) => makeAuditEntry({ id: `entry-${i}` }))
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json(entries)))

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByText('Page 1'))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText('Page 2'))

    await user.click(screen.getByRole('button', { name: /previous/i }))

    await waitFor(() => {
      expect(screen.getByText('Page 1')).toBeInTheDocument()
    })
  })

  it('shows Clear filters button when entity_type filter is set', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([])))

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getAllByRole('combobox'))

    const selects = screen.getAllByRole('combobox')
    // First combobox is entity_type
    await user.selectOptions(selects[0], 'instrument')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
    })
  })

  it('shows Clear filters button when action filter is set', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([])))

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getAllByRole('combobox'))

    const selects = screen.getAllByRole('combobox')
    // Second combobox is action
    await user.selectOptions(selects[1], 'create')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
    })
  })

  it('Clear filters button resets both filters', async () => {
    setupAdmin()
    server.use(http.get(`${TEST_BASE}/api/admin/audit-logs`, () => HttpResponse.json([])))

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getAllByRole('combobox'))
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'instrument')

    await waitFor(() => screen.getByRole('button', { name: /clear filters/i }))
    await user.click(screen.getByRole('button', { name: /clear filters/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
    })
  })

  it('filter sends query params to API', async () => {
    setupAdmin()
    let capturedParams: URLSearchParams | null = null
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, ({ request }) => {
        capturedParams = new URL(request.url).searchParams
        return HttpResponse.json([])
      })
    )

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getAllByRole('combobox'))
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'instrument')

    await waitFor(() => {
      expect(capturedParams?.get('entity_type')).toBe('instrument')
    })
  })

  it('renders "delete" action with correct label', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([makeAuditEntry({ action: 'delete' })])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  it('renders "restore" action with correct label', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([makeAuditEntry({ action: 'restore' })])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('Restore')).toBeInTheDocument()
    })
  })

  it('shows singular "field" label for single change', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([
          makeAuditEntry({
            changes: { name: { before: 'Old', after: 'New' } },
          }),
        ])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1 field ▼/i })).toBeInTheDocument()
    })
  })

  it('renders unknown action using raw action string as fallback', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([makeAuditEntry({ action: 'archive' })])
      )
    )

    renderWithProviders(<AuditLog />)

    await waitFor(() => {
      expect(screen.getByText('archive')).toBeInTheDocument()
    })
  })

  it('shows null before/after as "—" in expanded changes', async () => {
    setupAdmin()
    server.use(
      http.get(`${TEST_BASE}/api/admin/audit-logs`, () =>
        HttpResponse.json([
          makeAuditEntry({
            changes: { description: { before: null, after: null } },
          }),
        ])
      )
    )

    const { user } = renderWithProviders(<AuditLog />)

    await waitFor(() => screen.getByRole('button', { name: /1 field/i }))
    await user.click(screen.getByRole('button', { name: /1 field/i }))

    await waitFor(() => {
      // Two "—" elements: one for before, one for after
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(2)
    })
  })
})
