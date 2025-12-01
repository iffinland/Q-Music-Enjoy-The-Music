import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import LazyLoad from '../../components/common/LazyLoad';
import { PlayListsContent } from '../../components/PlaylistsContent';
import LibraryPlaylistActions from '../../components/library/LibraryPlaylistActions';
import { RootState } from '../../state/store';
import { fetchPlaylistsByPublisher } from '../../services/playlists';
import { PlayList } from '../../state/features/globalSlice';

const PAGE_SIZE = 18;

const Message: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-lg border border-sky-900/50 bg-sky-950/50 p-4 text-center text-sm text-sky-200/80">
    {label}
  </div>
);

type PlaylistRefreshDetail = {
  playlist?: PlayList;
  playlistId?: string;
  mode?: 'create' | 'edit' | 'delete';
};

export const MyPlaylists = () => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [playlists, setPlaylists] = useState<PlayList[]>([]);
  const playlistsRef = useRef<PlayList[]>([]);
  const pendingOptimisticRef = useRef<Map<string, PlayList>>(new Map());
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isQMusicPlaylist = useCallback((playlist?: PlayList) => {
    if (!playlist?.id) return false;
    return playlist.id.toLowerCase().includes('enjoymusic_playlist_');
  }, []);

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  const mergeWithPending = useCallback(
    (items: PlayList[]): PlayList[] => {
      if (pendingOptimisticRef.current.size === 0) return items;
      const merged = [...items];
      pendingOptimisticRef.current.forEach((pending, id) => {
        const idx = merged.findIndex((entry) => entry.id === id);
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], ...pending };
          pendingOptimisticRef.current.delete(id);
        } else {
          merged.unshift(pending);
        }
      });
      return merged.filter(isQMusicPlaylist);
    },
    [isQMusicPlaylist],
  );

  const loadPlaylists = useCallback(
    async (options: { reset?: boolean; showSpinner?: boolean } = {}) => {
      const { reset = false, showSpinner = true } = options;
      if (!username) return;
      if (!reset && isLoadingMore) return;

      setError(null);

      if (reset) {
        if (showSpinner) {
          setIsInitialLoading(true);
        }
      } else if (showSpinner) {
        setIsLoadingMore(true);
      }

      try {
        const offset = reset ? 0 : playlistsRef.current.length;
        const result = await fetchPlaylistsByPublisher(username, {
          offset,
          limit: PAGE_SIZE,
        });
        setHasMore(result.hasMore);
        setPlaylists((prev) => {
          const filteredItems = result.items.filter(isQMusicPlaylist);
          if (reset) {
            return mergeWithPending(filteredItems);
          }
          const merged = [...prev];
          filteredItems.forEach((playlist) => {
            const idx = merged.findIndex((entry) => entry.id === playlist.id);
            if (idx !== -1) {
              merged[idx] = playlist;
            } else {
              merged.push(playlist);
            }
          });
          return mergeWithPending(merged);
        });
      } catch (err) {
        console.error('Failed to load playlists for user', err);
        setError('Unable to load your playlists. Please try again.');
        if (reset) {
          setPlaylists([]);
          setHasMore(false);
        }
      } finally {
        if (reset) {
          if (showSpinner) {
            setIsInitialLoading(false);
          }
        } else if (showSpinner) {
          setIsLoadingMore(false);
        }
      }
    },
    [username, isLoadingMore, mergeWithPending],
  );

  useEffect(() => {
    if (!username) {
      setPlaylists([]);
      setHasMore(false);
      setError(null);
      return;
    }
    loadPlaylists({ reset: true });
  }, [username, loadPlaylists]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
      return Promise.resolve();
    }
    return loadPlaylists({ reset: false });
  }, [hasMore, isLoadingMore, loadPlaylists]);

  const showEmptyState = useMemo(
    () => !isInitialLoading && playlists.length === 0 && !error,
    [isInitialLoading, playlists.length, error],
  );

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<PlaylistRefreshDetail>).detail;
      if (!detail) {
        loadPlaylists({ reset: true, showSpinner: false });
        return;
      }

      if (detail.mode === 'delete' && detail.playlistId) {
        pendingOptimisticRef.current.delete(detail.playlistId);
        setPlaylists((prev) =>
          prev.filter((playlist) => playlist.id !== detail.playlistId),
        );
        loadPlaylists({ reset: true, showSpinner: false });
        return;
      }

      const playlistDetail = detail.playlist;
      if (playlistDetail) {
        if (!isQMusicPlaylist(playlistDetail)) {
          pendingOptimisticRef.current.delete(playlistDetail.id);
          setPlaylists((prev) => prev.filter((entry) => entry.id !== playlistDetail.id));
          return;
        }
        pendingOptimisticRef.current.set(playlistDetail.id, playlistDetail);
        setPlaylists((prev) => {
          const idx = prev.findIndex((entry) => entry.id === playlistDetail.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...playlistDetail };
            return next;
          }
          return [playlistDetail, ...prev];
        });
        loadPlaylists({ reset: true, showSpinner: false });
      }
    };

    window.addEventListener('playlists:refresh', handleRefresh);
    return () => {
      window.removeEventListener('playlists:refresh', handleRefresh);
    };
  }, [loadPlaylists]);

  if (!username) {
    return <Message label="Log in to view playlists you have published." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-y-2">
        <h1 className="text-white text-3xl font-semibold">My Playlists</h1>
        <p className="text-sm text-sky-200/80">
          Browse every playlist you have published to Q-Music.
        </p>
      </div>

      {isInitialLoading && playlists.length === 0 && <Message label="Loading your playlists…" />}
      {error && <Message label={error} />}
      {showEmptyState && <Message label="No playlists found. Publish one to see it here." />}

      {playlists.length > 0 && (
        <PlayListsContent
          playlists={playlists}
          renderActions={(playlist) => <LibraryPlaylistActions playlist={playlist} />}
        />
      )}

      {hasMore && (
        <div className="pt-2">
          <LazyLoad onLoadMore={handleLoadMore} />
        </div>
      )}
    </div>
  );
};
