
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { searchQdnResources } from '../utils/qortalApi';
import { shouldHideQdnResource } from '../utils/qdnResourceFilters';
import { PlayList, SongMeta } from '../state/features/globalSlice';
import { Podcast } from '../types';
import { Video } from '../types';
import { SongRequest } from '../state/features/requestsSlice';
import { setIsLoadingGlobal } from '../state/features/globalSlice';

const SONG_PREFIX = 'enjoymusic_song_';
const PLAYLIST_PREFIX_QMUSIC = 'enjoymusic_playlist_';
const PLAYLIST_PREFIX_EARBUMP = 'earbump_playlist_';
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
    dispatch(setIsLoadingGlobal(true));
    setError(null);

    const query = searchTerm.toLowerCase().replace(/ /g, '_');

    try {
      const LIMIT = 20; // reduce payloads for initial results
      const [
        songResults,
        playlistResultsQmusic,
        playlistResultsEarbump,
        videoResults,
        podcastResults,
        requestResults,
      ] = await Promise.all([
        searchQdnResources({
          mode: 'ALL',
          service: 'AUDIO',
          query,
          identifier: SONG_PREFIX,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
          includeStatus: false, // status not needed for initial list
        }),
        searchQdnResources({
          mode: 'ALL',
          service: 'PLAYLIST',
          query,
          identifier: PLAYLIST_PREFIX_QMUSIC,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
        }),
        searchQdnResources({
            mode: 'ALL',
            service: 'PLAYLIST',
            query,
            identifier: PLAYLIST_PREFIX_EARBUMP,
            limit: LIMIT,
            includeMetadata: true,
            reverse: true,
            excludeBlocked: true,
          }),
        searchQdnResources({
          mode: 'ALL',
          service: 'VIDEO',
          query,
          identifier: VIDEO_PREFIX,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
          includeStatus: false,
        }),
        searchQdnResources({
          mode: 'ALL',
          service: 'DOCUMENT',
          query,
          identifier: PODCAST_PREFIX,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
          includeStatus: false,
        }),
        searchQdnResources({
          mode: 'ALL',
          service: 'DOCUMENT',
          query,
          identifier: REQUEST_PREFIX,
          limit: LIMIT,
          includeMetadata: true,
          reverse: true,
          excludeBlocked: true,
          includeStatus: false,
        }),
      ]);

      // if a newer search started, abandon mapping work
      if (currentVersion !== requestVersionRef._[versionKey]) {
        return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
      }

      const songs = songResults.filter((song: any) => !shouldHideQdnResource(song)).map((song: any): SongMeta => ({
        title: song?.metadata?.title,
        description: song?.metadata?.description,
        created: song.created,
        updated: song.updated,
        name: song.name,
        id: song.identifier,
        status: song?.status,
      }));

      const playlists = [...playlistResultsQmusic, ...playlistResultsEarbump].filter((playlist: any) => !shouldHideQdnResource(playlist)).map((playlist: any): PlayList => ({
        title: playlist?.metadata?.title,
        category: playlist?.metadata?.category,
        categoryName: playlist?.metadata?.categoryName,
        tags: playlist?.metadata?.tags || [],
        description: playlist?.metadata?.description,
        created: playlist?.created,
        updated: playlist?.updated,
        user: playlist.name,
        image: '',
        songs: [],
        id: playlist.identifier,
      }));
      
      const videos = videoResults.filter((video: any) => !shouldHideQdnResource(video)).map((video: any): Video => ({
        id: video.identifier,
        title: video?.metadata?.title,
        description: video?.metadata?.description,
        created: video.created,
        updated: video.updated,
        publisher: video.name,
        status: video.status,
        service: 'VIDEO',
        size: video.size,
        type: video.metadata?.type || video.mimeType || video.contentType,
      }));

      const podcasts = podcastResults.filter((podcast: any) => !shouldHideQdnResource(podcast)).map((podcast: any): Podcast => ({
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

      const requests = requestResults.filter((request: any) => !shouldHideQdnResource(request)).map((request: any): SongRequest => ({
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
        return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
      }

      return { songs, playlists, videos, podcasts, requests };
    } catch (err) {
      setError('Failed to perform search. Please try again.');
      return { songs: [], playlists: [], videos: [], podcasts: [], requests: [] };
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [dispatch]);

  return { search, error };
};
