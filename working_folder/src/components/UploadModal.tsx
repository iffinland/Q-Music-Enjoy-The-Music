import ShortUniqueId from 'short-unique-id';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Compressor from 'compressorjs';

import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import Textarea from './TextArea';
import useUploadModal from '../hooks/useUploadModal';
import { useDispatch, useSelector } from 'react-redux';
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
import { qdnClient } from '../state/api/client';

type PlaylistMode = 'none' | 'existing' | 'new';

interface TrackDraft {
  id: string;
  file: File | null;
  relativePath: string;
  title: string;
  artist: string;
  album: string;
  coverFile: File | null;
  coverPreview: string | null;
  usesGlobalCover: boolean;
}

const DEFAULT_FORM_VALUES = {
  genre: '',
  mood: '',
  language: '',
  notes: '',
  playlistTitle: '',
  playlistDescription: '',
};

const uid = new ShortUniqueId();

const UploadModal = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const { getMyPlaylists } = useFetchSongs();

  const uploadModal = useUploadModal();
  const editingSong = uploadModal.songToEdit as SongMeta | null;
  const isEditMode = Boolean(editingSong);
  const navigate = useNavigate();
  const successRedirectDelay = 1600;
  const successTimeoutRef = useRef<number | null>(null);

  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [globalArtist, setGlobalArtist] = useState('');
  const [globalAlbum, setGlobalAlbum] = useState('');
  const [globalCoverFile, setGlobalCoverFile] = useState<File | null>(null);
  const [globalCoverPreview, setGlobalCoverPreview] = useState<string | null>(null);
  const [playlistMode, setPlaylistMode] = useState<PlaylistMode>('none');
  const [newPlaylistCoverFile, setNewPlaylistCoverFile] = useState<File | null>(null);
  const [newPlaylistCoverPreview, setNewPlaylistCoverPreview] = useState<string | null>(null);

  const initialFormValues = useMemo(() => ({ ...DEFAULT_FORM_VALUES }), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: initialFormValues,
  });

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

  const resetState = useCallback(() => {
    setTracks([]);
    setGlobalArtist('');
    setGlobalAlbum('');
    setGlobalCoverFile(null);
    setGlobalCoverPreview(null);
    setPlaylistMode('none');
    setSelectedPlaylistId(null);
    setNewPlaylistCoverFile(null);
    setNewPlaylistCoverPreview(null);
    reset(initialFormValues);
  }, [initialFormValues, reset]);

  useEffect(() => {
    if (!uploadModal.isSingleOpen) return;

    if (isEditMode && editingSong) {
      const metadata = parseDescriptionMetadata(editingSong.description);
      setTracks([
        {
          id: editingSong.id,
          file: null,
          relativePath: editingSong.title || editingSong.id,
          title: editingSong.title || '',
          artist: editingSong.author || '',
          album: metadata.album || '',
          coverFile: null,
          coverPreview: null,
          usesGlobalCover: true,
        },
      ]);
      setGlobalArtist(editingSong.author || '');
      setGlobalAlbum(metadata.album || '');
      reset({
        genre: metadata.genre || '',
        mood: metadata.mood || '',
        language: metadata.language || '',
        notes: metadata.notes || '',
        playlistTitle: '',
        playlistDescription: '',
      });
    } else {
      resetState();
    }

    setSelectedPlaylistId(null);
    setPlaylistMode('none');
  }, [
    uploadModal.isSingleOpen,
    isEditMode,
    editingSong,
    parseDescriptionMetadata,
    resetState,
    reset,
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
      availablePlaylists.find((playlist) => playlist?.id === selectedPlaylistId) ||
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

      await qdnClient.publishResource({
        resources,
      });
    },
    [sanitizeTitleForIdentifier],
  );

  const appendSongsToPlaylist = useCallback(
    async (playlistId: string, songsToAdd: SongReference[]) => {
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

      const updatedSongs = [...existingSongs];
      songsToAdd.forEach((song) => {
        const alreadyThere = updatedSongs.some(
          (entry) => entry.identifier === song.identifier,
        );
        if (!alreadyThere) {
          updatedSongs.push(song);
        }
      });

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
      dispatch,
      ensurePlaylistData,
      playlistHash,
      publishPlaylistUpdate,
      username,
    ],
  );

  const createPlaylistWithSongs = useCallback(
    async (
      songs: SongReference[],
      title: string,
      description: string,
      coverFile?: File | null,
    ) => {
      if (!username) throw new Error('Log in to continue');
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error('Playlist name is required');
      }

      let compressedImg: string | null = null;
      const coverToUse = coverFile || globalCoverFile;
      if (coverToUse) {
        compressedImg = await compressImg(coverToUse);
      }

      const playlistPayload = {
        songs,
        title: trimmedTitle,
        description: description.slice(0, 4000),
        image: compressedImg ? `data:image/webp;base64,${compressedImg}` : null,
      };

      const uniqueId = uid(8);
      const identifier = `enjoymusic_playlist_${
        sanitizeTitleForIdentifier(trimmedTitle).slice(0, 20) || uniqueId
      }_${uniqueId}`;

      await publishPlaylistUpdate(
        username,
        identifier,
        playlistPayload,
        trimmedTitle,
        description,
      );

      const now = Date.now();
      const playlistMeta: PlayList = {
        id: identifier,
        created: now,
        updated: now,
        user: username,
        title: trimmedTitle,
        description: playlistPayload.description,
        songs: playlistPayload.songs,
        image: playlistPayload.image,
      };

      dispatch(addToPlaylistHashMap(playlistMeta));
      dispatch(upsertMyPlaylists([playlistMeta]));
      dispatch(upsertPlaylists([playlistMeta]));
      return playlistMeta;
    },
    [dispatch, globalCoverFile, publishPlaylistUpdate, sanitizeTitleForIdentifier, username],
  );

  const compressImg = async (img: File) => {
    try {
      const image = img;
      let compressedFile: File | undefined;

      await new Promise<void>((resolve) => {
        new Compressor(image, {
          quality: 0.6,
          maxWidth: 300,
          mimeType: 'image/webp',
          success(result) {
            const file = new File([result], 'name', {
              type: 'image/webp',
            });
            compressedFile = file;
            resolve();
          },
          error(compressionError) {
            console.error('Image compression failed', compressionError);
            resolve();
          },
        });
      });
      if (!compressedFile) return null;
      const dataURI = await toBase64(compressedFile);
      if (!dataURI || typeof dataURI !== 'string') throw new Error('invalid image');
      const base64Data = dataURI?.split(',')[1];
      return base64Data;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const createTrackDraftFromFile = useCallback(
    (file: File, fallbackAlbum?: string): TrackDraft => {
      const relativePath = file.webkitRelativePath || file.name;
      const pathSegments = relativePath.split('/').filter(Boolean);
      const albumCandidate = pathSegments.length > 1
        ? pathSegments[pathSegments.length - 2]
        : fallbackAlbum || '';

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const normalized = baseName.replace(/[_]+/g, ' ').trim();
      const split = normalized.split(/[-\u2013]+/).map((part) => part.trim()).filter(Boolean);
      let artist = '';
      let title = normalized;
      if (split.length >= 2) {
        artist = split[0];
        title = split.slice(1).join(' - ');
      }
      if (!title) title = normalized || file.name;

      return {
        id: uid(10),
        file,
        relativePath,
        title,
        artist,
        album: albumCandidate || '',
        coverFile: globalCoverFile,
        coverPreview: globalCoverPreview,
        usesGlobalCover: Boolean(globalCoverFile),
      };
    },
    [globalCoverFile, globalCoverPreview],
  );

  const handleFileSelection = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const audioFiles = Array.from(fileList).filter((file) =>
        file.type.startsWith('audio') || /\.(mp3|wav|flac|m4a|ogg)$/i.test(file.name),
      );
      if (audioFiles.length === 0) {
        toast.error('No audio files found in the selected folder.');
        return;
      }

      const selectedFiles = isEditMode ? [audioFiles[0]] : audioFiles;
      const albumFallback = globalAlbum || createTrackDraftFromFile(selectedFiles[0]).album;
      const drafts = selectedFiles.map((file) => createTrackDraftFromFile(file, albumFallback));
      setTracks(drafts);
      if (!globalAlbum && albumFallback) {
        setGlobalAlbum(albumFallback);
      }
    },
    [createTrackDraftFromFile, globalAlbum, isEditMode],
  );

  const applyArtistToAll = () => {
    if (!globalArtist.trim()) return;
    setTracks((prev) => prev.map((track) => ({ ...track, artist: globalArtist })));
  };

  const applyAlbumToAll = () => {
    if (!globalAlbum.trim()) return;
    setTracks((prev) => prev.map((track) => ({ ...track, album: globalAlbum })));
  };

  const applyCoverToAll = () => {
    if (!globalCoverFile || !globalCoverPreview) {
      toast.error('Choose a cover image first.');
      return;
    }
    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        coverFile: globalCoverFile,
        coverPreview: globalCoverPreview,
        usesGlobalCover: true,
      })),
    );
  };

  const updateTrackField = (id: string, field: keyof TrackDraft, value: string | File | null) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== id) return track;
        if (field === 'coverFile') {
          return {
            ...track,
            coverFile: value as File | null,
          };
        }
        if (field === 'coverPreview') {
          return {
            ...track,
            coverPreview: value as string | null,
          };
        }
        return {
          ...track,
          [field]: value,
        } as TrackDraft;
      }),
    );
  };

  const handleGlobalCoverChange = (file: File | null) => {
    setGlobalCoverFile(file);
    const newPreview = file ? URL.createObjectURL(file) : null;
    if (globalCoverPreview && globalCoverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(globalCoverPreview);
    }
    setGlobalCoverPreview(newPreview);

    setTracks((prev) =>
      prev.map((track) => {
        if (track.usesGlobalCover || !track.coverFile) {
          return {
            ...track,
            coverFile: file,
            coverPreview: newPreview,
            usesGlobalCover: Boolean(file),
          };
        }
        return track;
      }),
    );
  };

  const handleTrackCoverChange = (id: string, file: File | null) => {
    const preview = file ? URL.createObjectURL(file) : null;
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== id) return track;
        if (track.coverPreview && track.coverPreview.startsWith('blob:')) {
          URL.revokeObjectURL(track.coverPreview);
        }
        return {
          ...track,
          coverFile: file,
          coverPreview: preview,
          usesGlobalCover: false,
        };
      }),
    );
  };

  const onChange = (open: boolean) => {
    if (!open) {
      resetState();
      uploadModal.closeSingle();
    }
  };

  const resolveCoverBase64 = useCallback(
    async (track: TrackDraft): Promise<string | null> => {
      const coverToUse = track.coverFile || (track.usesGlobalCover ? globalCoverFile : null);
      if (coverToUse) {
        return await compressImg(coverToUse);
      }
      if (isEditMode) {
        return await fetchExistingThumbnailBase64();
      }
      return null;
    },
    [compressImg, fetchExistingThumbnailBase64, globalCoverFile, isEditMode],
  );

  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    try {
      if (!username) {
        toast.error('Log in to continue');
        return;
      }

      if (!tracks.length) {
        toast.error('Select at least one audio file from a folder or file picker.');
        return;
      }

      if (isEditMode && tracks.length > 1) {
        toast.error('You can edit only one track at a time.');
        return;
      }

      const genre = sanitizeMetadataValue(values.genre);
      if (!genre) {
        toast.error('Please choose a category');
        return;
      }

      const mood = sanitizeMetadataValue(values.mood);
      const language = sanitizeMetadataValue(values.language);
      const notes = sanitizeMetadataValue(values.notes);

      if (playlistMode === 'existing' && !selectedPlaylistId && !isEditMode) {
        toast.error('Choose a playlist to add the tracks to.');
        return;
      }

      if (playlistMode === 'new' && !isEditMode) {
        const title = typeof values.playlistTitle === 'string' ? values.playlistTitle.trim() : '';
        if (!title) {
          toast.error('Enter a title for the new playlist.');
          return;
        }
      }

      setIsLoading(true);
      const publishedSongReferences: SongReference[] = [];

      for (const track of tracks) {
        let audioFileToPublish = track.file || null;
        if (!audioFileToPublish && isEditMode) {
          audioFileToPublish = await fetchExistingAudioFile();
        }
        if (!audioFileToPublish) {
          setIsLoading(false);
          toast.error('Please attach an audio file for all songs.');
          return;
        }

        const safeTitle = (track.title || '').trim() || track.relativePath;
        const safeAuthor = (track.artist || '').trim();
        const albumValue = (track.album || globalAlbum || '').trim();

        const coverBase64 = await resolveCoverBase64(track);
        if (!coverBase64) {
          setIsLoading(false);
          toast.error(`Add a cover image for: ${safeTitle}`);
          return;
        }

        let identifier = '';
        let identifierSegment = '';
        if (isEditMode && editingSong) {
          identifier = editingSong.id;
          identifierSegment =
            sanitizeTitleForIdentifier(editingSong.title || editingSong.id).slice(0, 20) ||
            editingSong.id;
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
        if (albumValue) metadataPairs.push(`album=${sanitizeMetadataValue(albumValue)}`);

        const description = metadataPairs.join(';');

        const audioExtension = audioFileToPublish.name.split('.').pop() || 'audio';
        const filenameBase =
          sanitizeTitleForIdentifier(safeTitle).slice(0, 20) || identifierSegment || identifier;
        const filename = `${filenameBase}.${audioExtension}`;
        const resources = [
          {
            name: isEditMode && editingSong ? editingSong.name : username,
            service: 'AUDIO',
            file: audioFileToPublish,
            title: safeTitle,
            description,
            identifier,
            filename,
          },
        ] as any[];

        if (coverBase64) {
          resources.push({
            name: isEditMode && editingSong ? editingSong.name : username,
            service: 'THUMBNAIL',
            data64: coverBase64,
            identifier,
          });
        }

        await qdnClient.publishResource({ resources });

        const createdTimestamp = editingSong?.created ?? Date.now();
        const updatedTimestamp = Date.now();

        const songData = {
          title: safeTitle,
          description: description,
          created: createdTimestamp,
          updated: updatedTimestamp,
          name: isEditMode && editingSong ? editingSong.name : username,
          id: identifier,
          author: safeAuthor,
          service: editingSong?.service || 'AUDIO',
          status: editingSong?.status,
          genre,
          mood,
          language,
          notes,
          category: genre,
          categoryName: genre,
        } as SongMeta;

        const librarySong: Song = {
          id: identifier,
          title: safeTitle,
          name: isEditMode && editingSong ? editingSong.name : username,
          author: safeAuthor,
          service: editingSong?.service || 'AUDIO',
          status: editingSong?.status,
        };

        if (isEditMode) {
          dispatch(upsertMyLibrary([librarySong]));
        } else {
          dispatch(addNewSong(songData));
        }
        if (coverBase64) {
          dispatch(
            setImageCoverHash({ url: 'data:image/webp;base64,' + coverBase64, id: identifier }),
          );
        }

        publishedSongReferences.push(buildSongReference(identifier, safeTitle, safeAuthor));
      }

      if (!isEditMode && publishedSongReferences.length > 0) {
        try {
          if (playlistMode === 'existing' && selectedPlaylistId) {
            await appendSongsToPlaylist(selectedPlaylistId, publishedSongReferences);
          } else if (playlistMode === 'new') {
            const playlistTitle =
              typeof values.playlistTitle === 'string' ? values.playlistTitle.trim() : '';
            const playlistDescription =
              typeof values.playlistDescription === 'string'
                ? values.playlistDescription.trim()
                : '';
            await createPlaylistWithSongs(
              publishedSongReferences,
              playlistTitle,
              playlistDescription,
              newPlaylistCoverFile,
            );
          }
        } catch (playlistError) {
          console.error('Playlist update failed', playlistError);
          toast.error('Adding tracks to the playlist failed.');
        }
      }

      setIsLoading(false);
      const successMessage = isEditMode
        ? 'Song updated successfully! Redirects...'
        : 'Tracks added! Redirecting to home...';
      toast.success(successMessage, { duration: successRedirectDelay });
      successTimeoutRef.current = window.setTimeout(() => {
        resetState();
        uploadModal.closeSingle();
        setSelectedPlaylistId(null);
        setPlaylistMode('none');
        navigate('/');
        successTimeoutRef.current = null;
      }, successRedirectDelay);
    } catch (error) {
      console.error('Unexpected error while publishing audio', error);
      let message = 'Something went wrong';
      if (typeof error === 'string' && error) {
        message = error;
      } else if (typeof error === 'object' && error !== null) {
        const maybeError = error as { error?: string; message?: string };
        if (typeof maybeError.error === 'string' && maybeError.error) {
          message = maybeError.error;
        } else if (typeof maybeError.message === 'string' && maybeError.message) {
          message = maybeError.message;
        }
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPlaylistSection = () => (
    <section className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Playlist options</p>
          <p className="text-xs text-sky-300/70">
            Create a new playlist or pick an existing one to add all selected tracks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'none', label: "Don't add to a playlist" },
            { key: 'existing', label: 'Add to existing playlist' },
            { key: 'new', label: 'Create new playlist' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPlaylistMode(option.key as PlaylistMode)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                playlistMode === option.key
                  ? 'border-sky-400/70 bg-sky-800/80 text-white'
                  : 'border-sky-800/70 bg-sky-900/70 text-sky-200/80 hover:bg-sky-800/70'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {playlistMode === 'existing' && (
        <div className="grid gap-3 md:grid-cols-[2fr,1fr] md:items-start">
          <div>
            <p className="pb-1 text-xs text-sky-300/70">Choose a playlist</p>
            <select
              className="w-full rounded-md border border-sky-900/60 bg-sky-950/60 px-3 py-2 text-sm text-sky-100 focus:outline-none"
              value={selectedPlaylistId || ''}
              onChange={(e) => setSelectedPlaylistId(e.target.value || null)}
              disabled={!availablePlaylists.length || isLoading}
            >
              <option value="">Select existing</option>
              {availablePlaylists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.title || 'Untitled playlist'}
                </option>
              ))}
            </select>
            {!availablePlaylists.length && (
              <p className="mt-2 text-xs text-sky-300/70">You have no playlists yet.</p>
            )}
          </div>
          {selectedPlaylist && (
            <div className="flex items-center gap-3 rounded-md border border-sky-900/60 bg-sky-950/60 p-3">
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
        </div>
      )}

      {playlistMode === 'new' && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <Input
              id="playlistTitle"
              placeholder="Playlist title"
              disabled={isLoading}
              maxLength={120}
              {...register('playlistTitle')}
            />
            <p className="mt-1 text-xs text-sky-300/70">Required when creating a new playlist.</p>
          </div>
          <div className="md:col-span-1">
            <Textarea
              id="playlistDescription"
              placeholder="Description (optional)"
              disabled={isLoading}
              maxLength={4000}
              className="h-20"
              {...register('playlistDescription')}
            />
          </div>
          <div className="md:col-span-1 space-y-2">
            <label className="text-xs text-sky-300/70">Playlist cover (optional)</label>
            <Input
              type="file"
              accept="image/*"
              id="playlist-cover"
              disabled={isLoading}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setNewPlaylistCoverFile(file);
                const preview = file ? URL.createObjectURL(file) : null;
                if (newPlaylistCoverPreview && newPlaylistCoverPreview.startsWith('blob:')) {
                  URL.revokeObjectURL(newPlaylistCoverPreview);
                }
                setNewPlaylistCoverPreview(preview);
              }}
            />
            {(newPlaylistCoverPreview || globalCoverPreview) && (
              <img
                src={newPlaylistCoverPreview || globalCoverPreview || undefined}
                alt="Playlist cover preview"
                className="h-24 w-full rounded-md object-cover"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );

  const renderApplyAllSection = () => (
    <section className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2">
          <Input
            id="global-artist"
            placeholder="Artist / band name"
            value={globalArtist}
            disabled={isLoading}
            onChange={(e) => setGlobalArtist(e.target.value)}
          />
          <Button type="button" className="md:w-auto" onClick={applyArtistToAll}>
            Apply all
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="global-album"
            placeholder="Album name"
            value={globalAlbum}
            disabled={isLoading}
            onChange={(e) => setGlobalAlbum(e.target.value)}
          />
          <Button type="button" className="md:w-auto" onClick={applyAlbumToAll}>
            Apply all
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <Input
              type="file"
              accept="image/*"
              id="global-cover"
              disabled={isLoading}
              onChange={(e) => handleGlobalCoverChange(e.target.files?.[0] || null)}
            />
          </label>
          <Button type="button" className="md:w-auto" onClick={applyCoverToAll}>
            Apply cover
          </Button>
        </div>
      </div>
      {globalCoverPreview && (
        <div className="overflow-hidden rounded-md border border-sky-900/60">
          <img src={globalCoverPreview} alt="Default cover" className="h-36 w-full object-cover" />
        </div>
      )}
    </section>
  );

  const renderFileSelection = () => (
    <section className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2 md:items-center">
        <label className="flex flex-col gap-2 rounded-md border border-sky-900/60 bg-sky-900/40 p-3 text-sm text-sky-200/80">
          <span className="font-semibold text-white">Choose a folder</span>
          <span className="text-xs text-sky-300/70">All audio files in the folder will be listed.</span>
          <Input
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            disabled={isLoading}
            onChange={(e) => handleFileSelection(e.target.files)}
          />
        </label>
        <label className="flex flex-col gap-2 rounded-md border border-sky-900/60 bg-sky-900/40 p-3 text-sm text-sky-200/80">
          <span className="font-semibold text-white">Or pick files manually</span>
          <span className="text-xs text-sky-300/70">Supported: mp3, wav, flac, m4a, ogg</span>
          <Input
            type="file"
            accept="audio/*"
            multiple
            disabled={isLoading}
            onChange={(e) => handleFileSelection(e.target.files)}
          />
        </label>
      </div>
      <p className="text-xs text-sky-300/70">
        Tip: filename like "Artist - Song title.mp3" auto-fills artist and title fields.
      </p>
    </section>
  );

  const renderTrackList = () => (
    <section className="space-y-3">
      {tracks.length === 0 ? (
        <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm text-sky-200/80">
          Choose a folder or files to see the track list.
        </div>
      ) : (
        tracks.map((track, index) => (
          <div
            key={track.id}
            className="rounded-md border border-sky-900/60 bg-sky-950/70 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-300/70">Track {index + 1}</p>
                <p className="text-sm font-semibold text-white">{track.relativePath}</p>
              </div>
              {!isEditMode && (
                <button
                  type="button"
                  className="text-xs font-semibold text-sky-300/80 hover:text-white"
                  onClick={() => setTracks((prev) => prev.filter((item) => item.id !== track.id))}
                  disabled={isLoading}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Song title"
                value={track.title}
                disabled={isLoading}
                onChange={(e) => updateTrackField(track.id, 'title', e.target.value)}
              />
              <Input
                placeholder="Artist / band"
                value={track.artist}
                disabled={isLoading}
                onChange={(e) => updateTrackField(track.id, 'artist', e.target.value)}
              />
              <Input
                placeholder="Album (optional)"
                value={track.album}
                disabled={isLoading}
                onChange={(e) => updateTrackField(track.id, 'album', e.target.value)}
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 md:items-center">
              <div className="text-xs text-sky-300/70">
                {track.file ? `File: ${track.file.name}` : 'Using existing file'}
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={isLoading}
                  onChange={(e) => handleTrackCoverChange(track.id, e.target.files?.[0] || null)}
                />
                {(track.coverPreview || globalCoverPreview) && (
                  <img
                    src={track.coverPreview || globalCoverPreview || undefined}
                    alt="Cover preview"
                    className="h-14 w-14 rounded-md object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  );

  return (
    <Modal
      title={isEditMode ? 'Edit song' : 'Publish new a song'}
      description={
        isEditMode
          ? 'Update the song details and publish a refreshed version.'
          : 'Publish multiple audio files at once; apply artist, album, cover, and playlist preferences.'
      }
      isOpen={uploadModal.isSingleOpen}
      onChange={onChange}
      contentClassName="md:!w-[70vw] md:!max-w-[1200px]"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
        {renderPlaylistSection()}
        {renderFileSelection()}
        {renderApplyAllSection()}
        {renderTrackList()}

        <section className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4 space-y-3">
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
            maxLength={4000}
            {...register('notes', {
              maxLength: {
                value: 4000,
                message: 'Additional notes can be at most 4000 characters',
              },
            })}
            placeholder="Additional notes, instruments, credits..."
            className="h-24 resize-none"
          />
          {errors?.notes && (
            <p className="mt-1 text-xs text-red-300">
              {String(errors.notes.message)}
            </p>
          )}
        </section>

        <Button disabled={isLoading} type="submit">
          {isLoading ? 'Publishing...' : 'Publish'}
        </Button>
      </form>
    </Modal>
  );
};

export default UploadModal;
