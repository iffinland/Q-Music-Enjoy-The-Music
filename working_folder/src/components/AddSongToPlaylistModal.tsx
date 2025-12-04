import ShortUniqueId from 'short-unique-id';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Compressor from 'compressorjs';
import { useDispatch, useSelector } from 'react-redux';

import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import useAddSongToPlaylistModal from '../hooks/useAddSongToPlaylistModal';
import { RootState } from '../state/store';
import {
  PlayList,
  SongReference,
  addToPlaylistHashMap,
  upsertMyPlaylists,
  upsertPlaylists,
} from '../state/features/globalSlice';
import { Song } from '../types';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { removeTrailingUnderscore } from '../utils/extra';
import { useFetchSongs } from '../hooks/fetchSongs';
import { qdnClient } from '../state/api/client';

const uid = new ShortUniqueId();

interface CreatePlaylistForm {
  title: string;
  description: string;
  image: FileList | null;
}

const sanitizeTitle = (value: string | null | undefined) => {
  if (!value) return '';
  const underscored = value.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  const sliced = underscored.slice(0, 25);
  return removeTrailingUnderscore(sliced);
};

const convertSongToReference = (song: Song): SongReference => ({
  identifier: song.id,
  name: song.name,
  service: song.service || 'AUDIO',
  title: song.title,
  author: song.author || '',
});

const AddSongToPlaylistModal: React.FC = () => {
  const dispatch = useDispatch();
  const { getMyPlaylists } = useFetchSongs();
  const { isOpen, song, onClose } = useAddSongToPlaylistModal();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);

  const [isCreating, setIsCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<CreatePlaylistForm>({
    defaultValues: {
      title: '',
      description: '',
      image: null,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (username && myPlaylists.length === 0 && !isLoadingPlaylists) {
        setIsLoadingPlaylists(true);
        getMyPlaylists()
          .catch(() => {
            toast.error('Failed to load your playlists');
          })
          .finally(() => setIsLoadingPlaylists(false));
      }
    } else {
      reset({ title: '', description: '', image: null });
      setIsCreating(false);
      setAddingTo(null);
    }
  }, [isOpen, username, myPlaylists.length, getMyPlaylists, reset, isLoadingPlaylists]);

  const handleModalChange = (open: boolean) => {
    if (!open) {
      reset({ title: '', description: '', image: null });
      setIsCreating(false);
      setAddingTo(null);
      onClose();
    }
  };

  const compressImg = useCallback(async (img: File): Promise<string | null> => {
    try {
      let compressedFile: File | undefined;

      await new Promise<void>((resolve) => {
        new Compressor(img, {
          quality: 0.6,
          maxWidth: 300,
          mimeType: 'image/webp',
          success(result) {
            compressedFile = new File([result], 'cover.webp', {
              type: 'image/webp',
            });
            resolve();
          },
          error() {
            resolve();
          },
        });
      });

      if (!compressedFile) return null;
      const dataURI = await toBase64(compressedFile);
      if (!dataURI || typeof dataURI !== 'string') return null;
      const base64Data = dataURI.split(',')[1];
      return base64Data;
    } catch (error) {
      return null;
    }
  }, []);

  const ensurePlaylistData = useCallback(
    async (playlist: PlayList): Promise<PlayList> => {
      const cached = playlistHash[playlist.id];
      if (cached && cached.songs && cached.songs.length) {
        return cached;
      }

      const playlistOwner = playlist.user;
      if (!playlistOwner) {
        throw new Error('Playlist owner is missing');
      }

      const response = await qdnClient.fetchResource({
        name: playlistOwner,
        service: 'PLAYLIST',
        identifier: playlist.id,
      });
      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to fetch playlist data');
      }
      const incomingTitle =
        response?.title ??
        response?.metadata?.title ??
        playlist.title ??
        'Untitled playlist';
      const incomingDescription =
        response?.description ??
        response?.metadata?.description ??
        playlist.description ??
        '';
      const incomingSongs = Array.isArray(response?.songs) ? response.songs : playlist.songs ?? [];
      const incomingImage =
        response?.image ??
        response?.metadata?.image ??
        playlist.image ??
        null;

      const combined: PlayList = {
        ...playlist,
        ...response,
        title: incomingTitle,
        description: incomingDescription,
        songs: incomingSongs,
        image: incomingImage,
      };
      dispatch(addToPlaylistHashMap(combined));
      dispatch(upsertMyPlaylists([combined]));
      dispatch(upsertPlaylists([combined]));
      return combined;
    },
    [dispatch, playlistHash],
  );

  const publishPlaylist = useCallback(
    async (
      owner: string,
      identifier: string,
      payload: any,
      title: string | null | undefined,
      description: string | null | undefined,
    ) => {
      const playlistToBase64 = await objectToBase64(payload);
      const normalizedTitle = (title ?? 'Untitled playlist').toString();
      const normalizedDescription = (description ?? '').toString();
      const safeFilenameTitle = sanitizeTitle(normalizedTitle) || identifier;
      const resources = [
        {
          name: owner,
          service: 'PLAYLIST',
          data64: playlistToBase64,
          title: normalizedTitle.slice(0, 55),
          description: normalizedDescription.slice(0, 4000),
          identifier,
          filename: `${safeFilenameTitle}.json`,
        },
      ];

      await qdnClient.publishResource({
        resources,
      });
    },
    [],
  );

  const handleCreatePlaylist: SubmitHandler<CreatePlaylistForm> = async (values) => {
    if (!song) return;
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    const rawTitle = values.title || '';
    const rawDescription = values.description || '';
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
    const imageFile = values.image?.[0] || null;

    if (!title) {
      toast.error('Playlist name is required');
      return;
    }

    setIsCreating(true);
    try {
      let compressedImg: string | null = null;
      if (imageFile) {
        compressedImg = await compressImg(imageFile);
        if (!compressedImg) {
          throw new Error('Image compression failed');
        }
      }

      const songReference = convertSongToReference(song);
      const playlistPayload = {
        songs: [songReference],
        title,
        description,
        image: compressedImg ? `data:image/webp;base64,${compressedImg}` : null,
      };

      const uniqueId = uid(8);
      const identifier = `enjoymusic_playlist_${sanitizeTitle(title) || uniqueId}_${uniqueId}`;

      await publishPlaylist(username, identifier, playlistPayload, title, description);

      const createdAt = Date.now();
      const playlistMeta: PlayList = {
        id: identifier,
        created: createdAt,
        updated: createdAt,
        user: username,
        title,
        description,
        songs: playlistPayload.songs,
        image: playlistPayload.image,
      };

      dispatch(upsertPlaylists([playlistMeta]));
      dispatch(upsertMyPlaylists([playlistMeta]));
      dispatch(addToPlaylistHashMap(playlistMeta));
      toast.success('Playlist created and song added!');
      reset({ title: '', description: '', image: null });
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create playlist');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddToExisting = useCallback(
    async (playlist: PlayList) => {
      if (!song) return;
      if (!username) {
        toast.error('Log in to continue');
        return;
      }

      setAddingTo(playlist.id);
      try {
        const fullPlaylist = await ensurePlaylistData(playlist);
        const songs = fullPlaylist.songs || [];
        const alreadyThere = songs.some((item) => item.identifier === song.id);
        if (alreadyThere) {
          toast('Song already in playlist');
          setAddingTo(null);
          return;
        }

        const updatedSongs = [...songs, convertSongToReference(song)];
        const payload = {
          songs: updatedSongs,
          title: fullPlaylist.title || 'Untitled playlist',
          description: fullPlaylist.description || '',
          image: fullPlaylist.image || null,
        };

        await publishPlaylist(
          fullPlaylist.user || username,
          fullPlaylist.id,
          payload,
          fullPlaylist.title || 'Untitled playlist',
          fullPlaylist.description || '',
        );

        const updated = {
          ...fullPlaylist,
          songs: updatedSongs,
        };
        dispatch(addToPlaylistHashMap(updated));
        dispatch(upsertMyPlaylists([updated]));
        dispatch(upsertPlaylists([updated]));
        toast.success('Song added to playlist');
      } catch (error: any) {
        toast.error(error?.message || 'Failed to add song to playlist');
      } finally {
        setAddingTo(null);
      }
    },
    [dispatch, ensurePlaylistData, publishPlaylist, song, username],
  );

  const existingPlaylists = useMemo(() => {
    if (!username) return [];
    return myPlaylists.filter((playlist) => playlist.user === username);
  }, [myPlaylists, username]);

  const renderExistingPlaylists = () => {
    if (!username) {
      return (
        <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-4 text-sm text-sky-200/70">
          Log in to manage your playlists.
        </div>
      );
    }

    if (existingPlaylists.length === 0) {
      return (
        <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-4 text-sm text-sky-200/70">
          You have no playlists yet. Create one above to get started.
        </div>
      );
    }

    return (
      <ul className="flex max-h-72 flex-col gap-y-3 overflow-y-auto pr-1">
        {existingPlaylists.map((playlist) => {
          const cached = playlistHash[playlist.id];
          const songCount = cached?.songs?.length ?? playlist.songs?.length ?? 0;
          const displayTitle = cached?.title ?? playlist.title ?? 'Untitled playlist';
          const isSongAlreadyIncluded =
            cached?.songs?.some((item) => item.identifier === song?.id) ??
            playlist.songs?.some((item) => item.identifier === song?.id) ??
            false;

          return (
            <li
              key={playlist.id}
              className="flex flex-col gap-y-2 rounded-md border border-sky-900/60 bg-sky-950/60 px-3 py-3 text-sm text-sky-200/80 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-base font-semibold text-white">{displayTitle}</p>
                <p className="text-xs text-sky-300/70">Songs: {songCount}</p>
              </div>
              <Button
                type="button"
                disabled={addingTo === playlist.id || isSongAlreadyIncluded}
                onClick={() => handleAddToExisting(playlist)}
                className="bg-sky-800/80 text-white hover:bg-sky-700 md:w-auto"
              >
                {isSongAlreadyIncluded ? 'Already added' : addingTo === playlist.id ? 'Adding…' : 'Add to playlist'}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Modal
      title="Add song to playlist"
      description="Create a new playlist or add this song to one you already have."
      isOpen={isOpen}
      onChange={handleModalChange}
    >
      {!song ? (
        <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-4 text-sm text-sky-200/70">
          Select a song to add to playlist.
        </div>
      ) : (
        <div className="flex flex-col gap-y-6">
          <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-4 text-sm text-sky-200/80">
            <p className="text-base font-semibold text-white">{song.title}</p>
            <p className="text-xs text-sky-300/70">by {song.author || 'Unknown artist'}</p>
          </div>

          <section className="space-y-3 rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-4">
            <header>
              <h2 className="text-lg font-semibold text-white">Create new playlist</h2>
              <p className="text-xs text-sky-300/70">Add this song while creating a new playlist.</p>
            </header>
            <form className="flex flex-col gap-y-3" onSubmit={handleSubmit(handleCreatePlaylist)}>
              <Input
                id="title"
                placeholder="Playlist name"
                disabled={isCreating}
                {...register('title', { required: true, maxLength: 60 })}
              />
              <Textarea
                id="description"
                placeholder="Playlist description"
                disabled={isCreating}
                maxLength={4000}
                {...register('description', { maxLength: 4000 })}
              />
              <div>
                <p className="pb-1 text-xs text-sky-300/70">Optional cover image</p>
                <Input
                  type="file"
                  accept="image/*"
                  id="image"
                  disabled={isCreating}
                  {...register('image')}
                />
              </div>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white md:w-auto"
                disabled={isCreating}
              >
                {isCreating ? 'Creating…' : 'Create playlist with song'}
              </Button>
            </form>
          </section>

          <section className="space-y-3 rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-4">
            <header>
              <h2 className="text-lg font-semibold text-white">Your playlists</h2>
              <p className="text-xs text-sky-300/70">Add the song to an existing playlist.</p>
            </header>
            {renderExistingPlaylists()}
          </section>
        </div>
      )}
    </Modal>
  );
};

export default AddSongToPlaylistModal;
