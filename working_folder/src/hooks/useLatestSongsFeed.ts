import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SongMeta } from '../state/features/globalSlice';
import { fetchSongsFeedPage, FetchSongsFeedParams } from '../services/homeFeed';

interface UseLatestSongsFeedOptions extends Omit<FetchSongsFeedParams, 'offset'> {
  initialLoad?: boolean;
}

interface UseLatestSongsFeedReturn {
  songs: SongMeta[];
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useLatestSongsFeed = (
  options: UseLatestSongsFeedOptions = {},
): UseLatestSongsFeedReturn => {
  const { limit = 20, maxFetch, initialLoad = true } = options;
  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const optionsRef = useRef({ limit, maxFetch });
  optionsRef.current = useMemo(() => ({ limit, maxFetch }), [limit, maxFetch]);

  const load = useCallback(
    async (mode: 'initial' | 'more') => {
      if (mode === 'initial') {
        setIsInitialLoading(true);
      } else {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
      }

      setError(null);

      const currentSongs = mode === 'initial' ? [] : songs;
      const offset = mode === 'initial' ? 0 : currentSongs.length;

      try {
        const result = await fetchSongsFeedPage({
          offset,
          limit: optionsRef.current.limit,
          maxFetch: optionsRef.current.maxFetch,
        });

        setSongs((prev) => (mode === 'initial' ? result.items : [...prev, ...result.items]));
        setHasMore(result.hasMore);
      } catch (err) {
        const normalizedError = err instanceof Error ? err : new Error('Failed to load latest songs');
        setError(normalizedError);
        if (mode === 'initial') {
          setSongs([]);
          setHasMore(true);
        }
      } finally {
        if (mode === 'initial') {
          setIsInitialLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [hasMore, isLoadingMore, songs],
  );

  useEffect(() => {
    if (!initialLoad) return;
    load('initial');
  }, [initialLoad, load]);

  const loadMore = useCallback(async () => {
    await load('more');
  }, [load]);

  const refresh = useCallback(async () => {
    await load('initial');
  }, [load]);

  return {
    songs,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
};

