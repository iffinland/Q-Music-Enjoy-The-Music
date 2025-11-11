import { twMerge } from 'tailwind-merge';

interface HomeActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  compact?: boolean;
}

const baseClasses =
  'relative inline-flex items-center justify-center rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-950/80';

export const HomeActionButton: React.FC<HomeActionButtonProps> = ({
  active = false,
  compact = true,
  className,
  children,
  ...rest
}) => {
  const sizeClasses = compact ? 'h-9 w-9' : 'h-10 w-10';
  const visual = active
    ? 'bg-sky-400/90 text-slate-900 border-sky-300 shadow-qm-soft hover:bg-sky-300'
    : 'bg-sky-900/40 text-sky-100/90 border-sky-800/60 hover:bg-sky-800/60 hover:text-white';

  return (
    <button
      type="button"
      className={twMerge(baseClasses, sizeClasses, visual, className)}
      {...rest}
    >
      {children}
    </button>
  );
};

export default HomeActionButton;
