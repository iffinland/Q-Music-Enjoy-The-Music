import ShortUniqueId from 'short-unique-id';
import React, { useEffect, useRef, useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Compressor from 'compressorjs';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import useFillRequestModal from '../../hooks/useFillRequestModal';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { objectToBase64, toBase64 } from '../../utils/toBase64';
import { addNewSong, setImageCoverHash } from '../../state/features/globalSlice';
import { removeTrailingUnderscore } from '../../utils/extra';
import { upsertRequestFill } from '../../state/features/requestsSlice';
import { useNavigate } from 'react-router-dom';

const uid = new ShortUniqueId();

interface FillRequestFormValues {
  title: string;
  author: string;
  song: FileList;
  image: FileList;
  description?: string;
}

const buildIdentifierSegment = (value: string, limit: number) => {
  const underscored = value.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  const sliced = underscored.slice(0, limit);
  return removeTrailingUnderscore(sliced);
};

const FillRequestModal: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const fillModal = useFillRequestModal();
  const [isLoading, setIsLoading] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);
  const successRedirectDelay = 1600;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
  } = useForm<FillRequestFormValues>({
    defaultValues: {
      title: '',
      author: '',
    },
  });

  useEffect(() => {
    if (fillModal.request) {
      setValue('title', fillModal.request.title);
      setValue('author', fillModal.request.artist);
    } else {
      reset({
        title: '',
        author: '',
      });
    }
  }, [fillModal.request, reset, setValue]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const onChange = (open: boolean) => {
    if (!open) {
      reset();
      fillModal.onClose();
    }
  };

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
            const file = new File([result], 'cover.webp', {
              type: 'image/webp',
            });
            compressedFile = file;
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
  };

  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    if (!fillModal.request) {
      toast.error('No request selected');
      return;
    }

    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    const imageFile = (values.image as FileList)?.[0];
    const songFile = (values.song as FileList)?.[0];
    const title = (values.title as string)?.trim();
    const author = (values.author as string)?.trim();

    if (!imageFile || !songFile || !title || !author) {
      toast.error('All fields are required');
      return;
    }

    setIsLoading(true);

    try {
      const compressedImg = await compressImg(imageFile);
      if (!compressedImg) {
        toast.error('Image compression failed');
        setIsLoading(false);
        return;
      }

      const uniqueId = uid(8);
      const titleSegment = buildIdentifierSegment(title, 20);
      const identifier = `enjoymusic_song_${titleSegment}_${uniqueId}`;
      const description = `title=${title};author=${author}`;
      const fileTitle = title.replace(/ /g, '_').slice(0, 20);
      const fileExtension = songFile.name?.split('.')?.pop() || 'mp3';
      const filename = `${fileTitle}.${fileExtension}`;

      const fillIdentifier = `enjoymusic_request_fill_${uniqueId}`;

      const resources: any[] = [
        {
          name: username,
          service: 'AUDIO',
          file: songFile,
          title,
          description,
          identifier,
          filename,
        },
        {
          name: username,
          service: 'THUMBNAIL',
          data64: compressedImg,
          identifier,
        },
      ];

      const fillPayload = {
        id: fillIdentifier,
        requestId: fillModal.request.id,
        filledBy: username,
        songIdentifier: identifier,
        songTitle: title,
        songArtist: author,
        created: Date.now(),
      };

      const fillData64 = await objectToBase64(fillPayload);
      resources.push({
        name: username,
        service: 'DOCUMENT',
        data64: fillData64,
        identifier: fillIdentifier,
        filename: `${fillIdentifier}.json`,
        title: `Filled: ${title}`.slice(0, 55),
        description: `Fill for ${fillModal.request.id}`,
      });

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });

      const songData = {
        title,
        description,
        created: Date.now(),
        updated: Date.now(),
        name: username,
        id: identifier,
        author,
      };

      dispatch(addNewSong(songData));
      dispatch(setImageCoverHash({ url: `data:image/webp;base64,${compressedImg}`, id: identifier }));
      dispatch(upsertRequestFill(fillPayload));

      toast.success('The request was filled successfully! Redirects...', { duration: successRedirectDelay });
      successTimeoutRef.current = window.setTimeout(() => {
        reset();
        fillModal.onClose();
        navigate('/');
        successTimeoutRef.current = null;
      }, successRedirectDelay);
    } catch (error) {
      toast.error('Failed to fill request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title="Fill request"
      description={fillModal.request ? `${fillModal.request.artist} - ${fillModal.request.title}` : 'Provide the requested song'}
      isOpen={fillModal.isOpen}
      onChange={onChange}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
        <Input
          id="title"
          disabled={isLoading}
          placeholder="Song title"
          {...register('title', { required: true })}
        />
        <Input
          id="author"
          disabled={isLoading}
          placeholder="Song singer / band"
          {...register('author', { required: true })}
        />
        {fillModal.request && (
          <div className="rounded-md border border-sky-900/60 bg-sky-950/70 px-3 py-3 text-sm text-sky-200/80">
            <p className="font-semibold text-white">Request details</p>
            <p className="pt-1">Artist/Band: {fillModal.request.artist}</p>
            <p>Title: {fillModal.request.title}</p>
            {fillModal.request.info && (
              <p className="pt-1 whitespace-pre-line">{fillModal.request.info}</p>
            )}
            <p className="pt-1 text-xs text-sky-300/70">Requested by {fillModal.request.publisher}</p>
          </div>
        )}
        <div>
          <div className="pb-1">
            Select a song file
          </div>
          <Input
            placeholder="Upload song"
            disabled={isLoading}
            type="file"
            accept="audio/*"
            id="song"
            {...register('song', { required: true })}
          />
        </div>
        <div>
          <div className="pb-1">
            Select an image
          </div>
          <Input
            placeholder="Upload cover image"
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="image"
            {...register('image', { required: true })}
          />
        </div>
        <Button disabled={isLoading} type="submit">
          FILL REQUEST
        </Button>
      </form>
    </Modal>
  );
};

export default FillRequestModal;
