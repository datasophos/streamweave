import { useState } from 'react'
import { Info } from 'lucide-react'

interface TooltipProps {
  /** Tooltip help text shown on hover */
  text: string
  /** Unique ID applied to the tooltip element */
  id: string
}

/**
 * Informational tooltip rendered as a small ⓘ icon.
 * Intended to be placed inside a <label> element; aria-hidden="true" on the
 * trigger prevents its text from polluting the label's accessible name.
 * The tooltip popup uses role="tooltip" so assistive tools can detect it.
 */
export function Tooltip({ text, id }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-flex items-center ml-1 flex-shrink-0">
      <span
        aria-hidden="true"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="text-sw-fg-faint hover:text-sw-fg-muted cursor-help"
      >
        <Info size={13} />
      </span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-56 rounded bg-sw-fg text-sw-bg text-xs px-2.5 py-1.5 shadow-lg pointer-events-none"
        >
          {text}
          <span
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-sw-fg"
          />
        </span>
      )}
    </span>
  )
}
