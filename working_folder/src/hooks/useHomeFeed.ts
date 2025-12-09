import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeFeedData, LoadHomeFeedOptions, fetchLatestSongs, fetchLatestPlaylists, fetchLatestPodcasts, fetchLatestAudiobooks } from '../services/homeFeed';

type Status = 'idle' | 'loading' | 'success' | 'error';

const CACHE_TTL = 30_000; // 30 seconds, keeps dev refreshes snappy without stale data lingering too long

type CacheEntry = { timestamp: number; data: HomeFeedData };
const cache = new Map<string, CacheEntry>();

const stableKey = (options: LoadHomeFeedOptions): string => {
  const payload: Record<string, unknown> = {};
  Object.keys(options)
    .sort()
    .forEach((key) => {
      const value = (options as Record<string, unknown>)[key];
      payload[key] = value;
    });
  return JSON.stringify(payload);
};

const EMPTY_DATA: HomeFeedData = { songs: [], playlists: [], podcasts: [], audiobooks: [] };

const readCache = (key: string): HomeFeedData | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) return null;
  return entry.data;
};

const writeCache = (key: string, data: HomeFeedData) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export interface UseHomeFeedOptions extends LoadHomeFeedOptions {
  enabled?: boolean;
}

export interface UseHomeFeedResult {
  data: HomeFeedData | null;
  status: Status;
  error: Error | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useHomeFeed = (options: UseHomeFeedOptions = {}): UseHomeFeedResult => {
  const {
    enabled = true,
    songsLimit = 10,
    playlistsLimit = 10,
    podcastsLimit = 8,
    audiobooksLimit = 8,
  } = options;
  const cacheKey = useMemo(
    () => stableKey({ songsLimit, playlistsLimit, podcastsLimit, audiobooksLimit }),
    [songsLimit, playlistsLimit, podcastsLimit, audiobooksLimit],
  );
  const cached = useMemo(() => readCache(cacheKey), [cacheKey]);

  const [data, setData] = useState<HomeFeedData | null>(cached ?? null);
  const [status, setStatus] = useState<Status>(cached ? 'success' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef<LoadHomeFeedOptions>({
    songsLimit,
    playlistsLimit,
    podcastsLimit,
    audiobooksLimit,
  });
  const dataRef = useRef<HomeFeedData | null>(data);
  const statusRef = useRef<Status>(status);
  const cacheKeyRef = useRef<string>(cacheKey);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const updateSection = useCallback(
    (section: keyof HomeFeedData, items: any[]) => {
      setData((prev) => {
        const next = {
          ...(prev ?? dataRef.current ?? EMPTY_DATA),
          [section]: items,
        } as HomeFeedData;
        dataRef.current = next;
        writeCache(cacheKeyRef.current, next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    optionsRef.current = { songsLimit, playlistsLimit, podcastsLimit, audiobooksLimit };
    cacheKeyRef.current = cacheKey;

    if (!enabled) return;

    let cancelled = false;
    const successes = new Set<keyof HomeFeedData>();
    const failures: Error[] = [];

    setStatus((prev) => (prev === 'success' && dataRef.current ? 'success' : 'loading'));
    setError(null);

    const handleError = (err: unknown) => {
      if (cancelled) return;
      const normalizedError = err instanceof Error ? err : new Error('Failed to load home feed');
      failures.push(normalizedError);
      if (successes.size === 0 && failures.length >= 4) {
        setError(normalizedError);
        setStatus('error');
      }
    };

    const handleSuccess = (section: keyof HomeFeedData, items: any[]) => {
      if (cancelled) return;
      successes.add(section);
      updateSection(section, items);
      setStatus('success');
    };

    const runners: Array<Promise<void>> = [
      fetchLatestSongs({ limit: songsLimit })
        .then((items) => handleSuccess('songs', items))
        .catch(handleError),
      fetchLatestPlaylists({ limit: playlistsLimit })
        .then((items) => handleSuccess('playlists', items))
        .catch(handleError),
      fetchLatestPodcasts({ limit: podcastsLimit })
        .then((items) => handleSuccess('podcasts', items))
        .catch(handleError),
      fetchLatestAudiobooks({ limit: audiobooksLimit })
        .then((items) => handleSuccess('audiobooks', items))
        .catch(handleError),
    ];

    Promise.allSettled(runners).then(() => {
      if (cancelled) return;
      if (successes.size === 0 && failures.length > 0) {
        setStatus('error');
        setError(failures[0]);
      } else if (successes.size > 0) {
        setStatus('success');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, songsLimit, playlistsLimit, podcastsLimit, audiobooksLimit, cacheKey, updateSection]);

  const refresh = useCallback(async () => {
    cache.delete(cacheKeyRef.current);
    setStatus('loading');
    setError(null);
    const currentOptions = optionsRef.current;
    const currentKey = stableKey(currentOptions);
    cacheKeyRef.current = currentKey;

    const run = async () => {
      const sections: Array<Promise<void>> = [
        fetchLatestSongs({ limit: currentOptions.songsLimit ?? 10 })
          .then((items) => updateSection('songs', items))
          .catch((err) => setError(err instanceof Error ? err : new Error('Failed to load songs'))),
        fetchLatestPlaylists({ limit: currentOptions.playlistsLimit ?? 10 })
          .then((items) => updateSection('playlists', items))
          .catch((err) => setError(err instanceof Error ? err : new Error('Failed to load playlists'))),
        fetchLatestPodcasts({ limit: currentOptions.podcastsLimit ?? 8 })
          .then((items) => updateSection('podcasts', items))
          .catch((err) => setError(err instanceof Error ? err : new Error('Failed to load podcasts'))),
        fetchLatestAudiobooks({ limit: currentOptions.audiobooksLimit ?? 8 })
          .then((items) => updateSection('audiobooks', items))
          .catch((err) => setError(err instanceof Error ? err : new Error('Failed to load audiobooks'))),
      ];

      await Promise.allSettled(sections);
      setStatus('success');
    };

    await run();
  }, [updateSection]);

  return {
    data,
    status,
    error,
    isLoading: status === 'loading' || status === 'idle',
    refresh,
  };
};
