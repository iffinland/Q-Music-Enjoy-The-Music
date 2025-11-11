import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';

import { RootState } from '../state/store';
import {
  PlayList,
  SongReference,
  addToPlaylistHashMap,
  upsertPlaylists,
} from '../state/features/globalSlice';
import { Song } from '../types';

const normalizeSongs = (input: any): SongReference[] => {
  if (Array.isArray(input?.songs)) {
    return input.songs;
  }
  if (Array.isArray(input?.metadata?.songs)) {
    return input.metadata.songs;
  }
  return [];
};

const mergePlaylistResource = (playlist: PlayList, resource: any): PlayList => {
  const normalizedSongs = normalizeSongs(resource);
  const normalizedImage =
    resource?.image ?? resource?.metadata?.image ?? playlist.image ?? null;

  return {
    ...playlist,
    ...resource,
    title: resource?.title ?? resource?.metadata?.title ?? playlist.title ?? 'Untitled playlist',
    description:
      resource?.description ?? resource?.metadata?.description ?? playlist.description ?? '',
    image: normalizedImage,
    songs: normalizedSongs,
  };
};

export const mapPlaylistSongsToSongs = (songs: SongReference[] = []): Song[] =>
  songs
    .filter(
      (entry): entry is SongReference =>
        Boolean(entry && entry.identifier && entry.name),
    )
    .map((entry) => ({
      id: entry.identifier,
      name: entry.name,
      service: entry.service || 'AUDIO',
      title: entry.title || entry.identifier,
      author: entry.author || entry.artist || entry.name,
    }));

export const usePlaylistPlayback = () => {
  const dispatch = useDispatch();
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);

  const ensurePlaylistSongs = useCallback(
    async (playlist: PlayList): Promise<PlayList> => {
      if (!playlist?.id) {
        throw new Error('Playlist identifier is missing.');
      }

      const cached = playlistHash[playlist.id];
      if (cached?.songs?.length) {
        return cached;
      }

      if (playlist?.songs?.length) {
        dispatch(addToPlaylistHashMap(playlist));
        return playlist;
      }

      const publisher = playlist?.user ?? cached?.user;
      if (!publisher) {
        throw new Error('Playlist publisher is missing.');
      }

      try {
        const resource = await qortalRequest({
          action: 'FETCH_QDN_RESOURCE',
          name: publisher,
          service: 'PLAYLIST',
          identifier: playlist.id,
        });

        if (!resource) {
          throw new Error('Playlist content not found.');
        }

        const merged = mergePlaylistResource({ ...playlist, user: publisher }, resource);
        dispatch(addToPlaylistHashMap(merged));
        dispatch(upsertPlaylists([merged]));
        return merged;
      } catch (error) {
        console.error('Failed to load playlist content', error);
        throw error;
      }
    },
    [dispatch, playlistHash],
  );

  const safeEnsurePlaylistSongs = useCallback(
    async (playlist: PlayList): Promise<PlayList | null> => {
      try {
        return await ensurePlaylistSongs(playlist);
      } catch (error) {
        toast.error('Playlist content could not be loaded.');
        return null;
      }
    },
    [ensurePlaylistSongs],
  );

  return {
    ensurePlaylistSongs: safeEnsurePlaylistSongs,
  };
};

