import React from 'react';

export type PodcastSortOrder = 'newest' | 'oldest';

interface PodcastToolbarProps {
  slogan: string;
  action?: React.ReactNode;
}

export const PodcastToolbar: React.FC<PodcastToolbarProps> = ({ slogan, action }) => (
  <div className="flex flex-col gap-y-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-white">Listen Podcast</h1>
        <p className="text-sm font-medium tracking-wide text-sky-300/80 md:text-base">
          {slogan}
        </p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  </div>
);
