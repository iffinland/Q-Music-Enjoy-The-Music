import React from 'react'
import { cn } from '../../lib/utils'

type SpinnerProps = {
  size?: number
  className?: string
}

const Spinner: React.FC<SpinnerProps> = ({ size = 24, className }) => {
  const dimension = `${size}px`
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-sky-200/70 border-t-transparent',
        className
      )}
      style={{ width: dimension, height: dimension }}
      aria-label="Loading"
    />
  )
}

export default Spinner
