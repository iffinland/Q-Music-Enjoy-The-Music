
import { twMerge } from "tailwind-merge";

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={twMerge(`
        h-fit 
        p-6
        rounded-lg
        bg-sky-950/60
        border
        border-sky-900/40
        `,
        className
      )}>
      <div className="w-full mb-4 flex items-center justify-between" />
      {children}
    </div>
  );
}

export default Header;
