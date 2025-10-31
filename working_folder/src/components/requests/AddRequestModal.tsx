import ShortUniqueId from 'short-unique-id';
import React, { useState } from 'react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../Modal';
import Input from '../Input';
import Textarea from '../TextArea';
import Button from '../Button';
import useRequestModal from '../../hooks/useRequestModal';
import { RootState } from '../../state/store';
import { objectToBase64 } from '../../utils/toBase64';
import { removeTrailingUnderscore } from '../../utils/extra';
import { SongRequest, upsertSongRequest } from '../../state/features/requestsSlice';

const uid = new ShortUniqueId();

interface AddRequestFormValues {
  artist: string;
  title: string;
  info?: string;
}

const sanitizeForIdentifier = (value: string) => {
  const underscored = value.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  const sliced = underscored.slice(0, 32);
  return removeTrailingUnderscore(sliced);
};

const AddRequestModal: React.FC = () => {
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const dispatch = useDispatch();
  const requestModal = useRequestModal();
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<AddRequestFormValues>({
    defaultValues: {
      artist: '',
      title: '',
      info: '',
    },
  });

  const onChange = (open: boolean) => {
    if (!open) {
      reset();
      requestModal.onClose();
    }
  };

  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }

    const artist = (values.artist as string)?.trim();
    const title = (values.title as string)?.trim();
    const info = (values.info as string)?.trim() || '';

    if (!artist || !title) {
      toast.error('Missing required fields');
      return;
    }

    setIsLoading(true);

    try {
      const uniqueId = uid(8);
      const formattedTitle = sanitizeForIdentifier(title);
      const identifier = `enjoymusic_request_${formattedTitle || uniqueId}_${uniqueId}`;

      const payload: SongRequest = {
        id: identifier,
        artist,
        title,
        info,
        created: Date.now(),
        updated: Date.now(),
        publisher: username,
        status: 'open',
      };

      const data64 = await objectToBase64(payload);
      const resources = [
        {
          name: username,
          service: 'DOCUMENT',
          data64,
          identifier,
          filename: `${formattedTitle || uniqueId}.json`,
          title: `Request: ${title}`.slice(0, 55),
          description: `${artist} - ${title}`,
        },
      ];

      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources,
      });

      dispatch(upsertSongRequest(payload));
      toast.success('Request added!');
      reset();
      requestModal.onClose();
    } catch (error) {
      toast.error('Failed to add request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title="Add new request"
      description="Request a song, album, or artist to be added"
      isOpen={requestModal.isOpen}
      onChange={onChange}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
        <Input
          id="artist"
          disabled={isLoading}
          placeholder="Name of the artist or band"
          {...register('artist', { required: true })}
        />
        <Input
          id="title"
          disabled={isLoading}
          placeholder="Title of the song or album"
          {...register('title', { required: true })}
        />
        <Textarea
          id="info"
          disabled={isLoading}
          placeholder="Additional info (optional)"
          className="h-32 resize-none"
          {...register('info')}
        />
        <Button disabled={isLoading} type="submit" className="bg-amber-600 hover:bg-amber-500">
          ADD REQUEST
        </Button>
      </form>
    </Modal>
  );
};

export default AddRequestModal;
