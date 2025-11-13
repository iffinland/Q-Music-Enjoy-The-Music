import React, { useMemo, useState } from 'react';
import SortControls from '../common/SortControls';
import MediaItem from '../MediaItem';
import { Song } from '../../types';
import LibrarySongActions from './LibrarySongActions';

const ALL_CATEGORIES_VALUE = 'ALL';
const UNCATEGORIZED_LABEL = 'Uncategorized';

interface LibrarySongListProps {
  songs: Song[];
  showDeleteButton?: boolean;
}

const getSongTimestamp = (song: Song) => {
  const candidate = (song as any)?.updated ?? (song as any)?.created ?? 0;
  return typeof candidate === 'number' ? candidate : 0;
};

const getSongCategory = (song: Song): string | null => {
  const candidate =
    (song as any)?.category ||
    (song as any)?.categoryName ||
    (song as any)?.genre ||
    (song as any)?.mood ||
    null;
  if (!candidate) return null;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const LibrarySongList: React.FC<LibrarySongListProps> = ({ songs, showDeleteButton }) => {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedCategory, setSelectedCategory] =
    useState<string>(ALL_CATEGORIES_VALUE);

  const availableCategories = useMemo(() => {
    const bucket = new Set<string>();
    let hasUncategorized = false;
    songs.forEach((song) => {
      const category = getSongCategory(song);
      if (category) {
        bucket.add(category);
      } else {
        hasUncategorized = true;
      }
    });
    const sorted = Array.from(bucket).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    if (hasUncategorized) {
      sorted.push(UNCATEGORIZED_LABEL);
    }
    return sorted;
  }, [songs]);

  const displaySongs = useMemo(() => {
    const filtered = songs.filter((song) => {
      if (selectedCategory === ALL_CATEGORIES_VALUE) return true;
      const category = getSongCategory(song) ?? UNCATEGORIZED_LABEL;
      return category === selectedCategory;
    });

    return filtered
      .slice()
      .sort((a, b) => {
        const delta = getSongTimestamp(b) - getSongTimestamp(a);
        return sortOrder === 'desc' ? delta : -delta;
      });
  }, [songs, selectedCategory, sortOrder]);

  const showEmptyState = songs.length === 0 || displaySongs.length === 0;

  return (
    <div className="flex flex-col gap-y-3">
      {songs.length > 0 && (
        <SortControls
          className="px-6"
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          categories={availableCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}
      <div className="flex flex-col gap-y-2 w-full px-6">
        {showEmptyState ? (
          <div className="flex flex-col gap-y-2 text-sky-200/80">
            {songs.length === 0
              ? 'No songs found.'
              : 'No songs match the selected filters.'}
          </div>
        ) : (
          displaySongs.map((song) => (
            <div
              key={song.id}
              className="flex w-full items-center justify-between gap-x-4 rounded-md border border-transparent px-2 py-1 hover:border-sky-800/60 hover:bg-sky-900/40"
            >
              <div className="flex-1">
                <MediaItem data={song} showPlayButton={false} />
              </div>
              <LibrarySongActions song={song} showDeleteButton={showDeleteButton} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LibrarySongList;
