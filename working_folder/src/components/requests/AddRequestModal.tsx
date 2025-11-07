import ShortUniqueId from 'short-unique-id';
import React, { useEffect, useState } from 'react';
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
import { updateRequest } from '../../services/qdnRequests';

const uid = new ShortUniqueId();

const DEFAULT_REWARD = '1';

interface AddRequestFormValues {
  artist: string;
  title: string;
  info?: string;
  rewardAmount: string;
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
      rewardAmount: DEFAULT_REWARD,
    },
  });

  const editingRequest = requestModal.editingRequest;
  const isEditing = Boolean(editingRequest);

  useEffect(() => {
    if (!requestModal.isOpen) {
      return;
    }
    if (editingRequest) {
      reset({
        artist: editingRequest.artist,
        title: editingRequest.title,
        info: editingRequest.info || '',
        rewardAmount: editingRequest.rewardAmount !== undefined
          ? String(editingRequest.rewardAmount)
          : DEFAULT_REWARD,
      });
    } else {
      reset({
        artist: '',
        title: '',
        info: '',
        rewardAmount: DEFAULT_REWARD,
      });
    }
  }, [editingRequest, requestModal.isOpen, reset]);

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
    const rewardAmountRaw = (values.rewardAmount as string)?.trim() || DEFAULT_REWARD;

    const rewardAmount = Number.parseFloat(rewardAmountRaw);
    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
      toast.error('Sisesta kehtiv tasu, mis on suurem kui 0.');
      return;
    }

    const rewardCoin = 'QORT';

    if (!artist || !title) {
      toast.error('Missing required fields');
      return;
    }

    if (isEditing && editingRequest) {
      if (editingRequest.publisher !== username) {
        toast.error('Only the original author can edit this request.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isEditing && editingRequest) {
        const payload: SongRequest = {
          ...editingRequest,
          artist,
          title,
          info,
          rewardAmount,
          rewardCoin,
        };

        const updatedRequest = await updateRequest(payload);
        dispatch(upsertSongRequest(updatedRequest));
        toast.success('Request updated!');
      } else {
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
          rewardAmount,
          rewardCoin,
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
      }

      reset();
      requestModal.onClose();
      window.dispatchEvent(new CustomEvent('requests:refresh'));
    } catch (error) {
      toast.error(isEditing ? 'Failed to update request' : 'Failed to add request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title={isEditing ? 'Edit request' : 'Add new request'}
      description={isEditing ? 'Update the request details' : 'Request a song, album, or artist to be added'}
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
        <div className="space-y-2">
          <label htmlFor="reward-amount" className="text-sm font-semibold text-sky-100">
            Fill reward (QORT)
          </label>
          <Input
            id="reward-amount"
            type="number"
            min="0.00000001"
            step="0.00000001"
            disabled={isLoading}
            placeholder="1"
            {...register('rewardAmount')}
          />
          <p className="text-xs text-sky-300/70">
            See summa makstakse täitjale käsitsi pärast requesti kinnitamist.
          </p>
        </div>
        <Button disabled={isLoading} type="submit" className="bg-amber-600 hover:bg-amber-500">
          {isEditing ? 'SAVE CHANGES' : 'ADD REQUEST'}
        </Button>
      </form>
    </Modal>
  );
};

export default AddRequestModal;
