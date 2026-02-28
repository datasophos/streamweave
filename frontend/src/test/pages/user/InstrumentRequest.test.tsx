import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeInstrumentRequest } from '@/mocks/handlers'
import { InstrumentRequest } from '@/pages/user/InstrumentRequest'

function setupAuth() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

describe('InstrumentRequest page', () => {
  it('renders the My Requests list page', async () => {
    setupAuth()
    renderWithProviders(<InstrumentRequest />)
    expect(screen.getByText('My Requests')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /request instrument/i })).toBeInTheDocument()
  })

  it('shows existing requests in table', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ name: 'Bruker NMR', status: 'pending' })])
      )
    )
    renderWithProviders(<InstrumentRequest />)
    await waitFor(() => {
      expect(screen.getByText('Bruker NMR')).toBeInTheDocument()
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows admin notes icon when notes are present', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([
          makeInstrumentRequest({ status: 'approved', admin_notes: 'Looks good, deploying soon.' }),
        ])
      )
    )
    renderWithProviders(<InstrumentRequest />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view admin notes/i })).toBeInTheDocument()
    })
  })

  it('opens detail modal with admin notes when icon is clicked', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([
          makeInstrumentRequest({
            name: 'Bruker NMR',
            status: 'approved',
            admin_notes: 'Looks good, deploying soon.',
          }),
        ])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequest />)
    await waitFor(() => screen.getByRole('button', { name: /view admin notes/i }))
    await user.click(screen.getByRole('button', { name: /view admin notes/i }))
    await waitFor(() => {
      expect(screen.getByText('Looks good, deploying soon.')).toBeInTheDocument()
      expect(screen.getByText('Admin Notes')).toBeInTheDocument()
    })
  })

  it('closes detail modal with Escape key', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ status: 'approved', admin_notes: 'Great!' })])
      )
    )
    const { user } = renderWithProviders(<InstrumentRequest />)
    await waitFor(() => screen.getByRole('button', { name: /view admin notes/i }))
    await user.click(screen.getByRole('button', { name: /view admin notes/i }))
    await waitFor(() => screen.getByText('Great!'))
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Great!')).not.toBeInTheDocument()
    })
  })

  it('does not show admin notes icon when notes are absent', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json([makeInstrumentRequest({ status: 'pending', admin_notes: null })])
      )
    )
    renderWithProviders(<InstrumentRequest />)
    await waitFor(() => screen.getByText('Bruker NMR'))
    expect(screen.queryByRole('button', { name: /view admin notes/i })).not.toBeInTheDocument()
  })

  it('shows empty state when no requests', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/instrument-requests`, () => HttpResponse.json([])))
    renderWithProviders(<InstrumentRequest />)
    await waitFor(() => {
      expect(screen.getByText(/no requests submitted yet/i)).toBeInTheDocument()
    })
  })

  it('opens form modal when Request Instrument is clicked', async () => {
    setupAuth()
    const { user } = renderWithProviders(<InstrumentRequest />)
    await user.click(screen.getByRole('button', { name: /request instrument/i }))
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument()
  })

  it('shows success state in modal after form submission', async () => {
    setupAuth()
    server.use(
      http.post(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json(makeInstrumentRequest({ name: 'My Instrument' }), { status: 201 })
      )
    )

    const { user } = renderWithProviders(<InstrumentRequest />)
    await user.click(screen.getByRole('button', { name: /request instrument/i }))

    await user.type(screen.getByPlaceholderText(/TEM Microscope/i), 'My Instrument')
    await user.type(screen.getByPlaceholderText(/Building A/i), 'Lab 101')
    await user.selectOptions(screen.getByRole('combobox'), 'daily')
    await user.type(
      screen.getByPlaceholderText(/why does this instrument/i),
      'We need it for science.'
    )

    await user.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => {
      expect(screen.getByText('Request Submitted')).toBeInTheDocument()
      expect(screen.getByText(/My Instrument/)).toBeInTheDocument()
    })
  })

  it('"Submit Another Request" resets the form in the modal', async () => {
    setupAuth()
    server.use(
      http.post(`${TEST_BASE}/api/instrument-requests`, () =>
        HttpResponse.json(makeInstrumentRequest({ name: 'Test Instrument' }), { status: 201 })
      )
    )

    const { user } = renderWithProviders(<InstrumentRequest />)
    await user.click(screen.getByRole('button', { name: /request instrument/i }))

    await user.type(screen.getByPlaceholderText(/TEM Microscope/i), 'Test Instrument')
    await user.type(screen.getByPlaceholderText(/Building A/i), 'Room 202')
    await user.selectOptions(screen.getByRole('combobox'), 'weekly')
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
    await user.click(screen.getByRole('button', { name: /request instrument/i }))

    const descTextarea = screen.getByPlaceholderText(/describe the instrument/i)
    await user.type(descTextarea, 'A mass spectrometer')
    expect((descTextarea as HTMLTextAreaElement).value).toBe('A mass spectrometer')
  })

  it('shows error message when submission fails', async () => {
    setupAuth()
    server.use(
      http.post(
        `${TEST_BASE}/api/instrument-requests`,
        () => new HttpResponse(null, { status: 500 })
      )
    )

    const { user } = renderWithProviders(<InstrumentRequest />)
    await user.click(screen.getByRole('button', { name: /request instrument/i }))

    await user.type(screen.getByPlaceholderText(/TEM Microscope/i), 'Fail Instrument')
    await user.type(screen.getByPlaceholderText(/Building A/i), 'Lab 1')
    await user.selectOptions(screen.getByRole('combobox'), 'daily')
    await user.type(screen.getByPlaceholderText(/why does this instrument/i), 'Testing error.')

    await user.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to submit request/i)).toBeInTheDocument()
    })
  })

  it('closes request form modal with Escape key', async () => {
    setupAuth()
    const { user } = renderWithProviders(<InstrumentRequest />)
    await user.click(screen.getByRole('button', { name: /request instrument/i }))
    await waitFor(() => screen.getByRole('button', { name: /submit request/i }))
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /submit request/i })).not.toBeInTheDocument()
    })
  })

  it('button shows submitting state while pending', async () => {
    setupAuth()
    server.use(
      http.post(`${TEST_BASE}/api/instrument-requests`, async () => {
        await new Promise((r) => setTimeout(r, 200))
        return HttpResponse.json(makeInstrumentRequest(), { status: 201 })
      })
    )

    const { user } = renderWithProviders(<InstrumentRequest />)
    await user.click(screen.getByRole('button', { name: /request instrument/i }))

    await user.type(screen.getByPlaceholderText(/TEM Microscope/i), 'Pending Instrument')
    await user.type(screen.getByPlaceholderText(/Building A/i), 'Lab 2')
    await user.selectOptions(screen.getByRole('combobox'), 'daily')
    await user.type(screen.getByPlaceholderText(/why does this instrument/i), 'For science.')

    user.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    })
  })
})
