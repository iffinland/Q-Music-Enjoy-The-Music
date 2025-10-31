import React, { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export type PodcastSortOrder = 'newest' | 'oldest';

interface PodcastToolbarProps {
  slogan: string;
  sortOrder: PodcastSortOrder;
  onSortChange: (order: PodcastSortOrder) => void;
  onPublishClick?: () => void;
}

const SORT_LABELS: Record<PodcastSortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
};

export const PodcastToolbar: React.FC<PodcastToolbarProps> = ({
  slogan,
  sortOrder,
  onSortChange,
  onPublishClick,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const handleSelectOrder = (order: PodcastSortOrder) => {
    onSortChange(order);
    setIsMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-y-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-white">Listen Podcast</h1>
        <p className="text-sm font-medium tracking-wide text-sky-300/80 md:text-base">
          {slogan}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row md:flex-row md:items-center">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center justify-between gap-2 rounded-full border border-sky-800/80 bg-sky-900/70 px-5 py-2 text-sm font-semibold text-sky-200 transition hover:border-sky-500/70 hover:text-white md:text-base"
          >
            <span>Sort Podcasts</span>
            <span className="text-xs font-medium uppercase tracking-wider text-sky-400 md:text-sm">
              {SORT_LABELS[sortOrder]}
            </span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-sky-800/70 bg-sky-950/95 shadow-lg">
              {(
                Object.keys(SORT_LABELS) as Array<PodcastSortOrder>
              ).map((order) => (
                <button
                  key={order}
                  type="button"
                  onClick={() => handleSelectOrder(order)}
                  className={twMerge(
                    'w-full px-4 py-2 text-left text-sm font-medium text-sky-200 transition hover:bg-sky-800/80 hover:text-white',
                    order === sortOrder && 'bg-sky-800/60 text-white'
                  )}
                >
                  {SORT_LABELS[order]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onPublishClick}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-black shadow-md transition hover:bg-orange-400 md:text-base"
        >
          Publish New Podcast
        </button>
      </div>
    </div>
  );
};
