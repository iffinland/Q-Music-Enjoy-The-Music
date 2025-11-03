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
import useUploadPodcastModal from '../hooks/useUploadPodcastModal';
import { RootState } from '../state/store';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { removeTrailingUnderscore } from '../utils/extra';
import { Podcast } from '../types';
import { PODCAST_CATEGORIES } from '../constants/categories';

const uid = new ShortUniqueId();

interface UploadPodcastFormValues {
  title: string;
  description: string;
  category: string;
  cover: FileList;
  audio: FileList;
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

const UploadPodcastModal: React.FC = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const uploadPodcastModal = useUploadPodcastModal();
  const isEditMode = uploadPodcastModal.mode === 'edit';
  const editingPodcast = uploadPodcastModal.podcast;
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
  } = useForm<UploadPodcastFormValues>({
    defaultValues: {
      title: '',
      description: '',
      category: '',
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
    if (!uploadPodcastModal.isOpen) {
      reset({
        title: '',
        description: '',
        category: '',
        cover: undefined,
        audio: undefined,
      });
      setCoverPreview(null);
      return;
    }

    if (isEditMode && editingPodcast) {
      reset({
        title: editingPodcast.title || '',
        description: editingPodcast.description || '',
        category: editingPodcast.category || '',
        cover: undefined,
        audio: undefined,
      });
    } else {
      reset({
        title: '',
        description: '',
        category: '',
        cover: undefined,
        audio: undefined,
      });
    }
    setCoverPreview(null);
  }, [uploadPodcastModal.isOpen, isEditMode, editingPodcast, reset]);

  const onChange = (open: boolean) => {
    if (!open) {
      reset({
        title: '',
        description: '',
        category: '',
        cover: undefined,
        audio: undefined,
      });
      setCoverPreview(null);
      uploadPodcastModal.onClose();
    }
  };

  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    if (isEditMode && !editingPodcast) {
      toast.error('Unable to load the selected podcast for editing.');
      return;
    }

    const title = (values.title as string)?.trim() || '';
    const description = (values.description as string)?.trim() || '';
    const coverFile = (values.cover as FileList)?.[0];
    const audioFile = (values.audio as FileList)?.[0];
    const category = (values.category as string) || '';

    clearErrors('title');

    if (title.length > 200) {
      setError('title', { type: 'manual', message: 'Podcast name can be at most 200 characters' });
      toast.error('Podcast name can be at most 200 characters');
      return;
    }

    if (!description) {
      setError('description', { type: 'manual', message: 'Podcast description is required' });
      toast.error('Podcast description is required');
      return;
    }
    clearErrors('description');

    if (!category) {
      setError('category', { type: 'manual', message: 'Please choose a category' });
      toast.error('Please choose a category');
      return;
    }
    clearErrors('category');

    if (description.length > 4000) {
      setError('description', { type: 'manual', message: 'Podcast description can be at most 4000 characters' });
      toast.error('Podcast description can be at most 4000 characters');
      return;
    }

    if (!audioFile && !isEditMode) {
      setError('audio', { type: 'manual', message: 'Please select a podcast file' });
      toast.error('Please select a podcast file');
      return;
    }
    clearErrors('audio');

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
        isEditMode && editingPodcast?.id
          ? editingPodcast.id
          : `enjoymusic_podcast_${cleanTitle || uniqueId}_${uniqueId}`;
      const identifier = baseIdentifier;

      const audioFilename =
        audioFile?.name ||
        editingPodcast?.audioFilename ||
        `${cleanTitle || uniqueId}.audio`;

      const audioMimeType =
        audioFile?.type?.trim() ||
        editingPodcast?.audioMimeType;
      const audioSize = audioFile?.size ?? editingPodcast?.size ?? null;

      const createdTimestamp =
        isEditMode && editingPodcast?.created
          ? editingPodcast.created
          : now;

      const documentPayload: Record<string, unknown> = {
        id: identifier,
        title,
        description,
        category,
        created: createdTimestamp,
        updated: now,
        publisher: username,
        identifier,
      };

      if (audioFilename) {
        documentPayload.audio = {
          filename: audioFilename,
          ...(audioMimeType ? { mimeType: audioMimeType } : {}),
          ...(typeof audioSize === 'number' && audioSize > 0 ? { size: audioSize } : {}),
        };
      }

      documentPayload.version = 1;

      const descriptionSnippet = description.slice(0, 4000);
      const filenameBase = cleanTitle || uniqueId;
      const documentData64 = await objectToBase64(documentPayload);

      const resources: any[] = [
        {
          name: username,
          service: 'DOCUMENT',
          data64: documentData64,
          identifier,
          filename: `${filenameBase}.json`,
          title: `Podcast: ${title}`.slice(0, 55),
          description: descriptionSnippet,
        },
      ];

      if (audioFile) {
        resources.unshift({
          name: username,
          service: 'AUDIO',
          file: audioFile,
          identifier,
          filename: audioFilename,
          title: title.slice(0, 55),
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

      const optimisticPodcast: Podcast = {
        id: identifier,
        title,
        description,
        created: createdTimestamp,
        updated: now,
        publisher: username ?? '',
        service: 'AUDIO',
        coverImage: coverPreview || editingPodcast?.coverImage,
        audioFilename,
        audioMimeType,
        size: audioSize ?? undefined,
        category,
      };

      toast.success(isEditMode ? 'Podcast updated successfully!' : 'Podcast published successfully!');
      window.dispatchEvent(
        new CustomEvent('podcasts:refresh', {
          detail: {
            mode: isEditMode ? 'edit' : 'create',
            podcast: optimisticPodcast,
          },
        }),
      );
      window.dispatchEvent(new CustomEvent('statistics:refresh'));

      successTimeoutRef.current = window.setTimeout(() => {
        reset({
          title: '',
          description: '',
          category: '',
          cover: undefined,
          audio: undefined,
        });
        setCoverPreview(null);
        uploadPodcastModal.onClose();
        successTimeoutRef.current = null;
      }, 400);
    } catch (error: unknown) {
      console.error('Failed to publish podcast', error);
      let message = isEditMode ? 'Failed to update podcast' : 'Failed to publish podcast';
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
        setCoverPreview(null);
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
  }, [watch]);

  const displayedCoverPreview =
    coverPreview || (isEditMode ? editingPodcast?.coverImage || null : null);
  const selectedAudioFiles = watch('audio');
  const hasSelectedAudio =
    !!selectedAudioFiles && selectedAudioFiles.length > 0;

  return (
    <Modal
      title={isEditMode ? 'Edit podcast' : 'Publish new podcast'}
      description={
        isEditMode
          ? 'Update your podcast episode details'
          : 'Share a new podcast episode with listeners'
      }
      isOpen={uploadPodcastModal.isOpen}
      onChange={onChange}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">Podcast name</div>
          <Input
            id="title"
            disabled={isLoading}
            placeholder="Podcast name"
            maxLength={200}
            aria-invalid={errors.title ? 'true' : 'false'}
            {...register('title', {
              maxLength: {
                value: 200,
                message: 'Podcast name can be at most 200 characters',
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
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            Podcast description <span className="text-orange-300">*</span>
          </div>
          <Textarea
            id="description"
            disabled={isLoading}
            placeholder="Podcast description"
            className="h-40 resize-none"
            maxLength={4000}
            aria-invalid={errors.description ? 'true' : 'false'}
            {...register('description', {
              required: 'Podcast description is required',
              maxLength: {
                value: 4000,
                message: 'Podcast description can be at most 4000 characters',
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
            Category <span className="text-orange-300">*</span>
          </div>
          <select
            id="category"
            disabled={isLoading}
            defaultValue=""
            className="w-full rounded-md bg-sky-950/70 border border-sky-900/60 px-3 py-3 text-sm text-sky-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={errors.category ? 'true' : 'false'}
            {...register('category', { required: 'Please choose a category' })}
          >
            <option value="" disabled>
              Select a category
            </option>
            {PODCAST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.category.message}
            </p>
          )}
        </div>
        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            {isEditMode ? 'Select a new cover image (optional)' : 'Select a cover image'}{' '}
            <span className="text-xs font-medium uppercase text-sky-400">(optional)</span>
          </div>
          <Input
            placeholder="Upload cover"
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="cover"
            {...register('cover')}
          />
          {isEditMode && !coverPreview && editingPodcast?.coverImage && (
            <p className="mt-1 text-xs text-sky-300/80">
              Current cover will be kept if you do not upload a new image.
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
            {isEditMode ? 'Select a new podcast file (optional)' : 'Select a podcast file'}{' '}
            {!isEditMode && <span className="text-orange-300">*</span>}
          </div>
          <Input
            placeholder="Upload podcast"
            disabled={isLoading}
            type="file"
            accept="audio/*"
            id="audio"
            {...register('audio', { required: !isEditMode })}
          />
          {errors.audio && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              Please select a podcast file
            </p>
          )}
          {isEditMode && !hasSelectedAudio && editingPodcast?.audioFilename && (
            <p className="mt-1 text-xs text-sky-300/80">
              Current audio: {editingPodcast.audioFilename}
            </p>
          )}
        </div>
        <Button disabled={isLoading} type="submit" className="bg-orange-500 hover:bg-orange-400">
          {isEditMode ? 'Save Changes' : 'Publish Podcast'}
        </Button>
      </form>
    </Modal>
  );
};

export default UploadPodcastModal;
