import { PlayList, SongMeta } from '../state/features/globalSlice';
import { parseSongMeta } from './songs';
import { searchQdnResources, SearchQdnResourcesParams } from '../utils/qortalApi';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { Podcast, Video } from '../types';

type Resource = Record<string, unknown> & {
  identifier?: string;
  updated?: number;
  created?: number;
};

const SONG_PREFIXES = ['enjoymusic_song_', 'earbump_song_'] as const;
const PLAYLIST_PREFIXES = ['enjoymusic_playlist_', 'earbump_playlist_'] as const;
const PODCAST_PREFIXES = ['enjoymusic_podcast_', 'earbump_podcast_'] as const;
const VIDEO_PREFIXES = ['enjoymusic_video_', 'earbump_video_'] as const;

const isFulfilled = <T,>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T> => input.status === 'fulfilled';

const uniqueByIdentifier = <T extends Resource>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const id = typeof item.identifier === 'string' ? item.identifier : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }

  return result;
};

const sortByLatest = <T extends Resource>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const aTime = typeof a.updated === 'number' ? a.updated : typeof a.created === 'number' ? a.created : 0;
    const bTime = typeof b.updated === 'number' ? b.updated : typeof b.created === 'number' ? b.created : 0;
    return bTime - aTime;
  });
};

const combinePrefixResults = async (
  prefixes: readonly string[],
  buildParams: (prefix: string) => SearchQdnResourcesParams,
) => {
  const settled = await Promise.allSettled(prefixes.map((prefix) => searchQdnResources(buildParams(prefix))));
  const combined = settled
    .filter(isFulfilled)
    .flatMap((entry) => (Array.isArray(entry.value) ? entry.value : [])) as Resource[];

  return sortByLatest(uniqueByIdentifier(combined));
};

const mapPlaylistResource = (resource: any): PlayList => ({
  title: resource?.metadata?.title,
  category: resource?.metadata?.category,
  categoryName: resource?.metadata?.categoryName,
  tags: Array.isArray(resource?.metadata?.tags) ? resource.metadata.tags : [],
  description: resource?.metadata?.description,
  created: resource?.created,
  updated: resource?.updated,
  user: resource?.name,
  image: '',
  songs: [],
  id: resource?.identifier,
});

const filterResources = (resources: Resource[]) => resources.filter((item) => !shouldHideQdnResource(item));

const humanizeIdentifier = (identifier: string, prefixes: readonly string[]): string => {
  let trimmed = identifier;
  for (const prefix of prefixes) {
    if (trimmed.startsWith(prefix)) {
      trimmed = trimmed.slice(prefix.length);
      break;
    }
  }
  return trimmed.replace(/[_-]+/g, ' ').trim();
};

const mapPodcastResource = (resource: any): Podcast | null => {
  const id = typeof resource?.identifier === 'string' ? resource.identifier : '';
  if (!id) return null;

  const titleFromMeta = typeof resource?.metadata?.title === 'string' ? resource.metadata.title.trim() : '';
  const descriptionFromMeta = typeof resource?.metadata?.description === 'string' ? resource.metadata.description : undefined;

  return {
    id,
    title: titleFromMeta || humanizeIdentifier(id, PODCAST_PREFIXES),
    description: descriptionFromMeta,
    created: resource?.created,
    updated: resource?.updated,
    publisher: resource?.name,
    status: resource?.status,
    service: 'AUDIO',
    size: resource?.size,
    type: resource?.metadata?.type || resource?.mimeType || resource?.contentType,
    coverImage: typeof resource?.metadata?.coverImage === 'string' ? resource.metadata.coverImage : undefined,
  };
};

const mapVideoResource = (resource: any): Video | null => {
  const id = typeof resource?.identifier === 'string' ? resource.identifier : '';
  if (!id) return null;

  const titleFromMeta = typeof resource?.metadata?.title === 'string' ? resource.metadata.title.trim() : '';
  const descriptionFromMeta = typeof resource?.metadata?.description === 'string' ? resource.metadata.description : undefined;

  return {
    id,
    title: titleFromMeta || humanizeIdentifier(id, VIDEO_PREFIXES),
    description: descriptionFromMeta,
    created: resource?.created,
    updated: resource?.updated,
    publisher: resource?.name,
    status: resource?.status,
    service: 'VIDEO',
    size: resource?.size,
    type: resource?.metadata?.type || resource?.mimeType || resource?.contentType,
    coverImage: typeof resource?.metadata?.coverImage === 'string' ? resource.metadata.coverImage : undefined,
    durationSeconds: typeof resource?.metadata?.durationSeconds === 'number' ? resource.metadata.durationSeconds : undefined,
    author: typeof resource?.metadata?.author === 'string' ? resource.metadata.author : undefined,
  };
};

export interface FetchLatestSongsOptions {
  limit?: number;
}

export const fetchLatestSongs = async (options: FetchLatestSongsOptions = {}): Promise<SongMeta[]> => {
  const limit = options.limit ?? 10;
  const fetchCount = limit * SONG_PREFIXES.length;

  const combined = await combinePrefixResults(SONG_PREFIXES, (prefix) => ({
    mode: 'ALL',
    service: 'AUDIO',
    query: prefix,
    limit: fetchCount,
    includeMetadata: true,
    offset: 0,
    reverse: true,
    excludeBlocked: true,
    includeStatus: false,
  }));

  const filtered = filterResources(combined).slice(0, limit) as any[];
  return filtered.map((song) => parseSongMeta(song));
};

export interface FetchLatestPlaylistsOptions {
  limit?: number;
}

export const fetchLatestPlaylists = async (options: FetchLatestPlaylistsOptions = {}): Promise<PlayList[]> => {
  const limit = options.limit ?? 10;
  const fetchCount = limit * PLAYLIST_PREFIXES.length;

  const combined = await combinePrefixResults(PLAYLIST_PREFIXES, (prefix) => ({
    mode: 'ALL',
    service: 'PLAYLIST',
    query: prefix,
    limit: fetchCount,
    includeMetadata: true,
    offset: 0,
    reverse: true,
    excludeBlocked: true,
    includeStatus: false,
  }));

  const filtered = filterResources(combined).slice(0, limit) as any[];
  return filtered.map((playlist) => mapPlaylistResource(playlist));
};

export interface FetchLatestPodcastsOptions {
  limit?: number;
}

export const fetchLatestPodcasts = async (options: FetchLatestPodcastsOptions = {}): Promise<Podcast[]> => {
  const limit = options.limit ?? 8;
  if (limit <= 0) return [];

  const fetchCount = limit * PODCAST_PREFIXES.length;

  const combined = await combinePrefixResults(PODCAST_PREFIXES, (prefix) => ({
    mode: 'ALL',
    service: 'DOCUMENT',
    query: prefix,
    limit: fetchCount,
    includeMetadata: true,
    offset: 0,
    reverse: true,
    excludeBlocked: true,
    includeStatus: false,
  }));

  const filtered = filterResources(combined).slice(0, limit) as any[];
  return filtered.map(mapPodcastResource).filter(Boolean) as Podcast[];
};

export interface FetchLatestVideosOptions {
  limit?: number;
}

export const fetchLatestVideos = async (options: FetchLatestVideosOptions = {}): Promise<Video[]> => {
  const limit = options.limit ?? 8;
  if (limit <= 0) return [];

  const fetchCount = limit * VIDEO_PREFIXES.length;

  const combined = await combinePrefixResults(VIDEO_PREFIXES, (prefix) => ({
    mode: 'ALL',
    service: 'DOCUMENT',
    query: prefix,
    limit: fetchCount,
    includeMetadata: true,
    offset: 0,
    reverse: true,
    excludeBlocked: true,
    includeStatus: false,
  }));

  const filtered = filterResources(combined).slice(0, limit) as any[];
  return filtered.map(mapVideoResource).filter(Boolean) as Video[];
};

export interface HomeFeedData {
  songs: SongMeta[];
  playlists: PlayList[];
  podcasts: Podcast[];
  videos: Video[];
}

export interface LoadHomeFeedOptions {
  songsLimit?: number;
  playlistsLimit?: number;
  podcastsLimit?: number;
  videosLimit?: number;
}

export const loadHomeFeed = async (options: LoadHomeFeedOptions = {}): Promise<HomeFeedData> => {
  const {
    songsLimit = 10,
    playlistsLimit = 10,
    podcastsLimit = 8,
    videosLimit = 8,
  } = options;

  const [songs, playlists, podcasts, videos] = await Promise.all([
    fetchLatestSongs({ limit: songsLimit }),
    fetchLatestPlaylists({ limit: playlistsLimit }),
    fetchLatestPodcasts({ limit: podcastsLimit }),
    fetchLatestVideos({ limit: videosLimit }),
  ]);

  return { songs, playlists, podcasts, videos };
};

export interface FetchSongsFeedParams {
  offset?: number;
  limit?: number;
  maxFetch?: number;
}

export interface FetchSongsFeedResult {
  items: SongMeta[];
  hasMore: boolean;
}

const ensureCapacity = async (
  fetchFn: (limit: number) => Promise<Resource[]>,
  filterFn: (resources: Resource[]) => Resource[],
  required: number,
  maxFetch: number,
): Promise<Resource[]> => {
  let fetchSize = required;
  let lastLength = -1;

  while (fetchSize <= maxFetch) {
    const resources = await fetchFn(fetchSize);
    const filtered = filterFn(resources);

    if (filtered.length >= required) {
      return filtered;
    }

    if (filtered.length === lastLength) {
      return filtered;
    }

    lastLength = filtered.length;
    fetchSize += Math.ceil(fetchSize * 0.5);
  }

  const resources = await fetchFn(maxFetch);
  return filterFn(resources);
};

export const fetchSongsFeedPage = async (
  params: FetchSongsFeedParams = {},
): Promise<FetchSongsFeedResult> => {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  const maxFetch = params.maxFetch ?? 400;
  const required = offset + limit;

  const filtered = await ensureCapacity(
    (fetchSize) =>
      combinePrefixResults(SONG_PREFIXES, (prefix) => ({
        mode: 'ALL',
        service: 'AUDIO',
        query: prefix,
        limit: fetchSize,
        includeMetadata: true,
        offset: 0,
        reverse: true,
        excludeBlocked: true,
        includeStatus: true,
      })),
    filterResources,
    required,
    maxFetch,
  );

  const slice = filtered.slice(offset, offset + limit) as any[];
  const hasMore = filtered.length > offset + slice.length;

  return {
    items: slice.map((song) => parseSongMeta(song)),
    hasMore,
  };
};
