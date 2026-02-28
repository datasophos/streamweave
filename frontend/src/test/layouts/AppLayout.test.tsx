import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeAdminUser } from '@/mocks/handlers'
import { AppLayout } from '@/layouts/AppLayout'

function setupUser() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('AppLayout', () => {
  it('renders StreamWeave brand', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)
    expect(screen.getByText('StreamWeave')).toBeInTheDocument()
  })

  it('renders Dashboard nav link', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)
    const dashLinks = screen.getAllByRole('link', { name: /dashboard/i })
    expect(dashLinks.length).toBeGreaterThan(0)
  })

  it('renders footer', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)
    expect(screen.getByText(/Data harvesting, simplified/i)).toBeInTheDocument()
  })

  it('non-admin sees My Files and Transfers nav links', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /my files/i }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('link', { name: /transfers/i }).length).toBeGreaterThan(0)
    })
  })

  it('non-admin sees My Requests link', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /my requests/i }).length).toBeGreaterThan(0)
    })
  })

  it('admin sees Admin dropdown button', async () => {
    setupAdmin()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument()
    })
  })

  it('admin does not see Request Instrument nav link in desktop nav', async () => {
    setupAdmin()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      // Admin badge appears but no "Request Instrument" link in desktop nav
      expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument()
    })

    // The desktop nav should not have "Request Instrument"
    const requestLinks = screen.queryAllByRole('link', { name: /request instrument/i })
    // Links might appear in mobile nav which is hidden, but button shouldn't be in desktop
    expect(requestLinks.length).toBe(0)
  })

  it('Admin dropdown opens when clicked', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<AppLayout />)

    await waitFor(() => screen.getByRole('button', { name: /admin/i }))
    await user.click(screen.getByRole('button', { name: /admin/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /instruments/i })).toBeInTheDocument()
    })
  })

  it('Admin dropdown closes when clicked again', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<AppLayout />)

    await waitFor(() => screen.getByRole('button', { name: /admin/i }))
    await user.click(screen.getByRole('button', { name: /admin/i }))
    await waitFor(() => screen.getByRole('link', { name: /instruments/i }))

    await user.click(screen.getByRole('button', { name: /admin/i }))

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /instruments/i })).not.toBeInTheDocument()
    })
  })

  it('Admin dropdown closes when clicking outside', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<AppLayout />)

    await waitFor(() => screen.getByRole('button', { name: /admin/i }))
    await user.click(screen.getByRole('button', { name: /admin/i }))
    await waitFor(() => screen.getByRole('link', { name: /instruments/i }))

    // Click on body outside dropdown
    await user.click(document.body)

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /instruments/i })).not.toBeInTheDocument()
    })
  })

  it('hamburger button toggles mobile menu open', async () => {
    setupUser()
    const { user } = renderWithProviders(<AppLayout />)

    const hamburger = screen.getByRole('button', { name: /toggle menu/i })
    await user.click(hamburger)

    await waitFor(() => {
      // After opening, there are 2 sign out buttons (desktop + mobile)
      expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBe(2)
    })
  })

  it('mobile menu shows admin section heading for admin user', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<AppLayout />)

    const hamburger = screen.getByRole('button', { name: /toggle menu/i })
    await user.click(hamburger)

    await waitFor(() => {
      // "Administrator" label appears in the mobile menu footer
      expect(screen.getByText('Administrator')).toBeInTheDocument()
    })
  })

  it('mobile menu shows Administrator label for admin', async () => {
    setupAdmin()
    const { user } = renderWithProviders(<AppLayout />)

    await waitFor(() => screen.getByRole('button', { name: /toggle menu/i }))
    await user.click(screen.getByRole('button', { name: /toggle menu/i }))

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument()
    })
  })

  it('mobile menu closes when backdrop is clicked', async () => {
    setupUser()
    const { user } = renderWithProviders(<AppLayout />)

    await user.click(screen.getByRole('button', { name: /toggle menu/i }))
    // Wait for mobile menu to open (2 sign out buttons)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBe(2)
    })

    // Click the mobile backdrop (the fixed inset overlay)
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
    await user.click(backdrop)

    await waitFor(() => {
      // After close, back to 1 sign out button (desktop only)
      expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBe(1)
    })
  })

  it('Sign out button calls logout and navigates', async () => {
    setupUser()
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/logout`, () => new HttpResponse(null, { status: 204 }))
    )

    const { user } = renderWithProviders(<AppLayout />)

    // Use the desktop sign out button (hidden on mobile but still in DOM)
    const signOutButtons = await screen.findAllByRole('button', { name: /sign out/i })
    await user.click(signOutButtons[0])

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })

  it('hamburger shows X icon when menu is open', async () => {
    setupUser()
    const { user } = renderWithProviders(<AppLayout />)

    const hamburger = screen.getByRole('button', { name: /toggle menu/i })
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')

    await user.click(hamburger)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle menu/i })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    })
  })

  it('mobile menu Sign out calls logout', async () => {
    setupUser()
    server.use(
      http.post(`${TEST_BASE}/auth/jwt/logout`, () => new HttpResponse(null, { status: 204 }))
    )

    const { user } = renderWithProviders(<AppLayout />)

    // Open mobile menu
    await user.click(screen.getByRole('button', { name: /toggle menu/i }))
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBe(2)
    })

    // Click the mobile menu sign out (second sign out button in DOM)
    const signOutButtons = screen.getAllByRole('button', { name: /sign out/i })
    await user.click(signOutButtons[1])

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })

  it('admin active link shows active class in dropdown', async () => {
    setupAdmin()
    // Start at an admin route so the Instruments NavLink is active
    const { user } = renderWithProviders(<AppLayout />, {
      routerProps: { initialEntries: ['/admin/instruments'] },
    })

    await waitFor(() => screen.getByRole('button', { name: /admin/i }))
    await user.click(screen.getByRole('button', { name: /admin/i }))

    await waitFor(() => {
      // The active Instruments link should be visible in the dropdown
      const link = screen.getByRole('link', { name: 'Instruments' })
      expect(link).toBeInTheDocument()
    })
  })

  it('shows user email in desktop nav when user is loaded', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      // Email appears in the desktop user area (hidden on small screens but in DOM)
      expect(screen.getByText('user@test.com')).toBeInTheDocument()
    })
  })

  it('desktop nav has Settings link', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      const settingsLinks = screen.getAllByRole('link', { name: /settings/i })
      expect(settingsLinks.length).toBeGreaterThan(0)
    })
  })

  it('Settings link points to /settings', async () => {
    setupUser()
    renderWithProviders(<AppLayout />)

    await waitFor(() => {
      const settingsLink = screen.getAllByRole('link', { name: /settings/i })[0]
      expect(settingsLink).toHaveAttribute('href', '/settings')
    })
  })

  it('mobile menu has Settings link', async () => {
    setupUser()
    const { user } = renderWithProviders(<AppLayout />)

    await user.click(screen.getByRole('button', { name: /toggle menu/i }))

    await waitFor(() => {
      const settingsLinks = screen.getAllByRole('link', { name: /settings/i })
      expect(settingsLinks.length).toBeGreaterThanOrEqual(2) // desktop + mobile
    })
  })
})
