import { NavLink } from "react-router-dom";

import { IconType } from 'react-icons';
import { twMerge } from 'tailwind-merge';

interface SidebarItemProps {
  icon: IconType;
  label: string;
  active?: boolean;
  href: string;
  onClick?: () => void;
}

const baseClasses = `
  flex 
  flex-row 
  h-auto 
  items-center 
  w-full 
  gap-x-4 
  text-sm 
  font-medium
  cursor-pointer
  hover:text-white
  transition
  text-sky-200/80
  py-1
`;

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  active,
  href,
  onClick
}) => {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={twMerge(baseClasses, active && "text-white")}
      >
        <Icon size={18} />
        <p className="truncate w-100 text-left">{label}</p>
      </button>
    );
  }

  return ( 
    <NavLink
      to={href} 
      className={twMerge(baseClasses, active && "text-white")}
    >
      <Icon size={18} />
      <p className="truncate w-100">{label}</p>
    </NavLink>
   );
}

export default SidebarItem;
