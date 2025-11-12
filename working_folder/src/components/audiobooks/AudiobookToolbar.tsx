import React from 'react';

export type AudiobookSortOrder = 'newest' | 'oldest';

interface AudiobookToolbarProps {
  slogan: string;
}

export const AudiobookToolbar: React.FC<AudiobookToolbarProps> = ({ slogan }) => (
  <div className="flex flex-col gap-y-6">
    <div>
      <h1 className="text-3xl font-bold text-white">Listen Audiobooks</h1>
      <p className="text-sm font-medium tracking-wide text-sky-300/80 md:text-base">
        {slogan}
      </p>
    </div>
  </div>
);
