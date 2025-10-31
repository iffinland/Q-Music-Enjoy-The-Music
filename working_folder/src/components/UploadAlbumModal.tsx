import ShortUniqueId from 'short-unique-id';
import Compressor from 'compressorjs';
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';

import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import { RootState } from '../state/store';
import useUploadModal from '../hooks/useUploadModal';
import { extractTrackMetadata } from '../utils/audioMetadata';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import {
  SongReference,
  addNewSong,
  addToPlaylistHashMap,
  setImageCoverHash,
  upsertPlaylists,
} from '../state/features/globalSlice';
import { removeTrailingUnderscore } from '../utils/extra';

interface AlbumTrack {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string | null;
  trackNumber: number | null;
}

const uid = new ShortUniqueId();

const sanitizeMetadataValue = (value?: string) => {
  if (!value) return '';
  return value.replace(/[;=]/g, ' ').trim();
};

const removeExtension = (name: string) => name.replace(/\.[^/.]+$/, '');

const ensureWebkitDirectory = (input: HTMLInputElement | null) => {
  if (!input) return;
  input.setAttribute('multiple', 'true');
  input.setAttribute('webkitdirectory', 'true');
  input.setAttribute('directory', 'true');
  const element = input as HTMLInputElement & {
    webkitdirectory?: boolean;
    directory?: boolean;
    multiple?: boolean;
  };
  element.multiple = true;
  element.webkitdirectory = true;
  element.directory = true;
};

const supportsDirectoryPicker =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const UploadAlbumModal: React.FC = () => {
  const uploadModal = useUploadModal();
  const isOpen = uploadModal.isAlbumOpen;
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const dispatch = useDispatch();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [language, setLanguage] = useState('');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [createPlaylist, setCreatePlaylist] = useState(true);

  useEffect(() => {
    ensureWebkitDirectory(fileInputRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  const resetState = useCallback(() => {
    setTracks([]);
    setAlbumTitle('');
    setAlbumArtist('');
    setGenre('');
    setMood('');
    setLanguage('');
    setNotes('');
    setDescription('');
    setCoverPreview(null);
    setCoverFile(null);
    setCreatePlaylist(true);
    setIsProcessingFiles(false);
  }, []);

  const onChange = (open: boolean) => {
    if (!open) {
      resetState();
      uploadModal.closeAlbum();
    }
  };

  const handleTrackMetadataUpdate = useCallback(
    (id: string, field: 'title' | 'artist', value: string) => {
      setTracks((prev) =>
        prev.map((track) =>
          track.id === id ? { ...track, [field]: value } : track,
        ),
      );
    },
    [],
  );

  const handleRemoveTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== id));
  }, []);

  const loadTracksFromFiles = useCallback(
    async (files: File[]) => {
      try {
        if (files.length === 0) {
          toast.error('No audio files detected in the selection.');
          return;
        }

        setIsProcessingFiles(true);

        const audioFiles = files.filter((file) => file.type.startsWith('audio'));
        if (audioFiles.length === 0) {
          toast.error('No audio files detected in the selection.');
          return;
        }

        const newTracks: AlbumTrack[] = [];
        for (const file of audioFiles) {
          const metadata = await extractTrackMetadata(file);
          newTracks.push({
            id: uid(10),
            file,
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            trackNumber: metadata.trackNumber,
          });
        }

        newTracks.sort((a, b) => {
          if (a.trackNumber && b.trackNumber) {
            return a.trackNumber - b.trackNumber;
          }
          return a.title.localeCompare(b.title);
        });

        setTracks(newTracks);

        if (!albumTitle && newTracks[0]?.album) {
          setAlbumTitle(newTracks[0].album);
        }

        if (!albumArtist) {
          const uniqueArtists = Array.from(
            new Set(newTracks.map((track) => track.artist)),
          );
          if (uniqueArtists.length === 1) {
            setAlbumArtist(uniqueArtists[0]);
          }
        }

        toast.success(`Loaded ${newTracks.length} tracks from your selection.`);
      } catch (error) {
        console.error('Failed to load album tracks', error);
        toast.error('Could not load tracks. Please try again.');
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [albumArtist, albumTitle],
  );

  const collectAudioFilesFromDirectory = useCallback(
    async (directoryHandle: FileSystemDirectoryHandle): Promise<File[]> => {
      const files: File[] = [];

      const traverse = async (
        handle: FileSystemDirectoryHandle,
      ): Promise<void> => {
        const iterator = handle.values?.() ?? handle.entries?.();
        if (!iterator) return;

        for await (const value of iterator as AsyncIterableIterator<any>) {
          const entry = Array.isArray(value) ? value[1] : value;
          if (!entry) continue;
          if (entry.kind === 'file') {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            files.push(file);
          } else if (entry.kind === 'directory') {
            const directoryHandle = entry as FileSystemDirectoryHandle;
            await traverse(directoryHandle);
          }
        }
      };

      await traverse(directoryHandle);
      return files;
    },
    [],
  );

  const handleSelectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) return;
    if (!username) {
      toast.error('Log in to continue');
      return;
    }
    await loadTracksFromFiles(Array.from(files));
  };

  const handleBrowseClick = async () => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    if (isProcessingFiles || isSubmitting) return;

    const directoryPicker = (window as typeof window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;

    if (supportsDirectoryPicker && directoryPicker) {
      try {
        const directoryHandle = await directoryPicker();
        const files = await collectAudioFilesFromDirectory(directoryHandle);
        if (files.length === 0) {
          toast.error('No audio files detected in the selected directory.');
          return;
        }
        await loadTracksFromFiles(files);
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Failed to load directory contents', error);
        toast.error('Could not read the selected directory.');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleApplyArtistToAll = () => {
    if (!albumArtist) return;
    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        artist: albumArtist,
      })),
    );
  };

  const compressImage = async (file: File) => {
    let compressedFile: File | undefined;
    await new Promise<void>((resolve) => {
      new Compressor(file, {
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
    if (!dataURI || typeof dataURI !== 'string') {
      return null;
    }

    const [, base64] = dataURI.split(',');
    return base64 || null;
  };

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCoverFile(file);
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
  };

  const sanitizedAlbumTitle = useMemo(() => albumTitle.trim(), [albumTitle]);

  const handleSubmit = async () => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    if (tracks.length === 0) {
      toast.error('Select at least one audio file.');
      return;
    }

    if (!coverFile) {
      toast.error('Please select a cover image.');
      return;
    }

    const effectiveAlbumTitle = sanitizedAlbumTitle || 'Untitled album';

    try {
      setIsSubmitting(true);

      const compressedCover = await compressImage(coverFile);
      if (!compressedCover) {
        toast.error('Image compression failed.');
        setIsSubmitting(false);
        return;
      }

      const publishedTracks: SongReference[] = [];

      for (const track of tracks) {
        const trackTitle = track.title.trim() || removeExtension(track.file.name);
        const trackArtist = track.artist.trim() || albumArtist || username;
        const titleSlug = removeTrailingUnderscore(
          trackTitle.replace(/\s+/g, '_').toLowerCase().slice(0, 24),
        );
        const identifier = `enjoymusic_song_${titleSlug}_${uid(6)}`;
        const fileExtension = track.file.name.split('.').pop() || 'audio';
        const fileTitle = trackTitle.replace(/\s+/g, '_').slice(0, 20);
        const filename = `${fileTitle}.${fileExtension}`;

        const metadataPairs: string[] = [
          `title=${sanitizeMetadataValue(trackTitle)}`,
          `author=${sanitizeMetadataValue(trackArtist)}`,
        ];

        if (effectiveAlbumTitle) {
          metadataPairs.push(
            `album=${sanitizeMetadataValue(effectiveAlbumTitle)}`,
          );
        }

        if (genre) metadataPairs.push(`genre=${sanitizeMetadataValue(genre)}`);
        if (mood) metadataPairs.push(`mood=${sanitizeMetadataValue(mood)}`);
        if (language)
          metadataPairs.push(`language=${sanitizeMetadataValue(language)}`);
        if (notes) metadataPairs.push(`notes=${sanitizeMetadataValue(notes)}`);
        if (description)
          metadataPairs.push(`description=${sanitizeMetadataValue(description)}`);
        if (track.trackNumber != null) {
          metadataPairs.push(`trackNumber=${track.trackNumber}`);
        }

        const resourceDescription = metadataPairs.join(';');

        const publishRequest = {
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources: [
            {
              name: username,
              service: 'AUDIO',
              file: track.file,
              title: trackTitle,
              description: resourceDescription,
              identifier,
              filename,
            },
            {
              name: username,
              service: 'THUMBNAIL',
              data64: compressedCover,
              identifier,
            },
          ],
        };

        await qortalRequest(publishRequest);

        const songData = {
          title: trackTitle,
          description: resourceDescription,
          created: Date.now(),
          updated: Date.now(),
          name: username,
          id: identifier,
          author: trackArtist,
        };

        dispatch(addNewSong(songData));
        dispatch(
          setImageCoverHash({
            url: 'data:image/webp;base64,' + compressedCover,
            id: identifier,
          }),
        );

        publishedTracks.push({
          name: username,
          service: 'AUDIO',
          identifier,
          title: trackTitle,
          author: trackArtist,
        });
      }

      if (createPlaylist && publishedTracks.length > 0) {
        const playlistId = `enjoymusic_playlist_${removeTrailingUnderscore(
          effectiveAlbumTitle.replace(/\s+/g, '_').toLowerCase().slice(0, 24),
        )}_${uid(6)}`;
        const playlistPayload = {
          songs: publishedTracks,
          title: effectiveAlbumTitle.slice(0, 55),
          description,
          image: 'data:image/webp;base64,' + compressedCover,
        };

        const playlistBase64 = await objectToBase64(playlistPayload);

        const playlistRequest = {
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources: [
            {
              name: username,
              service: 'PLAYLIST',
              data64: playlistBase64,
              title: effectiveAlbumTitle.slice(0, 55),
              description: description.slice(0, 140),
              identifier: playlistId,
              filename: `${removeTrailingUnderscore(
                effectiveAlbumTitle.replace(/\s+/g, '_').slice(0, 20),
              )}.json`,
            },
            {
              name: username,
              service: 'THUMBNAIL',
              data64: compressedCover,
              identifier: playlistId,
            },
          ],
        };

        await qortalRequest(playlistRequest);

        const playlistRecord = {
          user: username,
          service: 'PLAYLIST',
          id: playlistId,
          filename: `${removeTrailingUnderscore(
            effectiveAlbumTitle.replace(/\s+/g, '_').slice(0, 20),
          )}.json`,
          songs: publishedTracks,
          title: effectiveAlbumTitle.slice(0, 55),
          description,
          image: 'data:image/webp;base64,' + compressedCover,
        };

        dispatch(addToPlaylistHashMap(playlistRecord));
        dispatch(upsertPlaylists([playlistRecord]));
      }

      toast.success('Album published successfully!');
      resetState();
      uploadModal.closeAlbum();
    } catch (error) {
      console.error('Failed to publish album', error);
      toast.error('Could not publish the album. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Publish an album"
      description="Upload multiple audio files, update their details, and publish them together."
      isOpen={isOpen}
      onChange={onChange}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-sky-900/60 bg-sky-950/60 p-4 text-sm text-sky-100">
          <p>Select a folder or multiple audio files to begin.</p>
          <Button
            type="button"
            disabled={isProcessingFiles || isSubmitting}
            onClick={handleBrowseClick}
            className="bg-sky-600 text-white hover:opacity-90"
          >
            {supportsDirectoryPicker
              ? isProcessingFiles
                ? 'Loading folder…'
                : 'Choose folder'
              : isProcessingFiles
              ? 'Loading files…'
              : 'Browse files'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={handleSelectFiles}
          />
        </div>

        {tracks.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={albumTitle}
                onChange={(event) => setAlbumTitle(event.target.value)}
                placeholder="Album title"
                disabled={isSubmitting}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={albumArtist}
                  onChange={(event) => setAlbumArtist(event.target.value)}
                  placeholder="Album artist / band"
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  onClick={handleApplyArtistToAll}
                  disabled={!albumArtist || isSubmitting}
                  className="w-auto px-4 py-2 text-sm"
                >
                  Apply to tracks
                </Button>
              </div>
              <Input
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                placeholder="Genre (optional)"
                disabled={isSubmitting}
              />
              <Input
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                placeholder="Mood / vibe (optional)"
                disabled={isSubmitting}
              />
              <Input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="Language (optional)"
                disabled={isSubmitting}
              />
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes / credits (optional)"
                disabled={isSubmitting}
                className="md:col-span-2 h-24 resize-none"
              />
            </div>

            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Album description"
              disabled={isSubmitting}
              className="h-24 resize-none"
            />

            <div>
              <p className="text-sm font-semibold text-sky-100">Cover image</p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  disabled={isSubmitting}
                />
                {coverPreview && (
                  <img
                    src={coverPreview}
                    alt="Album cover preview"
                    className="h-16 w-16 rounded-md object-cover"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-sky-100">
              <input
                id="create_playlist"
                type="checkbox"
                checked={createPlaylist}
                onChange={(event) => setCreatePlaylist(event.target.checked)}
                disabled={isSubmitting}
              />
              <label htmlFor="create_playlist">
                Create playlist from these tracks
              </label>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-sky-900/60 bg-sky-950/40 p-3">
              <div className="mb-3 text-sm font-semibold text-sky-200">
                Tracks ({tracks.length})
              </div>
              <div className="flex flex-col gap-3">
                {tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex flex-col gap-2 rounded-md border border-sky-900/60 bg-sky-950/70 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between text-sky-200">
                      <span>
                        #{index + 1}{' '}
                        <span className="text-xs text-sky-400/80">
                          {track.file.name}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:text-red-200"
                        onClick={() => handleRemoveTrack(track.id)}
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    </div>
                    <Input
                      value={track.title}
                      onChange={(event) =>
                        handleTrackMetadataUpdate(track.id, 'title', event.target.value)
                      }
                      disabled={isSubmitting}
                      placeholder="Track title"
                    />
                    <Input
                      value={track.artist}
                      onChange={(event) =>
                        handleTrackMetadataUpdate(track.id, 'artist', event.target.value)
                      }
                      disabled={isSubmitting}
                      placeholder="Track artist"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="button"
              disabled={isSubmitting || isProcessingFiles || tracks.length === 0}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Publishing…' : 'Publish album'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UploadAlbumModal;
