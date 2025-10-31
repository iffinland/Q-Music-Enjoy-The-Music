import { CSSProperties, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

interface BoxProps {
  className?: string;
  style?: CSSProperties;
}

const Box = ({ 
  children,
  className,
  style
 }: PropsWithChildren<BoxProps>) => {
  return ( 
    <div 
      style={style}
      className={twMerge(
        `
        bg-sky-950/60 
        rounded-lg 
        h-fit 
        w-full
        `, 
        className
      )}>
      {children}
    </div>
  );
}
 
export default Box;
