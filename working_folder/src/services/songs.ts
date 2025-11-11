import { SongMeta } from '../state/features/globalSlice';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { cachedSearchQdnResources } from './resourceCache';

/**
 * Shared parsing and memoization for song description k=v pairs
 */
const descriptionCache = new Map<string, { parsed: Record<string, string>; updated?: number }>();

export const parseSongMeta = (song: any): SongMeta => {
  const id = song?.identifier as string | undefined;
  const updated = song?.updated as number | undefined;

  let metadataMap: Record<string, string> | undefined;

  if (id) {
    const cached = descriptionCache.get(id);
    if (cached && (!updated || !cached.updated || updated <= cached.updated)) {
      metadataMap = cached.parsed;
    }
  }

  if (!metadataMap) {
    const description: string = song?.metadata?.description || '';
    const pairs = description.split(';');
    const tmp: Record<string, string> = {};
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey || !rawValue) continue;
      const key = rawKey.trim();
      if (key !== 'title' && key !== 'author') continue;
      tmp[key] = rawValue.trim();
    }
    metadataMap = tmp;
    if (id) {
      descriptionCache.set(id, { parsed: metadataMap, updated });
    }
  }

  return {
    title: song?.metadata?.title || metadataMap.title || song?.identifier?.replace(/_/g, ' '),
    description: song?.metadata?.description,
    created: song?.created,
    updated: song?.updated,
    name: song?.name,
    id: song?.identifier,
    status: song?.status,
    author: metadataMap.author,
    service: song?.service || 'AUDIO',
  };
};

export const fetchSongByIdentifier = async (
  publisher: string,
  identifier: string,
): Promise<SongMeta | null> => {
  const results = await cachedSearchQdnResources({
    mode: 'ALL',
    service: 'AUDIO',
    query: identifier,
    name: publisher,
    identifier,
    limit: 1,
    offset: 0,
    reverse: true,
    includeMetadata: true,
    includeStatus: true,
    excludeBlocked: true,
    exactMatchNames: true,
  });

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const [song] = results;
  if (shouldHideQdnResource(song)) {
    return null;
  }

  return parseSongMeta(song);
};
