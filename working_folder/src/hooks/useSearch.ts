
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { cachedSearchQdnResources } from '../services/resourceCache';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { PlayList, SongMeta } from '../state/features/globalSlice';
import { Podcast } from '../types';
import { Video } from '../types';
import { SongRequest } from '../state/features/requestsSlice';
import { setIsLoadingGlobal } from '../state/features/globalSlice';
import { buildVideoMeta } from '../services/videos';
import {
  mapPlaylistSummary,
  resolvePlaylistCategory,
  resolvePlaylistCategoryName,
  resolvePlaylistDescription,
  resolvePlaylistTags,
  resolvePlaylistTitle,
} from '../utils/playlistHelpers';

const SONG_PREFIX = 'enjoymusic_song_';
const PLAYLIST_PREFIX_QMUSIC = 'enjoymusic_playlist_';
const VIDEO_PREFIX = 'enjoymusic_video_';
const PODCAST_PREFIX = 'enjoymusic_podcast_';
const REQUEST_PREFIX = 'enjoymusic_request_';

export interface SearchResults {
  songs: SongMeta[];
  playlists: PlayList[];
  videos: Video[];
  podcasts: Podcast[];
  requests: SongRequest[];
}

export const useSearch = () => {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);
  // simple request versioning to avoid stale updates
  const requestVersionRef = (typeof window !== 'undefined' ? (window as any) : {}) as { _: any };
  if (!requestVersionRef._) requestVersionRef._ = {};
  const versionKey = 'useSearchVersion';

  const search = useCallback(async (searchTerm: string): Promise<SearchResults> => {
    // bump version for each invocation
    requestVersionRef._[versionKey] = (requestVersionRef._[versionKey] || 0) + 1;
    const currentVersion = requestVersionRef._[versionKey];
    const normalized = searchTerm.trim();
    if (!normalized) {
      dispatch(setIsLoadingGlobal(false));
      return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
    }

    dispatch(setIsLoadingGlobal(true));
    setError(null);

    const normalizedLower = normalized.toLowerCase();
    const normalizedUnderscore = normalizedLower.replace(/\s+/g, '_');
    const query = normalizedUnderscore;
    const LIMIT = 40;

    const matchesQuery = (...fields: Array<string | undefined | null>) =>
      fields.some((field) => {
        if (!field || typeof field !== 'string') return false;
        const lower = field.toLowerCase();
        return lower.includes(normalizedLower) || lower.includes(normalizedUnderscore);
      });

    const searchWithPrefix = async (service: string, prefix: string) => {
      const [byMetadata, byIdentifier] = await Promise.all([
        cachedSearchQdnResources({
          mode: 'ALL',
          service,
          query,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
          includeStatus: true,
        }),
        cachedSearchQdnResources({
          mode: 'ALL',
          service,
          identifier: prefix,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
          includeStatus: true,
        }),
      ]);

      const combined = [...(byMetadata || []), ...(byIdentifier || [])];
      const seen = new Set<string>();
      const filtered = combined.filter((entry: any) => {
        const identifier = typeof entry?.identifier === 'string' ? entry.identifier : '';
        if (!identifier) return false;
        if (!identifier.startsWith(prefix)) return false;
        if (seen.has(identifier)) return false;
        if (shouldHideQdnResource(entry)) {
          seen.add(identifier);
          return false;
        }
        seen.add(identifier);
        return true;
      });
      return filtered;
    };

    try {
      const [
        songResults,
        playlistResultsQmusic,
        videoDocumentResults,
        videoBinaryResults,
        podcastResults,
        requestResults,
      ] = await Promise.all([
        searchWithPrefix('AUDIO', SONG_PREFIX),
        searchWithPrefix('PLAYLIST', PLAYLIST_PREFIX_QMUSIC),
        searchWithPrefix('DOCUMENT', VIDEO_PREFIX),
        searchWithPrefix('VIDEO', VIDEO_PREFIX),
        searchWithPrefix('DOCUMENT', PODCAST_PREFIX),
        searchWithPrefix('DOCUMENT', REQUEST_PREFIX),
      ]);

      // if a newer search started, abandon mapping work
      if (currentVersion !== requestVersionRef._[versionKey]) {
        dispatch(setIsLoadingGlobal(false));
        return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
      }

      const songs = songResults
        .filter((song: any) =>
          matchesQuery(
            song?.identifier,
            song?.name,
            song?.metadata?.title,
            song?.metadata?.description,
            (song?.metadata?.author as string) || undefined,
          ),
        )
        .map((song: any): SongMeta => ({
          title: song?.metadata?.title,
          description: song?.metadata?.description,
          created: song.created,
          updated: song.updated,
          name: song.name,
          id: song.identifier,
          status: song?.status,
          service: 'AUDIO',
        }));

      const playlists = playlistResultsQmusic
        .filter((playlist: any) => {
          const title = resolvePlaylistTitle(playlist);
          const description = resolvePlaylistDescription(playlist);
          const category = resolvePlaylistCategory(playlist);
          const categoryName = resolvePlaylistCategoryName(playlist);
          const tagsValue = resolvePlaylistTags(playlist);
          return matchesQuery(
            playlist?.identifier,
            playlist?.name,
            title,
            description,
            category,
            categoryName,
            tagsValue.length ? tagsValue.join(' ') : undefined,
          );
        })
        .map((playlist: any): PlayList => mapPlaylistSummary(playlist));

      const rawVideos = [...videoDocumentResults, ...videoBinaryResults];
      const videoMap = new Map<string, Video>();
      rawVideos.forEach((entry: any) => {
        if (
          !matchesQuery(
            entry?.identifier,
            entry?.name,
            entry?.metadata?.title,
            entry?.metadata?.description,
          )
        ) {
          return;
        }
        const meta = buildVideoMeta(entry);
        if (!meta) return;
        const existing = videoMap.get(meta.id);
        if (!existing) {
          videoMap.set(meta.id, meta);
          return;
        }
        if (!existing.title && meta.title) {
          videoMap.set(meta.id, { ...existing, ...meta });
        }
      });
      const videos = Array.from(videoMap.values());

      const podcasts = podcastResults
        .filter((podcast: any) =>
          matchesQuery(
            podcast?.identifier,
            podcast?.name,
            podcast?.metadata?.title,
            podcast?.metadata?.description,
            podcast?.metadata?.category,
          ),
        )
        .map((podcast: any): Podcast => ({
        id: podcast.identifier,
        title: podcast?.metadata?.title,
        description: podcast?.metadata?.description,
        created: podcast.created,
        updated: podcast.updated,
        publisher: podcast.name,
        status: podcast.status,
        service: 'AUDIO',
        size: podcast.size,
        type: podcast.metadata?.type || podcast.mimeType || podcast.contentType,
      }));

      const requests = requestResults
        .filter((request: any) =>
          matchesQuery(
            request?.identifier,
            request?.name,
            request?.metadata?.title,
            request?.metadata?.artist,
            request?.metadata?.description,
          ),
        )
        .map((request: any): SongRequest => ({
        id: request.identifier,
        title: request.metadata?.title,
        artist: request.metadata?.artist,
        publisher: request.name,
        created: request.created,
        updated: request.updated,
        status: 'open',
      }));

      // if a newer search started during mapping, drop this result
      if (currentVersion !== requestVersionRef._[versionKey]) {
        dispatch(setIsLoadingGlobal(false));
        return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
      }

      dispatch(setIsLoadingGlobal(false));
      return { songs, playlists, videos, podcasts, requests };
    } catch (err) {
      setError('Failed to perform search. Please try again.');
      return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
    }
  }, [dispatch]);

  return { search, error };
};
