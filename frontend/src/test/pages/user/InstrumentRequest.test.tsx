import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser } from '@/mocks/handlers'
import { InstrumentRequest } from '@/pages/user/InstrumentRequest'

function setupAuth() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

describe('InstrumentRequest page', () => {
  it('renders the request form', async () => {
    setupAuth()
    renderWithProviders(<InstrumentRequest />)

    expect(screen.getByText('Request Instrument Harvest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument()
  })

  it('shows success state after form submission', async () => {
    setupAuth()
    const { user } = renderWithProviders(<InstrumentRequest />)

    await user.type(screen.getByPlaceholderText(/TEM Microscope/i), 'My Instrument')
    await user.type(screen.getByPlaceholderText(/Building A/i), 'Lab 101')
    await user.type(screen.getByPlaceholderText(/your@email.edu/i), 'user@test.com')
    await user.type(
      screen.getByPlaceholderText(/why does this instrument/i),
      'We need it for science.'
    )

    await user.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => {
      expect(screen.getByText('Request Submitted')).toBeInTheDocument()
      expect(screen.getByText(/My Instrument/)).toBeInTheDocument()
      expect(screen.getByText(/user@test.com/)).toBeInTheDocument()
    })
  })

  it('"Submit Another Request" resets the form', async () => {
    setupAuth()
    const { user } = renderWithProviders(<InstrumentRequest />)

    await user.type(screen.getByPlaceholderText(/TEM Microscope/i), 'Test Instrument')
    await user.type(screen.getByPlaceholderText(/Building A/i), 'Room 202')
    await user.type(screen.getByPlaceholderText(/your@email.edu/i), 'test@test.com')
    await user.type(screen.getByPlaceholderText(/why does this instrument/i), 'Important research.')

    await user.click(screen.getByRole('button', { name: /submit request/i }))
    await waitFor(() => expect(screen.getByText('Request Submitted')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /submit another request/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument()
      expect(screen.queryByText('Request Submitted')).not.toBeInTheDocument()
    })
  })

  it('description textarea is optional and can be typed into', async () => {
    setupAuth()
    const { user } = renderWithProviders(<InstrumentRequest />)

    const descTextarea = screen.getByPlaceholderText(/describe the instrument/i)
    await user.type(descTextarea, 'A mass spectrometer')
    expect((descTextarea as HTMLTextAreaElement).value).toBe('A mass spectrometer')
  })
})
