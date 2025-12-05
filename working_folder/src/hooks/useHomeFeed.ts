import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HomeFeedData, LoadHomeFeedOptions, loadHomeFeed } from '../services/homeFeed';

type Status = 'idle' | 'loading' | 'success' | 'error';

const CACHE_TTL = 30_000; // 30 seconds, keeps dev refreshes snappy without stale data lingering too long

let cachedResult: { timestamp: number; key: string; data: HomeFeedData } | null = null;
let inflight: Promise<HomeFeedData> | null = null;

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

const resolveWithCache = async (options: LoadHomeFeedOptions): Promise<HomeFeedData> => {
  const key = stableKey(options);

  if (cachedResult && cachedResult.key === key && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return cachedResult.data;
  }

  if (inflight) {
    return inflight;
  }

  inflight = loadHomeFeed(options)
    .then((result) => {
      cachedResult = { data: result, timestamp: Date.now(), key };
      return result;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
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
  const [data, setData] = useState<HomeFeedData | null>(cachedResult?.data ?? null);
  const [status, setStatus] = useState<Status>(cachedResult ? 'success' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef<LoadHomeFeedOptions>({
    songsLimit,
    playlistsLimit,
    podcastsLimit,
    audiobooksLimit,
  });
  const dataRef = useRef<HomeFeedData | null>(data);
  const statusRef = useRef<Status>(status);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const execute = useCallback(async () => {
    setStatus((prev) => (prev === 'success' && dataRef.current ? 'success' : 'loading'));
    setError(null);

    try {
      const result = await resolveWithCache(optionsRef.current);
      setData(result);
      setStatus('success');
    } catch (err) {
      const normalizedError = err instanceof Error ? err : new Error('Failed to load home feed');
      setError(normalizedError);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    optionsRef.current = { songsLimit, playlistsLimit, podcastsLimit, audiobooksLimit };

    if (!enabled) return;

    let cancelled = false;

    const run = async () => {
      setStatus((prev) => (prev === 'success' && dataRef.current ? 'success' : 'loading'));
      setError(null);

      try {
        const result = await resolveWithCache(optionsRef.current);
        if (cancelled) return;
        setData(result);
        setStatus('success');
      } catch (err) {
        if (cancelled) return;
        const normalizedError = err instanceof Error ? err : new Error('Failed to load home feed');
        setError(normalizedError);
        setStatus('error');
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [enabled, songsLimit, playlistsLimit, podcastsLimit, audiobooksLimit]);

  const refresh = useCallback(async () => {
    cachedResult = null;
    await execute();
  }, [execute]);

  return {
    data,
    status,
    error,
    isLoading: status === 'loading' || status === 'idle',
    refresh,
  };
};
