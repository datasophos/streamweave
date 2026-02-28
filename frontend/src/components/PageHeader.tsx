import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, description, icon, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-sw-fg">
          {icon && <span className="text-sw-fg-muted">{icon}</span>}
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-sw-fg-muted">{description}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  )
}
