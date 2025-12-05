import * as React from 'react'
import { cn } from '../../lib/utils'

type TabsContextValue = { value: string; setValue: (val: string) => void }
const TabsContext = React.createContext<TabsContextValue | null>(null)

export interface TabsProps {
  defaultValue: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export const Tabs = ({ defaultValue, onValueChange, children, className }: TabsProps) => {
  const [value, setValue] = React.useState(defaultValue)

  const handleSetValue = (next: string) => {
    setValue(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ value, setValue: handleSetValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export const TabsList = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('inline-flex items-center gap-1 rounded-md bg-sky-900/60 p-1', className)}>{children}</div>
)

export const TabsTrigger = ({
  value,
  children
}: {
  value: string
  children: React.ReactNode
}) => {
  const ctx = React.useContext(TabsContext)
  const isActive = ctx?.value === value
  return (
    <button
      type="button"
      onClick={() => ctx?.setValue(value)}
      className={cn(
        'px-3 py-1.5 text-sm font-semibold rounded-md transition',
        isActive ? 'bg-sky-600 text-white' : 'text-sky-200 hover:bg-sky-800/60'
      )}
    >
      {children}
    </button>
  )
}

export const TabsContent = ({
  value,
  children,
  className
}: {
  value: string
  children: React.ReactNode
  className?: string
}) => {
  const ctx = React.useContext(TabsContext)
  if (ctx?.value !== value) return null
  return <div className={className}>{children}</div>
}
