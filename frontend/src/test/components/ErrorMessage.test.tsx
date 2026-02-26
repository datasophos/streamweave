import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorMessage } from '@/components/ErrorMessage'
import '@/i18n/config'

describe('ErrorMessage', () => {
  it('shows detail from axios-style error response', () => {
    const error = {
      response: { data: { detail: 'Not found' } },
    }
    render(<ErrorMessage error={error} />)
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })

  it('shows error.message for plain Error objects', () => {
    const error = new Error('Network failure')
    render(<ErrorMessage error={error} />)
    expect(screen.getByText('Network failure')).toBeInTheDocument()
  })

  it('shows fallback when error has no detail or message', () => {
    const error = { response: { data: {} } }
    render(<ErrorMessage error={error} />)
    expect(screen.getByText('An error occurred.')).toBeInTheDocument()
  })

  it('shows custom fallback prop', () => {
    render(<ErrorMessage error={null} fallback="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows default fallback for HTTP errors without detail field', () => {
    // Axios error with response but no detail string — falls back to fallback prop
    const error = { response: { data: { detail: 42 } }, message: 'Request failed' }
    render(<ErrorMessage error={error} />)
    expect(screen.getByText('An error occurred.')).toBeInTheDocument()
  })
})
