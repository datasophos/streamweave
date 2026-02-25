import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '@/mocks/server'
import axios from 'axios'
import { apiClient } from '@/api/client'

// In jsdom, axios picks the XHR adapter which MSW's node server can't cleanly intercept.
// Force the Node.js HTTP adapter so MSW intercepts at the http module level.
axios.defaults.adapter = 'http'
apiClient.defaults.adapter = 'http'
apiClient.defaults.baseURL = 'http://localhost'

// Node 25 ships a native localStorage that conflicts with jsdom's.
// Stub it with a reliable in-memory implementation used by all tests.
function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

const localStorageMock = makeLocalStorageMock()
vi.stubGlobal('localStorage', localStorageMock)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorageMock.clear()
})
afterAll(() => server.close())

// Stub window.location — jsdom does not support navigation
Object.defineProperty(window, 'location', {
  value: { href: '', pathname: '/login', assign: vi.fn() },
  writable: true,
})

// Stub window.confirm — used by delete buttons (default: user confirms)
window.confirm = vi.fn(() => true)
