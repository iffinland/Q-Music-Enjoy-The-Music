import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ShortUniqueId from 'short-unique-id';
import Compressor from 'compressorjs';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import { MUSIC_CATEGORIES } from '../constants/categories';
import { RootState } from '../state/store';
import useUploadFolderModal from '../hooks/useUploadFolderModal';
import { useFetchSongs } from '../hooks/fetchSongs';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { removeTrailingUnderscore } from '../utils/extra';
import {
  PlayList,
  SongReference,
  addNewSong,
  addToPlaylistHashMap,
  setImageCoverHash,
  upsertMyPlaylists,
  upsertPlaylists,
} from '../state/features/globalSlice';

const uid = new ShortUniqueId();

type FolderTrack = {
  id: string;
  file: File;
  title: string;
  artist: string;
  include: boolean;
  coverFile: File | null;
  coverPreview: string | null;
};

type UploadFolderFormValues = {
  albumTitle: string;
  albumArtist: string;
  category: string;
  language: string;
  notes: string;
  playlistId: string;
  newPlaylistTitle: string;
};
const DEFAULT_VALUES: UploadFolderFormValues = {
  albumTitle: '',
  albumArtist: '',
  category: '',
  language: '',
  notes: '',
  playlistId: '',
  newPlaylistTitle: '',
};

const readFilePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const formatTitleFromFilename = (fileName: string) => {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[_-]+/g, ' ').trim() || fileName;
};

const UploadFolderModal: React.FC = () => {
  const folderModal = useUploadFolderModal();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const { getMyPlaylists } = useFetchSongs();
  const [tracks, setTracks] = useState<FolderTrack[]>([]);
  const [albumImagePreview, setAlbumImagePreview] = useState<string | null>(null);
  const [albumImageFile, setAlbumImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const albumImageInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UploadFolderFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!folderModal.isOpen) return;
    if (!username) return;
    if (isLoadingPlaylists) return;
    if (myPlaylists.length > 0) return;

    setIsLoadingPlaylists(true);
    getMyPlaylists()
      .catch(() => toast.error('Failed to load your playlists.'))
      .finally(() => setIsLoadingPlaylists(false));
  }, [
    folderModal.isOpen,
    username,
    isLoadingPlaylists,
    myPlaylists.length,
    getMyPlaylists,
  ]);

  const availablePlaylists = useMemo(() => {
    if (!username) return [];
    return myPlaylists
      .filter((playlist) => playlist.user === username)
      .map((playlist) => playlistHash[playlist.id] ?? playlist);
  }, [myPlaylists, playlistHash, username]);

  const selectedTracks = useMemo(
    () => tracks.filter((track) => track.include),
    [tracks],
  );

  const playlistOptions = useMemo(() => {
    return availablePlaylists.map((playlist) => ({
      id: playlist.id,
      label: playlist.title?.trim() || 'Untitled playlist',
    }));
  }, [availablePlaylists]);

  const sanitizeMetadataValue = useCallback((value?: string) => {
    if (!value) return '';
    return value.replace(/[;=]/g, ' ').trim();
  }, []);

  const sanitizeTitleForIdentifier = useCallback((value: string) => {
    if (!value) return '';
    const underscored = value.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
    return removeTrailingUnderscore(underscored);
  }, []);

  const compressImg = useCallback(
    async (img: File): Promise<string | null> => {
      try {
        let compressedFile: File | undefined;
        await new Promise<void>((resolve) => {
          new Compressor(img, {
            quality: 0.6,
            maxWidth: 600,
            maxHeight: 600,
            mimeType: 'image/webp',
            success(result) {
              compressedFile = new File([result], 'cover.webp', { type: 'image/webp' });
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
        const [, base64Data] = dataURI.split(',');
        return base64Data || null;
      } catch (error) {
        console.error('Failed to compress image', error);
        return null;
      }
    },
    [],
  );

  const buildSongReference = useCallback(
    (songId: string, songTitle: string, songAuthor: string): SongReference => ({
      identifier: songId,
      name: username ?? '',
      service: 'AUDIO',
      title: songTitle || '',
      author: songAuthor || '',
    }),
    [username],
  );

  const ensurePlaylistData = useCallback(
    async (playlist: PlayList): Promise<PlayList> => {
      const cached = playlistHash[playlist.id];
      if (cached?.songs && cached.songs.length) {
        return cached;
      }

      const response = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: playlist.user,
        service: 'PLAYLIST',
        identifier: playlist.id,
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to fetch playlist data');
      }

      const combined: PlayList = {
        ...playlist,
        ...response,
        title:
          response?.title ??
          response?.metadata?.title ??
          playlist.title ??
          'Untitled playlist',
        description:
          response?.description ??
          response?.metadata?.description ??
          playlist.description ??
          '',
        songs: Array.isArray(response?.songs)
          ? response.songs
          : playlist.songs ?? [],
        image:
          response?.image ??
          response?.metadata?.image ??
          playlist.image ??
          null,
      };

      dispatch(addToPlaylistHashMap(combined));
      dispatch(upsertMyPlaylists([combined]));
      dispatch(upsertPlaylists([combined]));
      return combined;
    },
    [dispatch, playlistHash],
  );

  const publishPlaylistUpdate = useCallback(
    async (
      owner: string,
      identifier: string,
      payload: any,
      title: string,
      description: string,
    ) => {
      const playlistToBase64 = await objectToBase64(payload);
      const sanitizedTitle = sanitizeTitleForIdentifier(title || '');
      const filenameBase = sanitizedTitle || identifier;
      const resources = [
        {
          name: owner,
          service: 'PLAYLIST',
          data64: playlistToBase64,
          title: (title || '').slice(0, 55),
          description: (description || '').slice(0, 4000),
          identifier,
          filename: `${filenameBase}.json`,
        },
      ];

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });
    },
    [sanitizeTitleForIdentifier],
  );

  const updatePlaylistWithSong = useCallback(
    async (
      playlistId: string,
      songId: string,
      songTitle: string,
      songAuthor: string,
    ) => {
      const basePlaylist =
        availablePlaylists.find((playlist) => playlist?.id === playlistId) ||
        playlistHash[playlistId];
      if (!basePlaylist) {
        throw new Error('Playlist not found');
      }

      const fullPlaylist = await ensurePlaylistData(basePlaylist);
      const existingSongs = Array.isArray(fullPlaylist.songs)
        ? fullPlaylist.songs
        : [];

      if (existingSongs.some((entry) => entry.identifier === songId)) {
        return fullPlaylist;
      }

      const updatedSongs = [
        ...existingSongs,
        buildSongReference(songId, songTitle, songAuthor),
      ];

      const payload = {
        songs: updatedSongs,
        title: fullPlaylist.title || 'Untitled playlist',
        description: fullPlaylist.description || '',
        image: fullPlaylist.image || null,
      };

      await publishPlaylistUpdate(
        fullPlaylist.user || username || '',
        fullPlaylist.id,
        payload,
        payload.title,
        payload.description,
      );

      const updatedPlaylist: PlayList = {
        ...fullPlaylist,
        songs: updatedSongs,
        image: payload.image,
      };
      dispatch(addToPlaylistHashMap(updatedPlaylist));
      dispatch(upsertMyPlaylists([updatedPlaylist]));
      dispatch(upsertPlaylists([updatedPlaylist]));

      return updatedPlaylist;
    },
    [
      availablePlaylists,
      buildSongReference,
      dispatch,
      ensurePlaylistData,
      playlistHash,
      publishPlaylistUpdate,
      username,
    ],
  );

  const resetState = useCallback(() => {
    reset(DEFAULT_VALUES);
    setTracks([]);
    setAlbumImageFile(null);
    setAlbumImagePreview(null);
    setIsLoading(false);
  }, [reset]);

  const handleClose = useCallback(() => {
    resetState();
    folderModal.close();
  }, [folderModal, resetState]);

  const buildTracksFromFiles = useCallback((files: File[]): FolderTrack[] => {
    return files.map((file, index) => ({
      id: `${file.name}-${index}-${file.lastModified}`,
      file,
      title: formatTitleFromFilename(file.name),
      artist: '',
      include: true,
      coverFile: null,
      coverPreview: null,
    }));
  }, []);

  const processSelectedFiles = useCallback(
    (fileList: FileList | null, source: 'folder' | 'files') => {
      const files = Array.from(fileList || []);
      if (!files.length) {
        setTracks([]);
        return;
      }

      const audioFiles = files.filter((file) => {
        if (file.type.startsWith('audio/')) return true;
        return /\.(mp3|wav|ogg|flac|m4a)$/i.test(file.name);
      });

      if (!audioFiles.length) {
        setTracks([]);
        toast.error('No audio files detected in your selection.');
        return;
      }

      const mapped = buildTracksFromFiles(audioFiles);
      setTracks(mapped);
      toast.success(
        `${mapped.length} audio file${mapped.length === 1 ? '' : 's'} imported via ${
          source === 'folder' ? 'folder' : 'file picker'
        }.`,
      );
    },
    [buildTracksFromFiles],
  );

  const handleFolderSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      processSelectedFiles(event.target.files, 'folder');
      event.target.value = '';
    },
    [processSelectedFiles]
  );

  const handleFilesSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      processSelectedFiles(event.target.files, 'files');
      event.target.value = '';
    },
    [processSelectedFiles]
  );

  const handleAlbumImageSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setAlbumImageFile(null);
        setAlbumImagePreview(null);
        return;
      }

      try {
        const preview = await readFilePreview(file);
        setAlbumImageFile(file);
        setAlbumImagePreview(preview);
        event.target.value = '';
      } catch (error) {
        console.error('Failed to read album image', error);
        toast.error('Unable to load album image preview.');
      }
    },
    []
  );

  const handleTrackCoverSelection = useCallback(
    async (trackId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const preview = await readFilePreview(file);
        setTracks((prev) =>
          prev.map((track) =>
            track.id === trackId
              ? { ...track, coverFile: file, coverPreview: preview }
              : track
          )
        );
      } catch (error) {
        console.error('Failed to read cover image', error);
        toast.error('Unable to load track cover preview.');
      } finally {
        event.target.value = '';
      }
    },
    []
  );

  const handleTrackFieldChange = useCallback(
    (trackId: string, field: 'title' | 'artist', value: string) => {
      setTracks((prev) =>
        prev.map((track) =>
          track.id === trackId ? { ...track, [field]: value } : track
        )
      );
    },
    []
  );

  const handleTrackIncludeToggle = useCallback((trackId: string, checked: boolean) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, include: checked } : track
      )
    );
  }, []);

  const toggleAllTracks = useCallback((include: boolean) => {
    setTracks((prev) => prev.map((track) => ({ ...track, include })));
  }, []);

  const onSubmit: SubmitHandler<UploadFolderFormValues> = async (values) => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    if (!tracks.length) {
      toast.error('Select a folder that contains audio files before publishing.');
      return;
    }

    if (!selectedTracks.length) {
      toast.error('Select at least one track from the folder to publish.');
      return;
    }

    const albumTitle = values.albumTitle?.trim() || '';
    const albumArtist = values.albumArtist?.trim() || '';
    const category = sanitizeMetadataValue(values.category);
    const language = sanitizeMetadataValue(values.language);
    const notes = sanitizeMetadataValue(values.notes);
    const playlistId = values.playlistId || '';
    const createPlaylistTitle = values.newPlaylistTitle?.trim() || '';

    if (!category) {
      toast.error('Please choose a category for the album.');
      return;
    }

    if (!albumImageFile && tracks.some((track) => !track.coverFile)) {
      toast.error('Please select an album image or provide a cover for every track.');
      return;
    }

    setIsLoading(true);

    try {
      let albumImageBase64: string | null = null;
      if (albumImageFile) {
        albumImageBase64 = await compressImg(albumImageFile);
        if (!albumImageBase64) {
          toast.error('Failed to process album image.');
          return;
        }
      }

      const resources: any[] = [];
      const publishedSongs: Array<{
        identifier: string;
        title: string;
        author: string;
        description: string;
        coverBase64: string | null;
      }> = [];

      for (const track of selectedTracks) {
        const safeTitle = track.title.trim() || formatTitleFromFilename(track.file.name);
        const safeArtist = track.artist.trim() || albumArtist;

        const metadataPairs: string[] = [];
        if (safeTitle) metadataPairs.push(`title=${sanitizeMetadataValue(safeTitle)}`);
        if (safeArtist) metadataPairs.push(`author=${sanitizeMetadataValue(safeArtist)}`);
        if (category) {
          metadataPairs.push(`genre=${category}`);
          metadataPairs.push(`category=${category}`);
        }
        if (language) metadataPairs.push(`language=${language}`);
        if (notes) metadataPairs.push(`notes=${notes}`);

        const description = metadataPairs.join(';');
        const sanitizedSegment =
          sanitizeTitleForIdentifier(safeTitle).slice(0, 20) || `folder_${uid(6)}`;
        const identifier = `enjoymusic_song_${sanitizedSegment}_${uid(6)}`;
        const audioExtension = track.file.name.split('.').pop() || 'audio';
        const filenameBase = sanitizedSegment || identifier;
        const filename = `${filenameBase}.${audioExtension}`;

        resources.push({
          name: username,
          service: 'AUDIO',
          file: track.file,
          title: safeTitle,
          description,
          identifier,
          filename,
        });

        let coverBase64 = albumImageBase64;
        if (track.coverFile) {
          coverBase64 = await compressImg(track.coverFile);
          if (!coverBase64) {
            throw new Error(`Failed to process cover for ${safeTitle}`);
          }
        }

        if (coverBase64) {
          resources.push({
            name: username,
            service: 'THUMBNAIL',
            data64: coverBase64,
            identifier,
          });
        }

        publishedSongs.push({
          identifier,
          title: safeTitle,
          author: safeArtist,
          description,
          coverBase64,
        });
      }

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });

      const now = Date.now();
      publishedSongs.forEach((song) => {
        const songData = {
          title: song.title,
          description: song.description,
          created: now,
          updated: now,
          name: username,
          id: song.identifier,
          author: song.author,
          service: 'AUDIO',
        };
        dispatch(addNewSong(songData));
        if (song.coverBase64) {
          dispatch(
            setImageCoverHash({
              url: 'data:image/webp;base64,' + song.coverBase64,
              id: song.identifier,
            }),
          );
        }
      });

      if (playlistId) {
        for (const song of publishedSongs) {
          try {
            await updatePlaylistWithSong(playlistId, song.identifier, song.title, song.author);
          } catch (playlistError) {
            console.error('Failed to add song to playlist', playlistError);
            toast.error('Some songs could not be added to the selected playlist.');
            break;
          }
        }
      }

      if (createPlaylistTitle) {
        const playlistSongs = publishedSongs.map((song) =>
          buildSongReference(song.identifier, song.title, song.author),
        );
        const playlistDescription = notes
          ? notes.slice(0, 4000)
          : `Album "${albumTitle || 'Untitled'}" by ${albumArtist || username}`;
        const playlistIdentifierSegment =
          sanitizeTitleForIdentifier(createPlaylistTitle).slice(0, 25) ||
          `playlist_${uid(6)}`;
        const playlistIdentifier = `enjoymusic_playlist_${playlistIdentifierSegment}_${uid(
          6,
        )}`;
        const playlistPayload = {
          songs: playlistSongs,
          title: createPlaylistTitle,
          description: playlistDescription,
          image: albumImageBase64 ? 'data:image/webp;base64,' + albumImageBase64 : null,
        };

        await publishPlaylistUpdate(
          username,
          playlistIdentifier,
          playlistPayload,
          createPlaylistTitle,
          playlistDescription,
        );

        const playlistRecord: PlayList = {
          user: username,
          id: playlistIdentifier,
          songs: playlistSongs,
          title: createPlaylistTitle,
          description: playlistDescription,
          image: playlistPayload.image,
          created: now,
          updated: now,
        };
        dispatch(addToPlaylistHashMap(playlistRecord));
        dispatch(upsertMyPlaylists([playlistRecord]));
        dispatch(upsertPlaylists([playlistRecord]));
      }

      toast.success(
        `Published ${publishedSongs.length} track${
          publishedSongs.length === 1 ? '' : 's'
        } successfully.`,
      );
      handleClose();
    } catch (error) {
      console.error('Failed to publish folder', error);
      toast.error('Unable to publish folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={folderModal.isOpen}
      onChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      title="Publish audio folder"
      description="Upload an entire album or catalog at once and fine-tune each track."
      contentClassName="md:max-w-[900px]"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input
              id="albumTitle"
              placeholder="Album title"
              disabled={isLoading}
              maxLength={150}
              {...register('albumTitle', {
                required: 'Album title is required',
                maxLength: {
                  value: 150,
                  message: 'Album title must be 150 characters or fewer',
                },
              })}
            />
            {errors.albumTitle && (
              <p className="mt-1 text-xs text-red-300">
                {String(errors.albumTitle.message)}
              </p>
            )}
          </div>
          <div>
            <Input
              id="albumArtist"
              placeholder="Album singer / band"
              disabled={isLoading}
              maxLength={150}
              {...register('albumArtist', {
                required: 'Album singer or band is required',
                maxLength: {
                  value: 150,
                  message: 'Album singer / band must be 150 characters or fewer',
                },
              })}
            />
            {errors.albumArtist && (
              <p className="mt-1 text-xs text-red-300">
                {String(errors.albumArtist.message)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-sky-200/80 mb-2">
              Select a category
            </label>
            <select
              className="w-full rounded-xl border border-qm-border bg-qm-surface-200/80 px-4 py-3 text-sm text-qm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-qm-primary focus-visible:ring-offset-2 focus-visible:ring-offset-qm-surface"
              disabled={isLoading}
              {...register('category')}
            >
              <option value="">Choose a category</option>
              {MUSIC_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Input
              id="language"
              placeholder="Language (optional)"
              disabled={isLoading}
              maxLength={80}
              {...register('language', {
                maxLength: {
                  value: 80,
                  message: 'Language must be 80 characters or fewer',
                },
              })}
            />
            {errors.language && (
              <p className="mt-1 text-xs text-red-300">
                {String(errors.language.message)}
              </p>
            )}
          </div>
        </div>

        <Textarea
          id="notes"
          placeholder="Additional notes, instruments, credits..."
          disabled={isLoading}
          className="h-28 resize-none"
          maxLength={4000}
          {...register('notes', {
            maxLength: {
              value: 4000,
              message: 'Additional notes can be at most 4000 characters',
            },
          })}
        />
        {errors.notes && (
          <p className="mt-1 text-xs text-red-300">{String(errors.notes.message)}</p>
        )}

        <div className="rounded-xl border border-sky-900/60 bg-sky-950/50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Add to your playlist</p>
              <p className="text-xs text-sky-300/70">
                Choose an existing playlist for the entire folder.
              </p>
            </div>
            <div className="w-full md:w-60">
              <select
                className="w-full rounded-xl border border-qm-border bg-qm-surface-200/80 px-3 py-2 text-sm text-qm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-qm-primary focus-visible:ring-offset-2 focus-visible:ring-offset-qm-surface"
                disabled={isLoading || (!playlistOptions.length && !isLoadingPlaylists)}
                {...register('playlistId')}
              >
                <option value="">
                  {isLoadingPlaylists
                    ? 'Loading playlists...'
                    : playlistOptions.length
                      ? 'Select playlist'
                      : 'No playlists found'}
                </option>
                {playlistOptions.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-white">
              ...or create a new playlist from these files
            </p>
            <Input
              id="newPlaylistTitle"
              placeholder="New playlist title"
              disabled={isLoading}
              maxLength={150}
              {...register('newPlaylistTitle', {
                maxLength: {
                  value: 150,
                  message: 'Playlist title can be at most 150 characters',
                },
              })}
            />
            {errors.newPlaylistTitle && (
              <p className="mt-1 text-xs text-red-300">
                {String(errors.newPlaylistTitle.message)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-sky-900/60 bg-sky-950/40 p-4">
            <p className="text-sm font-semibold text-white mb-2">Select folder</p>
            <p className="text-xs text-sky-300/70 mb-4">
              Choose a folder (we scan it automatically) or pick the audio files manually.
            </p>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept="audio/*"
              className="hidden"
              onChange={handleFolderSelection}
              // @ts-ignore: directory upload attribute is not part of the standard DOM typings.
              webkitdirectory=""
              // @ts-ignore
              directory=""
            />
            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept="audio/*"
              className="hidden"
              onChange={handleFilesSelection}
            />
            <Button
              type="button"
              disabled={isLoading}
              onClick={() => folderInputRef.current?.click()}
              className="w-full"
            >
              Browse folder
            </Button>
            <div className="mt-2">
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => filesInputRef.current?.click()}
                className="w-full"
              >
                Select audio files
              </Button>
            </div>
            <p className="mt-3 text-xs text-sky-300/80">
              {tracks.length
                ? `${tracks.length} audio file${tracks.length === 1 ? '' : 's'} selected.`
                : 'No audio files selected yet.'}
            </p>
          </div>

          <div className="rounded-xl border border-sky-900/60 bg-sky-950/40 p-4">
            <p className="text-sm font-semibold text-white mb-2">Select album image</p>
            <p className="text-xs text-sky-300/70 mb-4">
              Optional cover art that will be applied to tracks without their own image.
            </p>
            <input
              ref={albumImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAlbumImageSelection}
            />
            <Button
              type="button"
              disabled={isLoading}
              onClick={() => albumImageInputRef.current?.click()}
              className="w-full"
            >
              Choose album art
            </Button>
            {albumImagePreview && (
              <img
                src={albumImagePreview}
                alt="Album cover preview"
                className="mt-4 h-32 w-full rounded-md object-cover"
              />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-sky-900/60 bg-sky-950/60 p-4">
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Selected tracks ({selectedTracks.length}/{tracks.length})
              </p>
              <p className="text-xs text-sky-300/70">
                Update titles, singers, and optional cover art for each file.
              </p>
            </div>
            {tracks.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-md border border-sky-800/70 bg-sky-900/60 px-3 py-1 font-semibold text-sky-100 transition hover:bg-sky-800/60"
                  onClick={() => toggleAllTracks(true)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="rounded-md border border-sky-800/70 bg-sky-900/60 px-3 py-1 font-semibold text-sky-100 transition hover:bg-sky-800/60"
                  onClick={() => toggleAllTracks(false)}
                >
                  Deselect all
                </button>
              </div>
            )}
          </div>
          {tracks.length === 0 && (
            <div className="rounded-md border border-dashed border-sky-800/70 bg-sky-950/40 p-6 text-center text-sm text-sky-300/70">
              No tracks loaded yet. Select a folder to begin.
            </div>
          )}
          {tracks.length > 0 && (
            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="rounded-xl border border-sky-900/60 bg-sky-950/70 p-4"
                >
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-300/80">
                      Track {index + 1}: {track.file.name}
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-sky-100">
                      <input
                        type="checkbox"
                        checked={track.include}
                        disabled={isLoading}
                        onChange={(event) =>
                          handleTrackIncludeToggle(track.id, event.target.checked)
                        }
                        className="h-4 w-4 rounded border-sky-800/70 bg-sky-950/60 text-qm-primary focus:ring-qm-primary"
                      />
                      Include in upload
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Input
                        value={track.title}
                        disabled={isLoading}
                        onChange={(event) =>
                          handleTrackFieldChange(track.id, 'title', event.target.value)
                        }
                        placeholder="Track title"
                      />
                    </div>
                    <div>
                      <Input
                        value={track.artist}
                        disabled={isLoading}
                        onChange={(event) =>
                          handleTrackFieldChange(track.id, 'artist', event.target.value)
                        }
                        placeholder="Track singer / band"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="text-xs text-sky-300/70">
                      <p className="font-semibold text-white mb-2">Custom cover (optional)</p>
                      <p>
                        Upload a unique cover for this track. Leave empty to fall back to the
                        album image.
                      </p>
                    </div>
                    <div>
                      <label className="inline-flex items-center gap-2 rounded-md border border-sky-800/70 bg-sky-900/50 px-3 py-2 text-xs font-semibold text-sky-200/80 hover:bg-sky-800/60 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleTrackCoverSelection(track.id, event)}
                        />
                        Upload cover
                      </label>
                    </div>
                  </div>
                  {track.coverPreview && (
                    <img
                      src={track.coverPreview}
                      alt={`${track.title} cover`}
                      className="mt-3 h-32 w-full rounded-md object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" disabled={isLoading || selectedTracks.length === 0}>
          {tracks.length === 0
            ? 'Select audio folder first'
            : selectedTracks.length === 0
              ? 'Choose tracks to publish'
              : `Publish ${selectedTracks.length} track${selectedTracks.length === 1 ? '' : 's'}`}
        </Button>
      </form>
    </Modal>
  );
};

export default UploadFolderModal;
