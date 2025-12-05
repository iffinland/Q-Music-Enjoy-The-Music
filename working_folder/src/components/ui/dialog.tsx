import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const DialogContext = React.createContext<{ open: boolean; setOpen: (value: boolean) => void } | null>(
  null
)

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const setOpen = React.useCallback(
    (value: boolean) => {
      onOpenChange(value)
    },
    [onOpenChange]
  )

  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>
}

export const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => {
  const ctx = React.useContext(DialogContext)
  return (
    <button
      ref={ref}
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        ctx?.setOpen(!ctx.open)
      }}
    >
      {children}
    </button>
  )
})
DialogTrigger.displayName = 'DialogTrigger'

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(DialogContext)
  if (!ctx?.open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        ref={ref}
        className={cn(
          'w-full max-w-lg rounded-xl border border-sky-800/70 bg-sky-950/90 p-5 shadow-2xl shadow-black/40',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  )
})
DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 space-y-1">{children}</div>
)

export const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold text-white">{children}</h2>
)

export const DialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-sky-200/80">{children}</p>
)
