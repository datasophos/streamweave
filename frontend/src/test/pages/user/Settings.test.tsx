import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeAdminUser } from '@/mocks/handlers'
import { Settings } from '@/pages/user/Settings'

function setupUser() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

function setupAdmin() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeAdminUser())))
}

describe('Settings page', () => {
  // --- Layout & tabs ---

  it('renders Settings heading', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders Profile and Preferences tabs', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preferences' })).toBeInTheDocument()
  })

  it('Profile tab is active by default', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByText('Account Info')).toBeInTheDocument()
  })

  it('clicking Preferences tab shows preferences section', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))
    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument()
      expect(screen.getByText('Date Format')).toBeInTheDocument()
      expect(screen.getByText('Items Per Page')).toBeInTheDocument()
    })
  })

  it('clicking Profile tab returns to profile section', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))
    await waitFor(() => expect(screen.getByText('Theme')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Profile' }))
    await waitFor(() => expect(screen.getByText('Account Info')).toBeInTheDocument())
  })

  // --- Profile section: account info ---

  it('shows user email in account info', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    await waitFor(() => {
      expect(screen.getByText('user@test.com')).toBeInTheDocument()
    })
  })

  it('shows User role badge for non-admin', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    await waitFor(() => {
      expect(screen.getByText('User')).toBeInTheDocument()
    })
  })

  it('shows Administrator badge for admin user', async () => {
    setupAdmin()
    renderWithProviders(<Settings />)
    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument()
    })
  })

  it('shows verified status for verified user', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument()
    })
  })

  it('shows not-verified status for unverified user', async () => {
    setupAuthToken()
    server.use(
      http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser({ is_verified: false })))
    )
    renderWithProviders(<Settings />)
    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument()
    })
  })

  it('shows account ID', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    await waitFor(() => {
      expect(screen.getByText('user-uuid-1')).toBeInTheDocument()
    })
  })

  // --- Profile section: change email ---

  it('renders Change Email section', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByText('Change Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('New email address')).toBeInTheDocument()
  })

  it('Update Email button is disabled when input is empty', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByRole('button', { name: 'Update Email' })).toBeDisabled()
  })

  it('Update Email button enables when input has value', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New email address'), 'new@test.com')
    expect(screen.getByRole('button', { name: 'Update Email' })).toBeEnabled()
  })

  it('submits PATCH /users/me with new email and shows success', async () => {
    setupUser()
    let patchBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/users/me`, async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json(makeUser({ email: 'new@test.com' }))
      })
    )

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New email address'), 'new@test.com')
    await user.click(screen.getByRole('button', { name: 'Update Email' }))

    await waitFor(() => {
      expect(screen.getByText('Email updated successfully.')).toBeInTheDocument()
    })
    expect(patchBody).toEqual({ email: 'new@test.com' })
  })

  it('shows error message when email update fails', async () => {
    setupUser()
    server.use(
      http.patch(`${TEST_BASE}/users/me`, () =>
        HttpResponse.json({ detail: 'Email already in use.' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New email address'), 'taken@test.com')
    await user.click(screen.getByRole('button', { name: 'Update Email' }))

    await waitFor(() => {
      expect(screen.getByText('Email already in use.')).toBeInTheDocument()
    })
  })

  it('shows fallback error message when email update fails without detail', async () => {
    setupUser()
    server.use(http.patch(`${TEST_BASE}/users/me`, () => new HttpResponse(null, { status: 500 })))

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New email address'), 'new@test.com')
    await user.click(screen.getByRole('button', { name: 'Update Email' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to update email.')).toBeInTheDocument()
    })
  })

  it('clears email input after successful update', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    const input = screen.getByPlaceholderText('New email address') as HTMLInputElement
    await user.type(input, 'new@test.com')
    await user.click(screen.getByRole('button', { name: 'Update Email' }))

    await waitFor(() => {
      expect(screen.getByText('Email updated successfully.')).toBeInTheDocument()
    })
    expect(input.value).toBe('')
  })

  it('submits email update when Enter is pressed in the input', async () => {
    setupUser()
    let called = false
    server.use(
      http.patch(`${TEST_BASE}/users/me`, async () => {
        called = true
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Settings />)
    const input = screen.getByPlaceholderText('New email address')
    await user.type(input, 'new@test.com{Enter}')

    await waitFor(() => expect(called).toBe(true))
  })

  it('Enter on empty email input does not submit', async () => {
    setupUser()
    let called = false
    server.use(
      http.patch(`${TEST_BASE}/users/me`, async () => {
        called = true
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Settings />)
    const input = screen.getByPlaceholderText('New email address')
    await user.type(input, '{Enter}')

    // Give any async work a chance to run
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })

  // --- Profile section: change password ---

  it('renders Change Password section', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByText('Change Password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument()
  })

  it('Update Password button is disabled when new password is empty', async () => {
    setupUser()
    renderWithProviders(<Settings />)
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeDisabled()
  })

  it('Enter on confirm-password field does nothing when new password is empty', async () => {
    setupUser()
    let called = false
    server.use(
      http.patch(`${TEST_BASE}/users/me`, async () => {
        called = true
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('Confirm new password'), '{Enter}')

    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })

  it('Enter on confirm-password field submits the form', async () => {
    setupUser()
    let called = false
    server.use(
      http.patch(`${TEST_BASE}/users/me`, async () => {
        called = true
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New password'), 'newpass123')
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'newpass123{Enter}')

    await waitFor(() => expect(called).toBe(true))
  })

  it('shows error when passwords do not match', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New password'), 'secret123')
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    })
  })

  it('submits PATCH /users/me with new password and shows success', async () => {
    setupUser()
    let patchBody: unknown
    server.use(
      http.patch(`${TEST_BASE}/users/me`, async ({ request }) => {
        patchBody = await request.json()
        return HttpResponse.json(makeUser())
      })
    )

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New password'), 'newpass123')
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password updated successfully.')).toBeInTheDocument()
    })
    expect(patchBody).toEqual({ password: 'newpass123' })
  })

  it('shows error message when password update fails', async () => {
    setupUser()
    server.use(
      http.patch(`${TEST_BASE}/users/me`, () =>
        HttpResponse.json({ detail: 'Password too short.' }, { status: 400 })
      )
    )

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New password'), 'abc')
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password too short.')).toBeInTheDocument()
    })
  })

  it('shows fallback error message when password update fails without detail', async () => {
    setupUser()
    server.use(http.patch(`${TEST_BASE}/users/me`, () => new HttpResponse(null, { status: 500 })))

    const { user } = renderWithProviders(<Settings />)
    await user.type(screen.getByPlaceholderText('New password'), 'newpass123')
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to update password.')).toBeInTheDocument()
    })
  })

  it('clears password fields after successful update', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    const newPw = screen.getByPlaceholderText('New password') as HTMLInputElement
    const confirmPw = screen.getByPlaceholderText('Confirm new password') as HTMLInputElement

    await user.type(newPw, 'newpass123')
    await user.type(confirmPw, 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password updated successfully.')).toBeInTheDocument()
    })
    expect(newPw.value).toBe('')
    expect(confirmPw.value).toBe('')
  })

  // --- Preferences section ---

  it('renders theme toggle with Light, Dark, System options', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument()
    })
  })

  it('renders date format toggle with Relative and Absolute options', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Relative' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Absolute' })).toBeInTheDocument()
    })
  })

  it('renders items per page toggle with 10, 25, 50 options', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '25' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument()
    })
  })

  it('clicking Dark theme saves to localStorage', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))
    await waitFor(() => screen.getByRole('button', { name: 'Dark' }))

    await user.click(screen.getByRole('button', { name: 'Dark' }))

    const stored = JSON.parse(localStorage.getItem('sw_preferences') ?? '{}')
    expect(stored.theme).toBe('dark')
  })

  it('clicking 50 items per page saves to localStorage', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))
    await waitFor(() => screen.getByRole('button', { name: '50' }))

    await user.click(screen.getByRole('button', { name: '50' }))

    const stored = JSON.parse(localStorage.getItem('sw_preferences') ?? '{}')
    expect(stored.itemsPerPage).toBe(50)
  })

  it('shows date format example for absolute mode', async () => {
    setupUser()
    const { user } = renderWithProviders(<Settings />)
    await user.click(screen.getByRole('button', { name: 'Preferences' }))
    await waitFor(() => screen.getByRole('button', { name: 'Absolute' }))

    await user.click(screen.getByRole('button', { name: 'Absolute' }))

    await waitFor(() => {
      expect(screen.getByText(/Example:/)).toBeInTheDocument()
    })
  })
})
