import ShortUniqueId from 'short-unique-id';
import React, { useEffect, useRef, useState } from 'react';
import Compressor from 'compressorjs';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';

import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import { RootState } from '../state/store';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { removeTrailingUnderscore } from '../utils/extra';
import useUploadVideoModal from '../hooks/useUploadVideoModal';
import { Video } from '../types';
import { MUSIC_CATEGORIES } from '../constants/categories';

const uid = new ShortUniqueId();

interface UploadVideoFormValues {
  title: string;
  description: string;
  author: string;
  genre: string;
  mood: string;
  language: string;
  notes: string;
  cover: FileList;
  video: FileList;
}

const compressImage = async (file: File) => {
  try {
    let compressedFile: File | undefined;

    await new Promise<void>((resolve) => {
      new Compressor(file, {
        quality: 0.6,
        maxWidth: 600,
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
  } catch (error) {
    console.error(error);
    return null;
  }
};

const sanitizeMetadataValue = (value?: string) => {
  if (!value) return '';
  return value.replace(/[;=]/g, ' ').trim();
};

const stripDiacritics = (value: string): string => {
  if (!value) return '';
  try {
    const noMarks = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const transliterationMap: Record<string, string> = {
      А: 'A',
      Б: 'B',
      В: 'V',
      Г: 'G',
      Д: 'D',
      Е: 'E',
      Ё: 'E',
      Ж: 'Zh',
      З: 'Z',
      И: 'I',
      Й: 'I',
      К: 'K',
      Л: 'L',
      М: 'M',
      Н: 'N',
      О: 'O',
      П: 'P',
      Р: 'R',
      С: 'S',
      Т: 'T',
      У: 'U',
      Ф: 'F',
      Х: 'Kh',
      Ц: 'Ts',
      Ч: 'Ch',
      Ш: 'Sh',
      Щ: 'Shch',
      Ы: 'Y',
      Ь: '',
      Ъ: '',
      Э: 'E',
      Ю: 'Yu',
      Я: 'Ya',
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'e',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'i',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'kh',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'shch',
      ы: 'y',
      ь: '',
      ъ: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    };
    return noMarks.replace(/[\u0400-\u04FF]/g, (char) => transliterationMap[char] ?? '');
  } catch {
    return value;
  }
};

const sanitizeFilename = (raw: string, fallbackBase: string, fallbackExtension: string) => {
  const normalized = stripDiacritics(raw);
  const cleaned = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  const ensureExtension = (name: string) => {
    if (!fallbackExtension) return name;
    if (name.toLowerCase().endsWith(fallbackExtension.toLowerCase())) {
      return name;
    }
    const withoutTrailingDot = name.replace(/\.+$/, '');
    return `${withoutTrailingDot}${fallbackExtension.startsWith('.') ? '' : '.'}${fallbackExtension}`;
  };

  if (cleaned) {
    return ensureExtension(cleaned);
  }

  const fallbackCleaned = stripDiacritics(fallbackBase || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'video';

  return ensureExtension(fallbackCleaned);
};

const resolveSafeVideoFilename = (file: File, cleanTitle?: string, uniqueId?: string) => {
  const fallbackBase = cleanTitle && cleanTitle.length > 0 ? cleanTitle : uniqueId || 'video';
  const fallbackExtension = '.video';

  const originalName = file.name || '';
  const lastDotIndex = originalName.lastIndexOf('.');
  const base =
    lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName || fallbackBase;
  const extension =
    lastDotIndex > 0
      ? originalName.slice(lastDotIndex)
      : file.type && file.type.includes('mp4')
        ? '.mp4'
        : fallbackExtension;

  return sanitizeFilename(`${base}${extension}`, fallbackBase, extension || fallbackExtension);
};

const parseMetadataFromVideo = (video?: Video | null) => ({
  author: video?.author || '',
  genre: video?.genre || '',
  mood: video?.mood || '',
  language: video?.language || '',
  notes: video?.notes || '',
});

const UploadVideoModal: React.FC = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const uploadVideoModal = useUploadVideoModal();
  const isEditMode = uploadVideoModal.mode === 'edit';
  const editingVideo = uploadVideoModal.video;
  const [isLoading, setIsLoading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<UploadVideoFormValues>({
    defaultValues: {
      title: '',
      description: '',
      author: '',
      genre: '',
      mood: '',
      language: '',
      notes: '',
    },
  });

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!uploadVideoModal.isOpen) {
      reset({
        title: '',
        description: '',
        author: '',
        genre: '',
        mood: '',
        language: '',
        notes: '',
        cover: undefined,
        video: undefined,
      });
      setCoverPreview(null);
      return;
    }

    if (isEditMode && editingVideo) {
      const metadataDefaults = parseMetadataFromVideo(editingVideo);
      reset({
        title: editingVideo.title || '',
        description: editingVideo.description || '',
        author: metadataDefaults.author,
        genre: metadataDefaults.genre,
        mood: metadataDefaults.mood,
        language: metadataDefaults.language,
        notes: metadataDefaults.notes,
        cover: undefined,
        video: undefined,
      });
      setCoverPreview(editingVideo.coverImage || null);
    } else {
      reset({
        title: '',
        description: '',
        author: '',
        genre: '',
        mood: '',
        language: '',
        notes: '',
        cover: undefined,
        video: undefined,
      });
      setCoverPreview(null);
    }
  }, [uploadVideoModal.isOpen, isEditMode, editingVideo, reset]);

  const onChange = (open: boolean) => {
    if (!open) {
      reset({
        title: '',
        description: '',
        author: '',
        genre: '',
        mood: '',
        language: '',
        notes: '',
        cover: undefined,
        video: undefined,
      });
      setCoverPreview(null);
      uploadVideoModal.onClose();
    }
  };

  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    if (isEditMode && !editingVideo) {
      toast.error('Unable to load the selected video for editing.');
      return;
    }

    const rawTitle = (values.title as string)?.trim() || '';
    const rawDescription = (values.description as string)?.trim() || '';
    const title = rawTitle;
    const description = rawDescription;
    const coverFile = (values.cover as FileList)?.[0];
    const videoFile = (values.video as FileList)?.[0];
    const author = sanitizeMetadataValue(values.author as string);
    const genre = sanitizeMetadataValue(values.genre as string);
    const mood = sanitizeMetadataValue(values.mood as string);
    const language = sanitizeMetadataValue(values.language as string);
    const notes = sanitizeMetadataValue(values.notes as string);
    const safeResourceTitle = stripDiacritics(title) || 'Untitled video';
    const safeResourceDescription = stripDiacritics(description) || description;
    const safeResourceAuthor = stripDiacritics(author) || author;

    clearErrors('title');

    if (title.length > 200) {
      setError('title', { type: 'manual', message: 'Video title can be at most 200 characters' });
      toast.error('Video title can be at most 200 characters');
      return;
    }

    if (!description) {
      setError('description', { type: 'manual', message: 'Video description is required' });
      toast.error('Video description is required');
      return;
    }
    clearErrors('description');

    if (description.length > 4000) {
      setError('description', { type: 'manual', message: 'Video description can be at most 4000 characters' });
      toast.error('Video description can be at most 4000 characters');
      return;
    }

    clearErrors('author');

    if (!genre) {
      setError('genre', { type: 'manual', message: 'Please choose a category' });
      toast.error('Please choose a category');
      return;
    }
    clearErrors('genre');

    if (!videoFile && !isEditMode) {
      setError('video', { type: 'manual', message: 'Please select a video file' });
      toast.error('Please select a video file');
      return;
    }
    clearErrors('video');

    if (!coverFile && !isEditMode && !editingVideo?.coverImage) {
      setError('cover', { type: 'manual', message: 'Please select a cover image' });
      toast.error('Please select a cover image');
      return;
    }
    clearErrors('cover');

    setIsLoading(true);

    try {
      let compressedImg: string | null = null;
      if (coverFile) {
        compressedImg = await compressImage(coverFile);
        if (!compressedImg) {
          toast.error('Image compression failed');
          setIsLoading(false);
          return;
        }
      }

      const now = Date.now();
      const uniqueId = uid(8);
      const underscored = title.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
      const sliced = underscored.slice(0, 32);
      const cleanTitle = removeTrailingUnderscore(sliced);
      const baseIdentifier =
        isEditMode && editingVideo?.id
          ? editingVideo.id
          : `enjoymusic_video_${cleanTitle || uniqueId}_${uniqueId}`;
      const identifier = baseIdentifier;

      const videoFilename = videoFile
        ? resolveSafeVideoFilename(videoFile, cleanTitle, uniqueId)
        : editingVideo?.videoFilename
          ? sanitizeFilename(
              editingVideo.videoFilename,
              cleanTitle || uniqueId || 'video',
              '.video',
            )
          : sanitizeFilename(
              `${cleanTitle || uniqueId}.video`,
              cleanTitle || uniqueId || 'video',
              '.video',
            );

      const videoMimeType =
        videoFile?.type?.trim() ||
        editingVideo?.videoMimeType;

      const createdTimestamp =
        isEditMode && editingVideo?.created
          ? editingVideo.created
          : now;

      const metadata: Record<string, string> = {};
      if (safeResourceAuthor) metadata.author = safeResourceAuthor;
      if (genre) metadata.genre = stripDiacritics(genre) || genre;
      if (mood) metadata.mood = stripDiacritics(mood) || mood;
      if (language) metadata.language = stripDiacritics(language) || language;
      if (notes) metadata.notes = stripDiacritics(notes) || notes;

      const documentPayload: Record<string, unknown> = {
        id: identifier,
        title: safeResourceTitle,
        description: safeResourceDescription,
        created: createdTimestamp,
        updated: now,
        publisher: username,
        identifier,
        version: 1,
      };
      if (safeResourceTitle !== title) {
        documentPayload.originalTitle = title;
      }
      if (safeResourceDescription !== description) {
        documentPayload.originalDescription = description;
      }

      if (Object.keys(metadata).length > 0) {
        documentPayload.metadata = metadata;
        if (metadata.author) {
          documentPayload.author = metadata.author;
          if (safeResourceAuthor !== author && author) {
            (documentPayload as Record<string, unknown>).originalAuthor = author;
          }
        }
      }

      if (videoFilename) {
        documentPayload.video = {
          filename: videoFilename,
          ...(videoMimeType ? { mimeType: videoMimeType } : {}),
        };
      }

      if (!compressedImg && editingVideo?.coverImage) {
        documentPayload.coverImage = editingVideo.coverImage;
      }

      const descriptionSnippet = safeResourceDescription.slice(0, 4000);
      const filenameBase = cleanTitle || uniqueId;
      const documentData64 = await objectToBase64(documentPayload);

      const resources: any[] = [
        {
          name: username,
          service: 'DOCUMENT',
          data64: documentData64,
          identifier,
          filename: `${filenameBase}.json`,
          title: safeResourceTitle.slice(0, 55),
          description: descriptionSnippet,
        },
      ];

      if (videoFile) {
        resources.unshift({
          name: username,
          service: 'VIDEO',
          file: videoFile,
          identifier,
          filename: videoFilename,
          title: safeResourceTitle.slice(0, 55),
          description: descriptionSnippet,
        });
      }

      if (compressedImg) {
        resources.push({
          name: username,
          service: 'THUMBNAIL',
          data64: compressedImg,
          identifier,
        });
      }

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });

      toast.success(isEditMode ? 'Video updated successfully!' : 'Video published successfully!');
      window.dispatchEvent(new CustomEvent('videos:refresh'));

      successTimeoutRef.current = window.setTimeout(() => {
        reset({
          title: '',
          description: '',
          author: '',
          genre: '',
          mood: '',
          language: '',
          notes: '',
          cover: undefined,
          video: undefined,
        });
        setCoverPreview(null);
        uploadVideoModal.onClose();
        successTimeoutRef.current = null;
      }, 400);
    } catch (error: unknown) {
      console.error('Failed to publish video', error);
      let message = isEditMode ? 'Failed to update video' : 'Failed to publish video';
      if (typeof error === 'string' && error) {
        message = error;
      } else if (typeof error === 'object' && error !== null) {
        const possibleError = error as { error?: string; message?: string };
        if (typeof possibleError.error === 'string' && possibleError.error) {
          message = possibleError.error;
        } else if (
          typeof possibleError.message === 'string' &&
          possibleError.message
        ) {
          message = possibleError.message;
        }
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const subscription = watch((value) => {
      const file = value.cover?.[0];
      if (!file) {
        if (isEditMode && uploadVideoModal.video?.coverImage) {
          setCoverPreview(uploadVideoModal.video.coverImage);
        } else if (!isEditMode) {
          setCoverPreview(null);
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });

    return () => subscription.unsubscribe();
  }, [watch, isEditMode, uploadVideoModal.video]);

  const displayedCoverPreview =
    coverPreview || (isEditMode ? uploadVideoModal.video?.coverImage || null : null);
  const selectedVideoFiles = watch('video');
  const hasSelectedVideo =
    !!selectedVideoFiles && selectedVideoFiles.length > 0;

  return (
    <Modal
      title={isEditMode ? 'Edit video' : 'Publish new video'}
      description={
        isEditMode
          ? 'Update your video details'
          : 'Share a new community video'
      }
      isOpen={uploadVideoModal.isOpen}
      onChange={onChange}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">Video title</div>
          <Input
            id="title"
            disabled={isLoading}
            placeholder="Video title"
            maxLength={200}
            aria-invalid={errors.title ? 'true' : 'false'}
            {...register('title', {
              maxLength: {
                value: 200,
                message: 'Video title can be at most 200 characters',
              },
            })}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">Video creator</div>
          <Input
            id="author"
            disabled={isLoading}
            placeholder="Producer / Creator"
            aria-invalid={errors.author ? 'true' : 'false'}
            {...register('author')}
          />
          {errors.author && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.author.message}
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="pb-1 text-sm font-semibold text-sky-200/80">
              Category <span className="text-orange-300">*</span>
            </div>
            <select
              id="genre"
              disabled={isLoading}
              defaultValue=""
              className="w-full rounded-md bg-sky-950/70 border border-sky-900/60 px-3 py-3 text-sm text-sky-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-invalid={errors.genre ? 'true' : 'false'}
              {...register('genre', { required: 'Please choose a category' })}
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
            {errors.genre && (
              <p className="mt-1 text-xs text-orange-300" role="alert">
                {errors.genre.message}
              </p>
            )}
          </div>
          <Input
            id="mood"
            disabled={isLoading}
            placeholder="Mood / vibe (optional)"
            {...register('mood')}
          />
          <Input
            id="language"
            disabled={isLoading}
            placeholder="Language (optional)"
            {...register('language')}
          />
        </div>

        <Textarea
          id="notes"
          disabled={isLoading}
          placeholder="Additional notes, credits, cast…"
          className="h-24 resize-none"
          maxLength={4000}
          {...register('notes', {
            maxLength: {
              value: 4000,
              message: 'Additional notes can be at most 4000 characters',
            },
          })}
        />
        {errors?.notes && (
          <p className="mt-1 text-xs text-orange-300" role="alert">
            {errors.notes.message}
          </p>
        )}

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            Video description <span className="text-orange-300">*</span>
          </div>
          <Textarea
            id="description"
            disabled={isLoading}
            placeholder="Video description"
            className="h-40 resize-none"
            maxLength={4000}
            aria-invalid={errors.description ? 'true' : 'false'}
            {...register('description', {
              required: 'Video description is required',
              maxLength: {
                value: 4000,
                message: 'Video description can be at most 4000 characters',
              },
            })}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            {isEditMode ? 'Select a new cover image (optional)' : 'Select a cover image'}{' '}
            {!isEditMode && <span className="text-orange-300">*</span>}
          </div>
          <Input
            placeholder="Upload cover"
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="cover"
            {...register('cover', { required: !isEditMode && !editingVideo?.coverImage })}
          />
          {errors.cover && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              Please select a cover image
            </p>
          )}
          {displayedCoverPreview && (
            <div className="mt-3 overflow-hidden rounded-lg border border-sky-900/60">
              <img
                src={displayedCoverPreview}
                alt="Selected cover"
                className="h-36 w-full object-cover"
              />
            </div>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            {isEditMode ? 'Select a new video file (optional)' : 'Select a video file'}{' '}
            {!isEditMode && <span className="text-orange-300">*</span>}
          </div>
          <Input
            placeholder="Upload video"
            disabled={isLoading}
            type="file"
            accept="video/*"
            id="video"
            {...register('video', { required: !isEditMode })}
          />
          {errors.video && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              Please select a video file
            </p>
          )}
          {isEditMode && !hasSelectedVideo && editingVideo?.videoFilename && (
            <p className="mt-1 text-xs text-sky-300/80">
              Current video: {editingVideo.videoFilename}
            </p>
          )}
        </div>

        <Button disabled={isLoading} type="submit" className="bg-orange-500 hover:bg-orange-400">
          {isEditMode ? 'Save Changes' : 'Publish Video'}
        </Button>
      </form>
    </Modal>
  );
};

export default UploadVideoModal;
