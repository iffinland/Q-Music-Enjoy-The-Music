import { forwardRef } from "react";
import { twMerge } from "tailwind-merge"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  className,
  disabled,
  ...props
}, ref) => {
  return (
    <textarea
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

Textarea.displayName = "Textarea";

export default Textarea;
