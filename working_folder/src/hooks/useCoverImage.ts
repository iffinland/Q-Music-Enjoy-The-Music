import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { setImageCoverHash } from '../state/features/globalSlice';
import { queueFetchAvatars } from '../wrappers/GlobalWrapper';
import { coverImageCacheKey, NOT_FOUND_MARKER } from '../utils/coverImage';
import { qdnClient } from '../state/api/client';

type CoverStatus = 'idle' | 'loading' | 'ready' | 'missing';

interface CoverOptions {
  service?: 'THUMBNAIL' | 'IMAGE' | string;
  publisher?: string | null;
  identifier?: string | null;
  enabled?: boolean;
}

interface CoverResult {
  url: string | null;
  status: CoverStatus;
  reload: () => void;
}

export const useCoverImage = (options: CoverOptions): CoverResult => {
  const {
    identifier = null,
    publisher = null,
    service = 'THUMBNAIL',
    enabled = true,
  } = options;

  const dispatch = useDispatch();
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const [status, setStatus] = useState<CoverStatus>('idle');
  const fetchKeyRef = useRef<string | null>(null);

  const cacheKey = useMemo(() => {
    if (!identifier) return null;
    return coverImageCacheKey(identifier, service);
  }, [identifier, service]);

  const cachedValue = useMemo(() => {
    if (!identifier) return null;
    const key = coverImageCacheKey(identifier, service);
    return imageCoverHash[key] ?? imageCoverHash[identifier];
  }, [identifier, service, imageCoverHash]);

  const normalizedUrl = cachedValue && cachedValue !== NOT_FOUND_MARKER ? cachedValue : null;
  const isMissing = cachedValue === NOT_FOUND_MARKER;

  const performFetch = useCallback(async () => {
    if (!enabled || !identifier || !publisher || !cacheKey) return;
    if (isMissing) {
      setStatus('missing');
      return;
    }
    setStatus('loading');

    const queuedKey = `${publisher}:${identifier}:${service}`;
    fetchKeyRef.current = queuedKey;

    await queueFetchAvatars.push(async () => {
      try {
        const url = await qdnClient.getResourceUrl({
          name: publisher,
          service,
          identifier,
        });

        if (!url || url === 'Resource does not exist') {
          dispatch(setImageCoverHash({ id: cacheKey, url: NOT_FOUND_MARKER }));
          setStatus('missing');
          return;
        }

        dispatch(setImageCoverHash({ id: cacheKey, url }));
        setStatus('ready');
      } catch (error) {
        console.error('Failed to load cover', error);
        dispatch(setImageCoverHash({ id: cacheKey, url: NOT_FOUND_MARKER }));
        setStatus('missing');
      }
    }, queuedKey);
  }, [cacheKey, dispatch, enabled, identifier, isMissing, publisher, service]);

  useEffect(() => {
    if (!enabled || !identifier || !publisher || !cacheKey) {
      setStatus('idle');
      return;
    }
    if (normalizedUrl) {
      setStatus('ready');
      return;
    }
    if (isMissing) {
      setStatus('missing');
      return;
    }
    performFetch();
  }, [cacheKey, enabled, identifier, publisher, normalizedUrl, isMissing, performFetch]);

  const reload = useCallback(() => {
    if (cacheKey) {
      dispatch(setImageCoverHash({ id: cacheKey, url: '' }));
      performFetch();
    }
  }, [cacheKey, dispatch, performFetch]);

  return {
    url: normalizedUrl,
    status,
    reload,
  };
};

export default useCoverImage;
