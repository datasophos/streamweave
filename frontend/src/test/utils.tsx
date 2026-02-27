import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { Toasts } from '@/components/Toasts'
import type { ReactNode } from 'react'
import '@/i18n/config'

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps
}

export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function renderWithProviders(
  ui: ReactNode,
  { routerProps, ...options }: RenderWithProvidersOptions = {}
) {
  const queryClient = makeTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <PreferencesProvider>
          <ToastProvider>
            <MemoryRouter {...routerProps}>
              <AuthProvider>{children}</AuthProvider>
            </MemoryRouter>
            <Toasts />
          </ToastProvider>
        </PreferencesProvider>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
    user: userEvent.setup(),
  }
}

/** Set up localStorage token so AuthContext initializes as authenticated. */
export function setupAuthToken() {
  localStorage.setItem('access_token', 'test-token')
}

// Re-export everything so tests only import from one place
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
export { userEvent }
