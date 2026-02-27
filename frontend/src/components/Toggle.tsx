interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  id?: string
}

export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <span className="text-sm text-sw-fg-muted group-hover:text-sw-fg transition-colors">
        {label}
      </span>
      <div className="relative w-9 h-5">
        <input
          id={id}
          type="checkbox"
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer m-0"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors duration-200 ${
            checked ? 'bg-sw-brand' : 'bg-sw-border'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 pointer-events-none ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </label>
  )
}
