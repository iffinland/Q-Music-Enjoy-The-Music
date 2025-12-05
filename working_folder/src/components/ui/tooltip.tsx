import * as React from 'react'
import { cn } from '../../lib/utils'

export const Tooltip = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
  <span className="relative group inline-flex">
    <span className="inline-flex">{children}</span>
    <span
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100'
      )}
    >
      {content}
    </span>
  </span>
)
