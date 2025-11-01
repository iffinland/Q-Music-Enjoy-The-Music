import ShortUniqueId from 'short-unique-id'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from "react-hot-toast";
import Compressor from 'compressorjs'



import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import Textarea from './TextArea';
import useUploadModal from "../hooks/useUploadModal";
import { useDispatch, useSelector } from 'react-redux';
import { setNotification } from '../state/features/notificationsSlice';
import { RootState } from '../state/store';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import {
  PlayList,
  SongMeta,
  SongReference,
  addNewSong,
  addToPlaylistHashMap,
  setImageCoverHash,
  upsertMyLibrary,
  upsertMyPlaylists,
  upsertPlaylists,
} from '../state/features/globalSlice';
import { removeTrailingUnderscore } from '../utils/extra';
import { useNavigate } from 'react-router-dom';
import { MUSIC_CATEGORIES } from '../constants/categories';
import { getQdnResourceUrl } from '../utils/qortalApi';
import { useFetchSongs } from '../hooks/fetchSongs';
import likeImg from '../assets/img/enjoy-music.jpg';
import { Song } from '../types';

const DEFAULT_FORM_VALUES = {
  author: '',
  title: '',
  song: null,
  image: null,
  genre: '',
  mood: '',
  language: '',
  notes: '',
};

const uid = new ShortUniqueId()

const UploadModal = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name)
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const [isPlaylistDropdownOpen, setIsPlaylistDropdownOpen] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const { getMyPlaylists } = useFetchSongs();

  const uploadModal = useUploadModal();
  const editingSong = uploadModal.songToEdit as SongMeta | null;
  const isEditMode = Boolean(editingSong);
  const navigate = useNavigate();
  const successRedirectDelay = 1600;
  const successTimeoutRef = useRef<number | null>(null);

  const sanitizeMetadataValue = (value?: string) => {
    if (!value) return '';
    return value.replace(/[;=]/g, ' ').trim();
  };

  const parseDescriptionMetadata = useCallback((description?: string | null) => {
    const result: Record<string, string> = {};
    if (!description || typeof description !== 'string') return result;
    const pairs = description.split(';');
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey || !rawValue) continue;
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.trim();
      if (!key || !value) continue;
      result[key] = value;
    }
    return result;
  }, []);

  const sanitizeTitleForIdentifier = useCallback((value: string) => {
    if (!value) return '';
    const underscored = value.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
    return removeTrailingUnderscore(underscored);
  }, []);

  const fetchExistingAudioFile = useCallback(async (): Promise<File | null> => {
    if (!editingSong?.name || !editingSong?.id) return null;
    try {
      const url = await getQdnResourceUrl('AUDIO', editingSong.name, editingSong.id);
      if (!url) return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const extension = blob.type ? blob.type.split('/').pop() || 'audio' : 'audio';
      const fileName = `${sanitizeTitleForIdentifier(editingSong.title || editingSong.id) || editingSong.id}.${extension}`;
      return new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
    } catch (error) {
      console.error('Failed to fetch existing audio file', error);
      return null;
    }
  }, [editingSong, sanitizeTitleForIdentifier]);

  const fetchExistingThumbnailBase64 = useCallback(async (): Promise<string | null> => {
    if (!editingSong?.name || !editingSong?.id) return null;
    try {
      const url = await getQdnResourceUrl('THUMBNAIL', editingSong.name, editingSong.id);
      if (!url || url === 'Resource does not exist') return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const file = new File([blob], 'cover.webp', { type: blob.type || 'image/webp' });
      const dataURI = await toBase64(file);
      if (!dataURI || typeof dataURI !== 'string') return null;
      const [, base64Data] = dataURI.split(',');
      return base64Data || null;
    } catch (error) {
      console.error('Failed to fetch existing thumbnail', error);
      return null;
    }
  }, [editingSong, toBase64]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!uploadModal.isSingleOpen) return;
    if (!username) return;
    if (isLoadingPlaylists) return;
    if (myPlaylists.length > 0) return;

    setIsLoadingPlaylists(true);
    getMyPlaylists()
      .catch(() => {
        toast.error('Failed to load your playlists.');
      })
      .finally(() => setIsLoadingPlaylists(false));
  }, [
    uploadModal.isSingleOpen,
    username,
    myPlaylists.length,
    getMyPlaylists,
    isLoadingPlaylists,
  ]);


  const initialFormValues = useMemo(() => ({ ...DEFAULT_FORM_VALUES }), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: initialFormValues,
  });

  useEffect(() => {
    if (!uploadModal.isSingleOpen) return;

    if (isEditMode && editingSong) {
      const metadata = parseDescriptionMetadata(editingSong.description);
      reset({
        author: editingSong.author || '',
        title: editingSong.title || '',
        song: null,
        image: null,
        genre: metadata.genre || '',
        mood: metadata.mood || '',
        language: metadata.language || '',
        notes: metadata.notes || '',
      });
    } else {
      reset(initialFormValues);
    }

    setSelectedPlaylistId(null);
    setIsPlaylistDropdownOpen(false);
  }, [
    uploadModal.isSingleOpen,
    isEditMode,
    editingSong,
    parseDescriptionMetadata,
    reset,
    initialFormValues,
  ]);

  const availablePlaylists = useMemo(() => {
    if (!username) return [];
    return myPlaylists
      .filter((playlist) => playlist.user === username)
      .map((playlist) => playlistHash[playlist.id] ?? playlist);
  }, [myPlaylists, playlistHash, username]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return (
      availablePlaylists.find((playlist) => playlist.id === selectedPlaylistId) ||
      null
    );
  }, [availablePlaylists, selectedPlaylistId]);

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
          description: (description || '').slice(0, 140),
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
        availablePlaylists.find((playlist) => playlist.id === playlistId) ||
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

  const onChange = (open: boolean) => {
    if (!open) {
      reset(initialFormValues);
      setSelectedPlaylistId(null);
      setIsPlaylistDropdownOpen(false);
      uploadModal.closeSingle();
    }
  }

  const compressImg = async (img: File)=> {
    try {
      const image = img
      let compressedFile: File | undefined

      await new Promise<void>((resolve) => {
        new Compressor(image, {
          quality: 0.6,
          maxWidth: 300,
          mimeType: 'image/webp',
          success(result) {
            const file = new File([result], 'name', {
              type: 'image/webp'
            })
            compressedFile = file
            resolve()
          },
          error(compressionError) {
            console.error('Image compression failed', compressionError);
            resolve();
          }
        })
      })
      if (!compressedFile) return
      const dataURI = await toBase64(compressedFile)
      if(!dataURI || typeof dataURI !== 'string') throw new Error('invalid image')
      const base64Data = dataURI?.split(',')[1];
      return base64Data
    } catch (error) {
      console.error(error)
    }
  }


  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    try {
      if(!username){
        toast.error('Log in to continue')
        return;
      }

      if(!values.image?.[0] && !isEditMode){
        toast.error('Please attach an image cover')
        return;
      }

      const imageFile = (values.image?.[0] as File) || null;
      const songFile = values.song?.[0];
      if(!songFile && !isEditMode){
        toast.error('Please attach an audio file')
        return;
      }
      const title = (values.title as string)?.trim() || '';
      const author = (values.author as string)?.trim() || '';
      const genre = sanitizeMetadataValue(values.genre);
      const mood = sanitizeMetadataValue(values.mood);
      const language = sanitizeMetadataValue(values.language);
      const notes = sanitizeMetadataValue(values.notes);

      const publisherName = isEditMode && editingSong ? editingSong.name : username;
      if (!publisherName) {
        toast.error('Publisher information missing');
        return;
      }

      if (!username) {
        toast.error('Missing required fields')
        return;
      }

      if (!genre) {
        toast.error('Please choose a category')
        return;
      }

      let playlistAdded = false;
      const playlistIdToAttach = !isEditMode ? selectedPlaylistId : null;

      setIsLoading(true);

      const songError = null
      const imageError = null

      try {
        const compressedImg = imageFile ? await compressImg(imageFile) : null;
        if (imageFile && !compressedImg) {
          toast.error('Image compression Error')
          setIsLoading(false);
          return;
        }

        const safeTitle = title || editingSong?.title || 'Untitled song';
        const safeAuthor = author || editingSong?.author || '';

        let identifier = '';
        let identifierSegment = '';
        if (isEditMode && editingSong) {
          identifier = editingSong.id;
          identifierSegment =
            sanitizeTitleForIdentifier(editingSong.title || editingSong.id)
              .slice(0, 20) || editingSong.id;
        } else {
          const uniqueId = uid(8);
          const sanitizedTitleSegment = sanitizeTitleForIdentifier(safeTitle).slice(0, 20);
          identifierSegment = sanitizedTitleSegment || `song_${uniqueId}`;
          identifier = `enjoymusic_song_${identifierSegment}_${uniqueId}`;
        }

        const metadataPairs: string[] = [];
        if (safeTitle) metadataPairs.push(`title=${sanitizeMetadataValue(safeTitle)}`);
        if (safeAuthor) metadataPairs.push(`author=${sanitizeMetadataValue(safeAuthor)}`);
        if (genre) metadataPairs.push(`genre=${genre}`);
        if (mood) metadataPairs.push(`mood=${mood}`);
        if (language) metadataPairs.push(`language=${language}`);
        if (notes) metadataPairs.push(`notes=${notes}`);

        const description = metadataPairs.join(';');

        let audioFileToPublish: File | null = songFile || null;
        if (!audioFileToPublish && isEditMode) {
          audioFileToPublish = await fetchExistingAudioFile();
        }
        if (!audioFileToPublish) {
          toast.error('Failed to resolve audio file for publishing.');
          setIsLoading(false);
          return;
        }

        let thumbnailBase64 = compressedImg;
        if (!thumbnailBase64 && isEditMode) {
          thumbnailBase64 = await fetchExistingThumbnailBase64();
        }

        const audioExtension = audioFileToPublish.name.split('.').pop() || 'audio';
        const filenameBase =
          sanitizeTitleForIdentifier(safeTitle).slice(0, 20) || identifierSegment || identifier;
        const filename = `${filenameBase}.${audioExtension}`
        const resources = [
          {
            name: publisherName,
            service: 'AUDIO',
            file: audioFileToPublish,
            title: safeTitle,
            description,
            identifier,
            filename
          },
        ] as any[];

        if (thumbnailBase64) {
          resources.push({
            name: publisherName,
            service: 'THUMBNAIL',
            data64: thumbnailBase64,
            identifier,
          });
        }

        const multiplePublish = {
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources,
        }
        await qortalRequest(multiplePublish)

        const createdTimestamp = editingSong?.created ?? Date.now();
        const updatedTimestamp = Date.now();

        const songData =  {
          title: safeTitle,
          description: description,
          created: createdTimestamp,
          updated: updatedTimestamp,
          name: publisherName,
          id: identifier,
          author: safeAuthor,
          service: editingSong?.service || 'AUDIO',
          status: editingSong?.status,
        }
        const librarySong: Song = {
          id: identifier,
          title: safeTitle,
          name: publisherName,
          author: safeAuthor,
          service: editingSong?.service || 'AUDIO',
          status: editingSong?.status,
        };

        if (isEditMode) {
          dispatch(upsertMyLibrary([librarySong]));
        } else {
          dispatch(addNewSong(songData));
        }
        if (compressedImg) {
          dispatch(setImageCoverHash({ url: 'data:image/webp;base64,' + compressedImg, id: identifier }));
        }

        if (!isEditMode && playlistIdToAttach) {
          try {
            await updatePlaylistWithSong(
              playlistIdToAttach,
              identifier,
              safeTitle,
              safeAuthor,
            );
            playlistAdded = true;
          } catch (playlistError) {
            console.error(
              'Song published but adding to playlist failed',
              playlistError,
            );
            toast.error('Song published, but adding to the playlist failed.');
          }
        }
      } catch (error: unknown) {
        let notificationObj = null
        if (typeof error === 'string') {
          notificationObj = {
            msg: error || 'Failed to publish audio',
            alertType: 'error'
          }
        } else if (typeof error === 'object' && error !== null) {
          const maybeError = error as { error?: string; message?: string };
          if (typeof maybeError.error === 'string') {
            notificationObj = {
              msg: maybeError.error,
              alertType: 'error',
            };
          } else if (typeof maybeError.message === 'string') {
            notificationObj = {
              msg: maybeError.message,
              alertType: 'error',
            };
          }
        }
        if (notificationObj) {
          dispatch(setNotification(notificationObj))
        } else {
          console.error('Failed to publish audio', error)
        }
      
      }
     

      if (songError) {
        setIsLoading(false);
        return toast.error('Failed song publish');
      }

    

      if (imageError) {
        setIsLoading(false);
        return toast.error('Failed image publish');
      }

      
  
      
    
      setIsLoading(false);
      const successMessage = isEditMode
        ? 'Song updated successfully! Redirects...'
        : playlistAdded
          ? 'Song published and added to playlist! Redirects...'
          : 'The song was published successfully! Redirects...';
      toast.success(successMessage, { duration: successRedirectDelay });
      successTimeoutRef.current = window.setTimeout(() => {
        reset();
        setSelectedPlaylistId(null);
        setIsPlaylistDropdownOpen(false);
        uploadModal.closeSingle();
        navigate('/');
        successTimeoutRef.current = null;
      }, successRedirectDelay);
    } catch (error) {
      console.error('Unexpected error while publishing audio', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }



  return (
    <Modal
      title={isEditMode ? 'Edit song' : 'Publish new a song'}
      description={
        isEditMode
          ? 'Update the song details and publish a refreshed version.'
          : 'Publish an audio file; add as much detail as you wish.'
      }
      isOpen={uploadModal.isSingleOpen}
      onChange={onChange}
    >
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="flex flex-col gap-y-4"
      >
        <div>
          <Input
            id="title"
            disabled={isLoading}
            maxLength={150}
            aria-invalid={errors?.title ? 'true' : 'false'}
            {...register('title', {
              maxLength: {
                value: 150,
                message: 'Title must be 150 characters or fewer',
              },
            })}
            placeholder="Song title"
          />
          {errors?.title && (
            <p className="mt-1 text-xs text-red-300">
              {String(errors.title.message)}
            </p>
          )}
        </div>
        <div>
          <Input
            id="author"
            disabled={isLoading}
            maxLength={150}
            aria-invalid={errors?.author ? 'true' : 'false'}
            {...register('author', {
              maxLength: {
                value: 150,
                message: 'Performer name must be 150 characters or fewer',
              },
            })}
            placeholder="Song singer / band"
          />
          {errors?.author && (
            <p className="mt-1 text-xs text-red-300">
              {String(errors.author.message)}
            </p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="pb-1 text-sm font-semibold text-sky-200/80">
              Category <span className="text-red-300">*</span>
            </div>
            <select
              id="genre"
              disabled={isLoading}
              className="w-full rounded-md bg-sky-950/70 border border-sky-900/60 px-3 py-3 text-sm text-sky-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              defaultValue=""
              {...register('genre', {
                required: 'Please choose a category',
              })}
              aria-invalid={errors?.genre ? 'true' : 'false'}
            >
              <option value="" disabled>
                Select a category
              </option>
              {MUSIC_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors?.genre && (
              <p className="mt-1 text-xs text-red-300">
                {String(errors.genre.message || 'Please choose a category')}
              </p>
            )}
          </div>
          <Input
            id="mood"
            disabled={isLoading}
            {...register('mood')}
            placeholder="Mood / vibe (optional)"
          />
          <Input
            id="language"
            disabled={isLoading}
            {...register('language')}
            placeholder="Language (optional)"
          />
        </div>
        <Textarea
          id="notes"
          disabled={isLoading}
          {...register('notes')}
          placeholder="Additional notes, instruments, credits…"
          className="h-24 resize-none"
        />
        {username && (
          <div className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Add to your playlist (optional)</p>
                <p className="text-xs text-sky-300/70">
                  {availablePlaylists.length === 0
                    ? 'You have no playlists yet.'
                    : selectedPlaylist
                      ? `Selected: ${selectedPlaylist.title || 'Untitled playlist'}`
                      : 'Choose where this song should be added after publishing.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedPlaylist && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-sky-300/80 hover:text-white transition"
                    onClick={() => setSelectedPlaylistId(null)}
                  >
                    Clear selection
                  </button>
                )}
                {availablePlaylists.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setIsPlaylistDropdownOpen((prev) => !prev)
                    }
                    className="rounded-md border border-sky-800/70 bg-sky-900/60 px-3 py-1 text-xs font-semibold text-sky-200/80 transition hover:bg-sky-800/60 hover:text-white focus:outline-none"
                  >
                    {isPlaylistDropdownOpen ? 'Close list' : 'Choose playlist'}
                  </button>
                )}
              </div>
            </div>

            {selectedPlaylist && !isPlaylistDropdownOpen && (
              <div className="mt-3 flex items-center gap-3 rounded-md border border-sky-900/60 bg-sky-950/60 p-3">
                <img
                  src={selectedPlaylist.image || likeImg}
                  alt={selectedPlaylist.title || 'Playlist cover'}
                  className="h-12 w-12 flex-shrink-0 rounded-md object-cover"
                />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-semibold text-white">
                    {selectedPlaylist.title || 'Untitled playlist'}
                  </p>
                  <p className="truncate text-xs text-sky-300/70">
                    {selectedPlaylist.description || 'No description'}
                  </p>
                </div>
              </div>
            )}

            {isPlaylistDropdownOpen && (
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {isLoadingPlaylists ? (
                  <div className="rounded-md border border-sky-900/60 bg-sky-950/60 p-3 text-xs text-sky-300/70">
                    Loading your playlists…
                  </div>
                ) : availablePlaylists.length === 0 ? (
                  <div className="rounded-md border border-sky-900/60 bg-sky-950/60 p-3 text-xs text-sky-300/70">
                    You have no playlists yet.
                  </div>
                ) : (
                  availablePlaylists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="flex items-center gap-3 rounded-md border border-sky-900/60 bg-sky-950/60 p-3"
                    >
                      <img
                        src={playlist.image || likeImg}
                        alt={playlist.title || 'Playlist cover'}
                        className="h-12 w-12 flex-shrink-0 rounded-md object-cover"
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-white">
                          {playlist.title || 'Untitled playlist'}
                        </p>
                        <p className="truncate text-xs text-sky-300/70">
                          {playlist.description || 'No description'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md bg-sky-700/80 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-600"
                        onClick={() => {
                          setSelectedPlaylistId(playlist.id);
                          setIsPlaylistDropdownOpen(false);
                        }}
                      >
                        {selectedPlaylistId === playlist.id ? 'Selected' : 'Add here'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <div>
          <div className="pb-1">
            Select a song file
          </div>
          <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept="audio/*"
            id="song"
            {...register('song', { required: !isEditMode })}
          />
        </div>
        <div>
          <div className="pb-1">
        Select an image
          </div>
          <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="image"
            {...register('image', { required: !isEditMode })}
          />
        </div>
        <Button
          disabled={isLoading}
          type="submit"
        >
          Publish
        </Button>
      </form>
    </Modal>
  );
}

export default UploadModal;
