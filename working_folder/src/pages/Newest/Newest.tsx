import React, { useMemo } from 'react';
import Header from '../../components/Header';
import SongItem from '../../components/SongItem';
import Box from '../../components/Box';
import { useLatestSongsFeed } from '../../hooks/useLatestSongsFeed';
import LazyLoad from '../../components/common/LazyLoad';
import useOnPlay from '../../hooks/useOnPlay';
import Button from '../../components/Button';

const EmptyState = () => (
  <div className="mt-6 text-sky-200/80">
    No songs available.
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="mt-6 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
    <p className="mb-2 font-semibold">{message}</p>
    <Button onClick={onRetry} className="bg-red-600/70 px-4 py-2 text-xs uppercase tracking-wide">
      Retry
    </Button>
  </div>
);

export const Newest = () => {
  const { songs, isInitialLoading, isLoadingMore, hasMore, error, loadMore, refresh } = useLatestSongsFeed({ limit: 24 });
  const onPlay = useOnPlay(songs);

  const skeletonItems = useMemo(() => Array.from({ length: 12 }), []);

  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <h1 className="text-white text-3xl font-semibold">Newest songs</h1>
      </Header>
      <div className="mb-7 px-6">
        {isInitialLoading ? (
          <div
            className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
            aria-hidden
          >
            {skeletonItems.map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-40 rounded-xl border border-sky-900/60 bg-gradient-to-br from-sky-950/80 via-sky-900/50 to-sky-950/80 shadow-inner animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {error && songs.length === 0 && (
              <ErrorState message="Failed to load latest songs." onRetry={refresh} />
            )}

            {songs.length === 0 && !error ? (
              <EmptyState />
            ) : (
              <div
                className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
              >
                {songs.map((song) => (
                  <SongItem key={song.id} data={song} onClick={(id) => onPlay(id)} />
                ))}
              </div>
            )}

            {hasMore && songs.length > 0 && (
              <div className="mt-6 flex justify-center">
                <LazyLoad onLoadMore={loadMore} />
              </div>
            )}

            {error && songs.length > 0 && !isLoadingMore && (
              <div className="mt-4 text-xs text-red-300">
                Failed to load more songs. Please try again.
              </div>
            )}
          </>
        )}
      </div>
    </Box>
  );
};
