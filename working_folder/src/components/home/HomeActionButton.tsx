import { twMerge } from 'tailwind-merge';

interface HomeActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  compact?: boolean;
}

const baseClasses =
  'relative inline-flex items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80';

export const HomeActionButton: React.FC<HomeActionButtonProps> = ({
  active = false,
  compact = true,
  className,
  children,
  ...rest
}) => {
  const sizeClasses = compact ? 'h-8 w-8' : 'h-9 w-9';
  const visual = active
    ? 'bg-sky-800/80 text-white hover:bg-sky-700/80'
    : 'bg-sky-900/50 text-sky-200/80 hover:bg-sky-800/60 hover:text-white';

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
