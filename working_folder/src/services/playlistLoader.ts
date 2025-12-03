import { PlayList } from '../state/features/globalSlice';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { cachedSearchQdnResources } from './resourceCache';
import { mapPlaylistSummary } from '../utils/playlistHelpers';

type PlaylistCacheEntry = {
  timestamp: number;
  promise: Promise<PlayList | null>;
};

const PLAYLIST_CACHE_TTL = 60_000;
const playlistMetaCache = new Map<string, PlaylistCacheEntry>();

const isValidPlaylist = (entry: any) => !shouldHideQdnResource(entry) && Boolean(entry?.identifier);

export const loadPlaylistMeta = async (user: string, id: string): Promise<PlayList | null> => {
  if (!user || !id) return null;
  const cacheKey = `${user}:${id}`;
  const now = Date.now();
  const cached = playlistMetaCache.get(cacheKey);
  if (cached && now - cached.timestamp < PLAYLIST_CACHE_TTL) {
    return cached.promise;
  }

  const promise = (async () => {
    const results = await cachedSearchQdnResources({
      mode: 'ALL',
      service: 'PLAYLIST',
      identifier: id.startsWith('enjoymusic_playlist_') ? undefined : id,
      query: id,
      limit: 1,
      includeMetadata: true,
      offset: 0,
      reverse: true,
      excludeBlocked: true,
      exactMatchNames: true,
      name: user,
    });

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const entry = results.find(isValidPlaylist);
    if (!entry) {
      return null;
    }

    return mapPlaylistSummary(entry);
  })();

  playlistMetaCache.set(cacheKey, { timestamp: now, promise });
  promise.catch(() => {
    const entry = playlistMetaCache.get(cacheKey);
    if (entry?.promise === promise) {
      playlistMetaCache.delete(cacheKey);
    }
  });

  return promise;
};
