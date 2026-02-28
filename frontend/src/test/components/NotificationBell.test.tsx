import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeNotification } from '@/mocks/handlers'
import { NotificationBell } from '@/components/NotificationBell'

function setupAuth() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

describe('NotificationBell', () => {
  it('renders bell button', async () => {
    setupAuth()
    renderWithProviders(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    })
  })

  it('shows no badge when unread count is 0', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications/unread-count`, () => HttpResponse.json({ count: 0 }))
    )
    renderWithProviders(<NotificationBell />)
    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  it('shows badge with unread count', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications/unread-count`, () => HttpResponse.json({ count: 3 }))
    )
    renderWithProviders(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('shows 9+ badge when unread count exceeds 9', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications/unread-count`, () =>
        HttpResponse.json({ count: 15 })
      )
    )
    renderWithProviders(<NotificationBell />)
    await waitFor(() => {
      expect(screen.getByText('9+')).toBeInTheDocument()
    })
  })

  it('opens dropdown when clicked', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/notifications`, () => HttpResponse.json([])))
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })
  })

  it('shows "No notifications" when list is empty', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/notifications`, () => HttpResponse.json([])))
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
    })
  })

  it('renders notification items in dropdown', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications`, () =>
        HttpResponse.json([
          makeNotification({ title: 'New Request', message: 'Someone submitted a request.' }),
        ])
      )
    )
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.getByText('New Request')).toBeInTheDocument()
      expect(screen.getByText('Someone submitted a request.')).toBeInTheDocument()
    })
  })

  it('shows "Mark read" button for unread notifications', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications`, () =>
        HttpResponse.json([makeNotification({ read: false })])
      )
    )
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark as read/i })).toBeInTheDocument()
    })
  })

  it('does not show "Mark read" button for read notifications', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications`, () =>
        HttpResponse.json([makeNotification({ read: true })])
      )
    )
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mark as read/i })).not.toBeInTheDocument()
    })
  })

  it('shows "Mark all read" button when there are unread notifications', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications/unread-count`, () =>
        HttpResponse.json({ count: 2 })
      ),
      http.get(`${TEST_BASE}/api/notifications`, () =>
        HttpResponse.json([
          makeNotification({ id: 'n1', read: false }),
          makeNotification({ id: 'n2', read: false }),
        ])
      )
    )
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument()
    })
  })

  it('closes dropdown when clicked again', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/notifications`, () => HttpResponse.json([])))
    const { user } = renderWithProviders(<NotificationBell />)
    const bellButton = screen.getByRole('button', { name: /notifications/i })
    await user.click(bellButton)
    await waitFor(() => screen.getByText('Notifications'))
    await user.click(bellButton)
    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    })
  })

  it('shows dismiss button for each notification', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications`, () =>
        HttpResponse.json([makeNotification({ read: false })])
      )
    )
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    })
  })

  it('shows dismiss button for read notifications too', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/notifications`, () =>
        HttpResponse.json([
          makeNotification({ id: 'n1', read: false }),
          makeNotification({ id: 'n2', read: true }),
        ])
      )
    )
    const { user } = renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await waitFor(() => {
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i })
      expect(dismissButtons).toHaveLength(2)
    })
  })
})
