import { forwardRef } from "react";
import { twMerge } from "tailwind-merge"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  type,
  disabled,
  ...props
}, ref) => {
  return (
    <input
      type={type}
      className={twMerge(
        `
        flex 
        w-full 
        rounded-xl 
        bg-qm-surface-200/80
        border
        border-qm-border
        px-4 
        py-3 
        text-sm 
        text-qm-ink
        placeholder:text-qm-ink-muted 
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-qm-primary
        focus-visible:ring-offset-2
        focus-visible:ring-offset-qm-surface
        transition
        file:border-0 
        file:bg-transparent 
        file:text-sm 
        file:font-medium 
        disabled:cursor-not-allowed 
        disabled:opacity-60
      `,
        disabled && 'pointer-events-none',
        className
      )}
      disabled={disabled}
      ref={ref}
      {...props}
    />
  )
});

Input.displayName = "Input";

export default Input
