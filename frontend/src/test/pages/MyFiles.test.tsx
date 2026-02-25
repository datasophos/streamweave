import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, setupAuthToken } from '@/test/utils'
import { server } from '@/mocks/server'
import { TEST_BASE, makeUser, makeFileRecord, makeInstrument } from '@/mocks/handlers'
import { MyFiles } from '@/pages/user/MyFiles'

function setupAuth() {
  setupAuthToken()
  server.use(http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())))
}

describe('MyFiles', () => {
  it('renders file table after loading', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/files`, () =>
        HttpResponse.json([makeFileRecord({ filename: 'spectrum.hdf5' })])
      )
    )

    renderWithProviders(<MyFiles />)

    await waitFor(() => {
      expect(screen.getByText('spectrum.hdf5')).toBeInTheDocument()
    })
  })

  it('shows "No files discovered yet." when data is empty', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/files`, () => HttpResponse.json([])))

    renderWithProviders(<MyFiles />)

    await waitFor(() => {
      expect(screen.getByText(/no files discovered yet/i)).toBeInTheDocument()
    })
  })

  it('shows loading spinner while fetching', async () => {
    setupAuth()
    server.use(http.get(`${TEST_BASE}/api/files`, () => new Promise(() => {})))

    renderWithProviders(<MyFiles />)

    expect(screen.getByText(/loading files/i)).toBeInTheDocument()
  })

  it('filters rows by filename via search input', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/files`, () =>
        HttpResponse.json([
          makeFileRecord({
            id: 'f1',
            filename: 'alpha.raw',
            source_path: '/data/alpha.raw',
            persistent_id: 'ark:/1/aaa',
          }),
          makeFileRecord({
            id: 'f2',
            filename: 'beta.raw',
            source_path: '/data/beta.raw',
            persistent_id: 'ark:/1/bbb',
          }),
          makeFileRecord({
            id: 'f3',
            filename: 'gamma.raw',
            source_path: '/data/gamma.raw',
            persistent_id: 'ark:/1/ggg',
          }),
        ])
      )
    )

    const { user } = renderWithProviders(<MyFiles />)

    await waitFor(() => expect(screen.getByText('alpha.raw')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/search/i), 'beta')

    expect(screen.queryByText('alpha.raw')).not.toBeInTheDocument()
    expect(screen.getByText('beta.raw')).toBeInTheDocument()
    expect(screen.queryByText('gamma.raw')).not.toBeInTheDocument()
  })

  it('filters rows by persistent_id via search input', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/files`, () =>
        HttpResponse.json([
          makeFileRecord({
            id: 'f1',
            filename: 'x.raw',
            source_path: '/x.raw',
            persistent_id: 'ark:/99999/fk4unique',
          }),
          makeFileRecord({
            id: 'f2',
            filename: 'y.raw',
            source_path: '/y.raw',
            persistent_id: 'ark:/99999/fk4other',
          }),
        ])
      )
    )

    const { user } = renderWithProviders(<MyFiles />)
    await waitFor(() => expect(screen.getByText('x.raw')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/search/i), 'unique')

    expect(screen.getByText('x.raw')).toBeInTheDocument()
    expect(screen.queryByText('y.raw')).not.toBeInTheDocument()
  })

  it('shows "No files match your filters." when search yields no results', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/files`, () =>
        HttpResponse.json([makeFileRecord({ filename: 'sample.raw' })])
      )
    )

    const { user } = renderWithProviders(<MyFiles />)
    await waitFor(() => expect(screen.getByText('sample.raw')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/search/i), 'zzz-no-match')

    expect(screen.getByText(/no files match your filters/i)).toBeInTheDocument()
  })

  it('instrument filter sends instrument_id param to API', async () => {
    setupAuth()
    server.use(
      http.get(`${TEST_BASE}/api/instruments`, () =>
        HttpResponse.json([makeInstrument({ id: 'inst-abc', name: 'NMR' })])
      )
    )

    let capturedSearch: string | undefined
    server.use(
      http.get(`${TEST_BASE}/api/files`, ({ request }) => {
        capturedSearch = new URL(request.url).search
        return HttpResponse.json([])
      })
    )

    const { user } = renderWithProviders(<MyFiles />)

    // Wait for instrument options to load
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'NMR' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: '' }), 'inst-abc')

    await waitFor(() => {
      expect(capturedSearch).toContain('instrument_id=inst-abc')
    })
  })
})
