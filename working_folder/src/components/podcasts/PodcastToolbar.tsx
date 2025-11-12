import React from 'react';

export type PodcastSortOrder = 'newest' | 'oldest';

interface PodcastToolbarProps {
  slogan: string;
}

export const PodcastToolbar: React.FC<PodcastToolbarProps> = ({ slogan }) => (
  <div className="flex flex-col gap-y-6">
    <div>
      <h1 className="text-3xl font-bold text-white">Listen Podcast</h1>
      <p className="text-sm font-medium tracking-wide text-sky-300/80 md:text-base">
        {slogan}
      </p>
    </div>
  </div>
);
