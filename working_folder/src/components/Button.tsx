import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-qm-primary 
    text-[#04101e] 
    hover:bg-qm-primary-strong 
    shadow-qm-soft 
    border-transparent
  `,
  secondary: `
    bg-transparent 
    text-qm-ink 
    border border-qm-border 
    hover:border-qm-primary 
    hover:text-white 
    hover:bg-qm-primary-soft
  `,
  ghost: `
    bg-transparent 
    text-qm-ink-muted 
    border border-transparent 
    hover:bg-qm-surface-200 
    hover:text-qm-ink
  `,
  danger: `
    bg-qm-error/90 
    text-white 
    border border-transparent 
    hover:bg-qm-error
  `,
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  children,
  disabled,
  type = 'button',
  variant = 'primary',
  ...props
}, ref) => {
  return (
    <button
      type={type}
      className={twMerge(
        `
        inline-flex
        w-full
        items-center
        justify-center
        gap-2
        rounded-xl
        px-4
        py-3
        text-sm
        font-semibold
        tracking-wide
        transition
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-qm-primary
        focus-visible:ring-offset-2
        focus-visible:ring-offset-qm-surface
        disabled:cursor-not-allowed
        disabled:opacity-60
      `,
        variantClasses[variant],
        disabled && 'pointer-events-none',
        className
      )}
      disabled={disabled}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";

export default Button;
