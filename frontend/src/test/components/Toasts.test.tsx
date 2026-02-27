import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/contexts/ToastProvider'
import { useToast } from '@/hooks/useToast'
import { Toasts } from '@/components/Toasts'

function ToastTrigger({ message, type }: { message: string; type?: 'success' | 'error' | 'info' }) {
  const { showToast } = useToast()
  return (
    <button onClick={() => showToast(message, type)} data-testid="trigger">
      Show Toast
    </button>
  )
}

function renderWithToast(message: string, type?: 'success' | 'error' | 'info') {
  return render(
    <ToastProvider>
      <ToastTrigger message={message} type={type} />
      <Toasts />
    </ToastProvider>
  )
}

describe('Toasts', () => {
  it('renders nothing when there are no toasts', () => {
    render(
      <ToastProvider>
        <Toasts />
      </ToastProvider>
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a success toast with correct styling', async () => {
    const user = userEvent.setup()
    renderWithToast('Saved successfully!', 'success')

    await user.click(screen.getByTestId('trigger'))

    const toast = await screen.findByRole('alert')
    expect(toast).toHaveTextContent('Saved successfully!')
    expect(toast).toHaveClass('bg-sw-ok-bg')
  })

  it('shows an error toast with correct styling', async () => {
    const user = userEvent.setup()
    renderWithToast('Something went wrong', 'error')

    await user.click(screen.getByTestId('trigger'))

    const toast = await screen.findByRole('alert')
    expect(toast).toHaveTextContent('Something went wrong')
    expect(toast).toHaveClass('bg-sw-err-bg')
  })

  it('shows an info toast (default type) with neutral styling', async () => {
    const user = userEvent.setup()
    renderWithToast('Just FYI', 'info')

    await user.click(screen.getByTestId('trigger'))

    const toast = await screen.findByRole('alert')
    expect(toast).toHaveTextContent('Just FYI')
    expect(toast).toHaveClass('bg-sw-surface')
  })

  it('dismiss button removes one toast while keeping others', async () => {
    // Renders 2 toasts so the filter callback covers both true (keep) and false (remove) branches
    function MultiTrigger() {
      const { showToast } = useToast()
      return (
        <>
          <button onClick={() => showToast('First toast', 'success')} data-testid="t1">
            First
          </button>
          <button onClick={() => showToast('Second toast', 'error')} data-testid="t2">
            Second
          </button>
        </>
      )
    }
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <MultiTrigger />
        <Toasts />
      </ToastProvider>
    )

    await user.click(screen.getByTestId('t1'))
    await user.click(screen.getByTestId('t2'))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)

    // Dismiss only the first toast — the filter covers both true (2nd kept) and false (1st removed)
    const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i })
    await user.click(dismissButtons[0])

    // Toast fades out over 500ms before being removed from DOM
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1), { timeout: 1000 })
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Second toast')
  })

  it('useToast throws when used outside ToastProvider', () => {
    function Bad() {
      useToast()
      return null
    }
    expect(() => render(<Bad />)).toThrow('useToast must be used within ToastProvider')
  })

  it('showToast without type defaults to info styling', async () => {
    function NoTypeTrigger() {
      const { showToast } = useToast()
      return (
        <button onClick={() => showToast('default type toast')} data-testid="trigger">
          Show
        </button>
      )
    }
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <NoTypeTrigger />
        <Toasts />
      </ToastProvider>
    )

    await user.click(screen.getByTestId('trigger'))

    const toast = await screen.findByRole('alert')
    expect(toast).toHaveClass('bg-sw-surface')
  })
})
