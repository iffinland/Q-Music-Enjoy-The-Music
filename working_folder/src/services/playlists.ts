import { PlayList } from '../state/features/globalSlice';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { objectToBase64 } from '../utils/toBase64';
import { cachedSearchQdnResources } from './resourceCache';
import { mapPlaylistSummary } from '../utils/playlistHelpers';
import { qdnClient } from '../state/api/client';

const PLAYLIST_PREFIXES = ['enjoymusic_playlist_'] as const;

const uniqueByIdentifier = (items: any[]): any[] => {
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const entry of items) {
    const identifier = typeof entry?.identifier === 'string' ? entry.identifier : '';
    if (!identifier || seen.has(identifier)) continue;
    seen.add(identifier);
    deduped.push(entry);
  }
  return deduped;
};

const sortByTimestampDesc = (items: any[]): any[] => {
  return [...items].sort((a, b) => {
    const aTime =
      typeof a?.updated === 'number'
        ? a.updated
        : typeof a?.created === 'number'
        ? a.created
        : 0;
    const bTime =
      typeof b?.updated === 'number'
        ? b.updated
        : typeof b?.created === 'number'
        ? b.created
        : 0;
    return bTime - aTime;
  });
};

export interface FetchPublisherPlaylistsOptions {
  offset?: number;
  limit?: number;
}

export interface FetchPublisherPlaylistsResult {
  items: PlayList[];
  hasMore: boolean;
}

export const fetchPlaylistsByPublisher = async (
  publisher: string,
  options: FetchPublisherPlaylistsOptions = {},
): Promise<FetchPublisherPlaylistsResult> => {
  if (!publisher) {
    return { items: [], hasMore: false };
  }

  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, options.limit ?? 20);
  const fetchCount = offset + limit * 2;

  const settled = await Promise.all(
    PLAYLIST_PREFIXES.map(async (prefix) => {
      try {
        const response = await cachedSearchQdnResources({
          mode: 'ALL',
          service: 'PLAYLIST',
          identifier: prefix,
          limit: fetchCount,
          offset: 0,
          reverse: true,
          includeMetadata: true,
          includeStatus: false,
          excludeBlocked: true,
          name: publisher,
          exactMatchNames: true,
        });
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error('Failed to search playlists for publisher', publisher, error);
        return [];
      }
    }),
  );

  const combined = settled.flat();
  if (combined.length === 0) {
    return { items: [], hasMore: false };
  }

  const filtered = uniqueByIdentifier(
    combined.filter((entry) => {
      if (!entry || typeof entry?.identifier !== 'string') return false;
      if (!PLAYLIST_PREFIXES.some((prefix) => entry.identifier.startsWith(prefix))) {
        return false;
      }
      if (shouldHideQdnResource(entry)) return false;
      return true;
    }),
  );

  const sorted = sortByTimestampDesc(filtered);
  const slice = sorted.slice(offset, offset + limit);
  const hasMore = sorted.length > offset + slice.length;
  const mapped = slice.map((entry) => mapPlaylistSummary(entry)).filter(Boolean);

  return {
    items: mapped,
    hasMore,
  };
};

export const deletePlaylistResource = async (owner: string, identifier: string): Promise<void> => {
  if (!owner || !identifier) {
    throw new Error('Missing playlist owner or identifier.');
  }

  const payload = {
    id: identifier,
    deleted: true,
    updated: Date.now(),
    title: 'deleted',
    description: 'deleted',
    songs: [],
  };

  const data64 = await objectToBase64(payload as Record<string, unknown>);

  await qdnClient.publishResource({
    name: owner,
    service: 'PLAYLIST',
    identifier,
    data64,
    encoding: 'base64',
    title: 'deleted',
    description: 'deleted',
  });
};
