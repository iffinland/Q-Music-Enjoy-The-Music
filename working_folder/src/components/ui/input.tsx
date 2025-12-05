import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-sky-800/60 bg-sky-950/40 px-3 py-2 text-sm text-white ring-offset-sky-900 placeholder:text-sky-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
