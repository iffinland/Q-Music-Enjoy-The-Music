import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: number
  onValueChange?: (value: number) => void
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    return (
      <input
        type="range"
        ref={ref}
        value={value}
        onChange={(event) => onValueChange?.(Number(event.target.value))}
        min={min}
        max={max}
        step={step}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-sky-900/60 accent-sky-500',
          className
        )}
        {...props}
      />
    )
  }
)
Slider.displayName = 'Slider'
