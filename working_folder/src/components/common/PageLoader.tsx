import React from 'react';
import Spinner from './Spinner';

interface PageLoaderProps {
  size?: number
  thickness?: number
}

const PageLoader: React.FC<PageLoaderProps> = ({
  size = 40,
  thickness = 5
}) => {
  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <Spinner size={size} className="border-[3px] border-t-transparent border-sky-400" />
    </div>
  )
}

export default PageLoader;
