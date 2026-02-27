import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from '@/components/Toggle'

describe('Toggle', () => {
  it('renders label text', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Show deleted" />)
    expect(screen.getByText('Show deleted')).toBeInTheDocument()
  })

  it('renders unchecked state (checked=false)', () => {
    render(<Toggle checked={false} onChange={() => {}} label="My Toggle" />)
    const input = screen.getByRole('checkbox', { name: 'My Toggle' })
    expect(input).not.toBeChecked()
  })

  it('renders checked state (checked=true)', () => {
    render(<Toggle checked={true} onChange={() => {}} label="My Toggle" />)
    const input = screen.getByRole('checkbox', { name: 'My Toggle' })
    expect(input).toBeChecked()
  })

  it('calls onChange when toggled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} label="My Toggle" />)
    await user.click(screen.getByRole('checkbox', { name: 'My Toggle' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('uses provided id for the input', () => {
    render(<Toggle checked={false} onChange={() => {}} label="My Toggle" id="custom-id" />)
    expect(screen.getByRole('checkbox', { name: 'My Toggle' })).toHaveAttribute('id', 'custom-id')
  })
})
