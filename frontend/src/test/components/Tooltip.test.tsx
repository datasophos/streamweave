import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from '@/components/Tooltip'

describe('Tooltip', () => {
  it('renders an info icon', () => {
    const { container } = render(<Tooltip text="Help text here" id="tip-1" />)
    // The trigger span is aria-hidden; verify the SVG icon is present in the DOM
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('does not show tooltip text by default', () => {
    render(<Tooltip text="Help text here" id="tip-1" />)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip text on hover (mouseenter)', async () => {
    const user = userEvent.setup()
    const { container } = render(<Tooltip text="Help text here" id="tip-1" />)
    const trigger = container.querySelector('[aria-hidden="true"]') as Element
    await user.hover(trigger)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text here')
  })

  it('hides tooltip text on mouseleave', async () => {
    const user = userEvent.setup()
    const { container } = render(<Tooltip text="Help text here" id="tip-1" />)
    const trigger = container.querySelector('[aria-hidden="true"]') as Element
    await user.hover(trigger)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.unhover(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('applies the given id to the tooltip element when visible', async () => {
    const user = userEvent.setup()
    const { container } = render(<Tooltip text="Some help" id="my-unique-tip" />)
    const trigger = container.querySelector('[aria-hidden="true"]') as Element
    await user.hover(trigger)
    expect(screen.getByRole('tooltip')).toHaveAttribute('id', 'my-unique-tip')
  })

  it('does not affect the accessible name of an associated input', () => {
    render(
      <div>
        <label htmlFor="test-input">
          My Field
          <Tooltip text="Extra context" id="tip-test" />
        </label>
        <input id="test-input" />
      </div>
    )
    // The input's accessible name should be exactly "My Field" — the tooltip
    // trigger is aria-hidden so it must not pollute the label's accessible name.
    expect(screen.getByRole('textbox', { name: /^my field$/i })).toBeInTheDocument()
  })
})
