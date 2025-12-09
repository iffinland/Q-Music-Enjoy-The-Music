import React from 'react';

interface BrowseToolbarProps {
  title: string;
  slogan: string;
  action?: React.ReactNode;
}

const BrowseToolbar: React.FC<BrowseToolbarProps> = ({ title, slogan, action }) => {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="text-sm font-medium tracking-wide text-sky-300/80 md:text-base">
            {slogan}
          </p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
};

export default BrowseToolbar;
