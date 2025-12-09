import ShortUniqueId from 'short-unique-id';
import Compressor from 'compressorjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';

import Modal from './Modal';
import Input from './Input';
import Textarea from './TextArea';
import Button from './Button';
import useUploadAudiobookModal from '../hooks/useUploadAudiobookModal';
import { RootState } from '../state/store';
import { objectToBase64, toBase64 } from '../utils/toBase64';
import { removeTrailingUnderscore } from '../utils/extra';
import { stripDiacritics } from '../utils/stringHelpers';
import { AUDIOBOOK_CATEGORIES } from '../constants/categories';
import { Audiobook } from '../types';

const uid = new ShortUniqueId();
const IDENTIFIER_PREFIX = 'enjoymusic_audiobooks_';
const MAX_IDENTIFIER_LENGTH = 64;

interface UploadAudiobookFormValues {
  title: string;
  description: string;
  category: string;
  cover: FileList | null;
  audio: FileList | null;
}

const DEFAULT_VALUES: UploadAudiobookFormValues = {
  title: '',
  description: '',
  category: '',
  cover: null,
  audio: null,
};

const compressImage = async (file: File): Promise<string | null> => {
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
    console.error('Failed to compress image', error);
    return null;
  }
};

const sanitizeTitleForIdentifier = (value: string) => {
  if (!value) return '';
  const underscored = value.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  return removeTrailingUnderscore(underscored);
};

const UploadAudiobookModal: React.FC = () => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const uploadAudiobookModal = useUploadAudiobookModal();
  const isEditMode = uploadAudiobookModal.mode === 'edit';
  const editingAudiobook = uploadAudiobookModal.audiobook;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [selectedAudioName, setSelectedAudioName] = useState<string | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<UploadAudiobookFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!uploadAudiobookModal.isOpen) {
      reset(DEFAULT_VALUES);
      setCoverPreview(null);
      setSelectedAudioName(null);
      return;
    }

    if (isEditMode && editingAudiobook) {
      reset({
        title: editingAudiobook.title || '',
        description: editingAudiobook.description || '',
        category: editingAudiobook.category || '',
        cover: null,
        audio: null,
      });
      setCoverPreview(editingAudiobook.coverImage || null);
      setSelectedAudioName(editingAudiobook.audioFilename || null);
    } else {
      reset(DEFAULT_VALUES);
      setCoverPreview(null);
      setSelectedAudioName(null);
    }
  }, [uploadAudiobookModal.isOpen, isEditMode, editingAudiobook, reset]);

  useEffect(() => {
    const subscription = watch((value) => {
      const coverFile = value.cover?.[0] || null;
      if (coverFile) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setCoverPreview(reader.result);
          }
        };
        reader.readAsDataURL(coverFile);
      } else if (!isEditMode) {
        setCoverPreview(null);
      }

      const audioFile = value.audio?.[0] || null;
      if (audioFile) {
        setSelectedAudioName(audioFile.name);
      } else if (!isEditMode) {
        setSelectedAudioName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, isEditMode]);

  const handleClose = useCallback(() => {
    reset(DEFAULT_VALUES);
    setCoverPreview(null);
    setSelectedAudioName(null);
    uploadAudiobookModal.onClose();
  }, [reset, uploadAudiobookModal]);

  const onChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose();
      }
    },
    [handleClose],
  );

  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    if (isSubmitting) return;

    const rawTitle = (values.title as string | undefined) ?? '';
    const rawDescription = (values.description as string | undefined) ?? '';
    const rawCategory = (values.category as string | undefined) ?? '';
    const coverFile = (values.cover as FileList | null)?.[0] || null;
    const audioFile = (values.audio as FileList | null)?.[0] || null;

    const title = rawTitle.trim();
    const description = rawDescription.trim();
    const category = rawCategory.trim();

    if (!title) {
      setError('title', { type: 'manual', message: 'Audiobook title is required' });
      toast.error('Audiobook title is required');
      return;
    }
    if (title.length > 200) {
      setError('title', { type: 'manual', message: 'Audiobook title can be at most 200 characters' });
      toast.error('Audiobook title can be at most 200 characters');
      return;
    }
    clearErrors('title');

    if (!description) {
      setError('description', { type: 'manual', message: 'Audiobook description is required' });
      toast.error('Audiobook description is required');
      return;
    }
    if (description.length > 4000) {
      setError('description', { type: 'manual', message: 'Audiobook description can be at most 4000 characters' });
      toast.error('Audiobook description can be at most 4000 characters');
      return;
    }
    clearErrors('description');

    if (!category) {
      setError('category', { type: 'manual', message: 'Please choose a category' });
      toast.error('Please choose a category');
      return;
    }
    clearErrors('category');

    if (!audioFile && !isEditMode) {
      setError('audio', { type: 'manual', message: 'Please select an audiobook file' });
      toast.error('Please select an audiobook file');
      return;
    }
    clearErrors('audio');

    setIsSubmitting(true);

    try {
      const now = Date.now();
      const uniqueId = uid(8);
      const sanitizedForIdentifier = sanitizeTitleForIdentifier(
        stripDiacritics(title) || title,
      );
      const maxTitleSegmentLength =
        MAX_IDENTIFIER_LENGTH - IDENTIFIER_PREFIX.length - 1 - uniqueId.length;
      const trimmedSanitized =
        sanitizedForIdentifier && sanitizedForIdentifier.length > 0
          ? sanitizedForIdentifier.slice(0, Math.max(0, maxTitleSegmentLength))
          : '';
      const identifierBase = trimmedSanitized.length > 0 ? trimmedSanitized : uniqueId;
      const identifier =
        isEditMode && editingAudiobook?.id
          ? editingAudiobook.id
          : `${IDENTIFIER_PREFIX}${identifierBase}_${uniqueId}`;

      const audioFilename =
        audioFile?.name ||
        editingAudiobook?.audioFilename ||
        `${identifierBase || uniqueId}.audio`;
      const audioMimeType = audioFile?.type?.trim() || editingAudiobook?.audioMimeType || '';
      const audioSize =
        (typeof audioFile?.size === 'number' && audioFile.size > 0
          ? audioFile.size
          : editingAudiobook?.size) ?? null;

      const createdTimestamp =
        isEditMode && typeof editingAudiobook?.created === 'number'
          ? editingAudiobook.created
          : now;

      const safeMetadataTitleSource = stripDiacritics(title).trim() || title;
      const safeMetadataDescriptionSource =
        stripDiacritics(description).trim() || description;
      const metadataTitle = (safeMetadataTitleSource || 'Untitled audiobook').slice(0, 55);
      const metadataDescription = (safeMetadataDescriptionSource || description).slice(0, 512);

      const documentPayload: Record<string, unknown> = {
        id: identifier,
        title,
        description,
        category,
        created: createdTimestamp,
        updated: now,
        publisher: username,
        identifier,
        version: 1,
      };

      if (audioFilename) {
        documentPayload.audio = {
          filename: audioFilename,
          ...(audioMimeType ? { mimeType: audioMimeType } : {}),
          ...(typeof audioSize === 'number' && audioSize > 0 ? { size: audioSize } : {}),
        };
      }

      const documentData64 = await objectToBase64(documentPayload);

      const audioResource: Record<string, unknown> | null = audioFile
        ? {
            name: username,
            service: 'AUDIO',
            file: audioFile,
            identifier,
            filename: audioFilename,
            title: metadataTitle,
            description: metadataDescription,
            ...(audioMimeType ? { mimeType: audioMimeType } : {}),
            ...(typeof audioSize === 'number' && audioSize > 0 ? { size: audioSize } : {}),
          }
        : null;
      let coverResource: Record<string, unknown> | null = null;

      const resources: any[] = [
        {
          name: username,
          service: 'DOCUMENT',
          data64: documentData64,
          identifier,
          filename: `${identifierBase || uniqueId}.json`,
          title: metadataTitle,
          description: metadataDescription,
          encoding: 'base64',
          mimeType: 'application/json',
        },
      ];

      if (audioResource) {
        resources.unshift(audioResource);
      }

      if (coverFile) {
        const compressedImg = await compressImage(coverFile);
        if (!compressedImg) {
          toast.error('Image compression failed');
          setIsSubmitting(false);
          return;
        }
        coverResource = {
          name: username,
          service: 'THUMBNAIL',
          data64: compressedImg,
          identifier,
          filename: 'cover.webp',
          encoding: 'base64',
          mimeType: 'image/webp',
        };
        resources.push(coverResource);
      }

      const publishMultiple = async () =>
        qortalRequest({
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources,
        });

      const publishIndividually = async () => {
        if (audioResource && audioFile) {
          await qortalRequest({
            action: 'PUBLISH_QDN_RESOURCE',
            name: username,
            service: 'AUDIO',
            identifier,
            file: audioFile,
            filename: audioFilename,
            title: metadataTitle,
            description: metadataDescription,
          });
        }

        await qortalRequest({
          action: 'PUBLISH_QDN_RESOURCE',
          name: username,
          service: 'DOCUMENT',
          identifier,
          data64: documentData64,
          encoding: 'base64',
          filename: `${identifierBase || uniqueId}.json`,
          title: metadataTitle,
          description: metadataDescription,
          mimeType: 'application/json',
        });

        const coverPayload = coverResource as { data64?: string } | null;
        if (coverPayload?.data64) {
          await qortalRequest({
            action: 'PUBLISH_QDN_RESOURCE',
            name: username,
            service: 'THUMBNAIL',
            identifier,
            data64: coverPayload.data64,
            encoding: 'base64',
            filename: 'cover.webp',
            title: metadataTitle,
            description: metadataDescription,
            mimeType: 'image/webp',
          });
        }
      };

      try {
        await publishMultiple();
      } catch (publishError: unknown) {
        const shouldFallback =
          typeof publishError === 'object' &&
          publishError !== null &&
          Array.isArray(
            (publishError as { error?: { unsuccessfulPublishes?: unknown } }).error
              ?.unsuccessfulPublishes,
          );

        if (!shouldFallback) {
          throw publishError;
        }

        console.warn(
          'Batch publish failed, retrying individual resource publish...',
          publishError,
        );
        await publishIndividually();
      }

      const optimisticAudiobook: Audiobook = {
        id: identifier,
        title,
        description,
        created: createdTimestamp,
        updated: now,
        publisher: username,
        service: 'AUDIO',
        coverImage: coverPreview || editingAudiobook?.coverImage,
        audioFilename,
        audioMimeType,
        size: audioSize ?? undefined,
        category,
        status: editingAudiobook?.status,
      };

      toast.success(isEditMode ? 'Audiobook updated successfully!' : 'Audiobook published successfully!');

      window.dispatchEvent(
        new CustomEvent('audiobooks:refresh', {
          detail: {
            mode: isEditMode ? 'edit' : 'create',
            audiobook: optimisticAudiobook,
          },
        }),
      );
      window.dispatchEvent(new CustomEvent('statistics:refresh'));

      successTimeoutRef.current = window.setTimeout(() => {
        handleClose();
        successTimeoutRef.current = null;
      }, 400);
    } catch (error: unknown) {
      console.error('Failed to publish audiobook', error);
      let message = isEditMode ? 'Failed to update audiobook' : 'Failed to publish audiobook';
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
      setIsSubmitting(false);
    }
  };

  const selectedCategoryOptions = useMemo(() => AUDIOBOOK_CATEGORIES, []);

  return (
    <Modal
      title={isEditMode ? 'Edit audiobook' : 'Publish new audiobook'}
      description={
        isEditMode
          ? 'Update your audiobook episode details'
          : 'Share a new audiobook episode with listeners'
      }
      isOpen={uploadAudiobookModal.isOpen}
      onChange={onChange}
      contentClassName="md:w-[60vw] md:max-w-[60vw]"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-5">
        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            Audiobook title <span className="text-orange-300">*</span>
          </div>
          <Input
            id="audiobook-title"
            placeholder="Audiobook title"
            disabled={isSubmitting}
            maxLength={200}
            aria-invalid={errors.title ? 'true' : 'false'}
            {...register('title', { required: true, maxLength: 200 })}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.title.message || 'Audiobook title is required'}
            </p>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            Description <span className="text-orange-300">*</span>
          </div>
          <Textarea
            id="audiobook-description"
            placeholder="Add a detailed description (max 4000 characters)"
            disabled={isSubmitting}
            className="h-40 resize-none"
            maxLength={4000}
            aria-invalid={errors.description ? 'true' : 'false'}
            {...register('description', { required: true, maxLength: 4000 })}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.description.message || 'Audiobook description is required'}
            </p>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            Category <span className="text-orange-300">*</span>
          </div>
          <select
            id="audiobook-category"
            disabled={isSubmitting}
            className="w-full rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-3 text-sm text-sky-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue=""
            aria-invalid={errors.category ? 'true' : 'false'}
            {...register('category', { required: true })}
          >
            <option value="" disabled>
              Select a category
            </option>
            {selectedCategoryOptions.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>
                {categoryOption}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.category.message || 'Please choose a category'}
            </p>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            {isEditMode ? 'Select a new cover image (optional)' : 'Select a cover image'}{' '}
            <span className="text-xs font-medium uppercase text-sky-400">(optional)</span>
          </div>
          <Input
            id="audiobook-cover"
            type="file"
            accept="image/*"
            disabled={isSubmitting}
            {...register('cover')}
          />
          {coverPreview && (
            <div className="mt-3 overflow-hidden rounded-lg border border-sky-900/60">
              <img
                src={coverPreview}
                alt="Selected cover"
                className="h-36 w-full object-cover"
              />
            </div>
          )}
          {!coverPreview && isEditMode && editingAudiobook?.coverImage && (
            <p className="mt-1 text-xs text-sky-300/80">
              Current cover will be kept if you do not upload a new image.
            </p>
          )}
        </div>

        <div>
          <div className="pb-1 text-sm font-semibold text-sky-200/80">
            {isEditMode ? 'Select a new audiobook file (optional)' : 'Select an audiobook file'}{' '}
            {!isEditMode && <span className="text-orange-300">*</span>}
          </div>
          <Input
            id="audiobook-audio"
            type="file"
            accept="audio/*"
            disabled={isSubmitting}
            {...register('audio')}
          />
          {errors.audio && (
            <p className="mt-1 text-xs text-orange-300" role="alert">
              {errors.audio.message || 'Please select an audiobook file'}
            </p>
          )}
          {selectedAudioName && (
            <p className="mt-1 text-xs text-sky-300/80">Selected file: {selectedAudioName}</p>
          )}
          {!selectedAudioName && isEditMode && editingAudiobook?.audioFilename && (
            <p className="mt-1 text-xs text-sky-300/80">
              Current audio: {editingAudiobook.audioFilename}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-orange-500 hover:bg-orange-400"
        >
          {isEditMode ? 'Save changes' : 'Publish audiobook'}
        </Button>
      </form>
    </Modal>
  );
};

export default UploadAudiobookModal;
