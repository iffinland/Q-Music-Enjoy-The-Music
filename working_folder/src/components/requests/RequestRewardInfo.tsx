import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import Button from '../Button';
import { RootState } from '../../state/store';
import useSendTipModal from '../../hooks/useSendTipModal';
import { RequestFill, SongRequest, upsertSongRequest } from '../../state/features/requestsSlice';
import { updateRequest } from '../../services/qdnRequests';

const formatTimestamp = (value?: number) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const formatAmount = (value: number) => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
};

interface RequestRewardInfoProps {
  request: SongRequest;
  fill?: RequestFill;
  onRequestUpdated?: (next: SongRequest) => void;
}

const RequestRewardInfo: React.FC<RequestRewardInfoProps> = ({ request, fill, onRequestUpdated }) => {
  const dispatch = useDispatch();
  const sendTipModal = useSendTipModal();
  const username = useSelector((state: RootState) => state.auth.user?.name);

  const rewardAmount = request.rewardAmount ?? 0;
  const rewardCoin = request.rewardCoin ?? 'QORT';
  const rewardPaidAt = request.rewardPaidAt;
  const rewardPaidBy = request.rewardPaidBy;
  const fillerName = request.filledBy || fill?.filledBy;
  const fillerAddress = request.filledByAddress || fill?.filledByAddress;

  const hasReward = rewardAmount > 0;
  const isOwner = Boolean(username && username === request.publisher);
  const isFilled = useMemo(() => {
    const normalizedStatus = (request.status || '').toLowerCase();
    return (
      normalizedStatus === 'filled'
      || Boolean(request.filledAt)
      || Boolean(request.filledSongIdentifier)
      || Boolean(fillerAddress)
    );
  }, [request, fillerAddress]);

  const canPayReward = Boolean(hasReward && isOwner && isFilled && fillerAddress && !rewardPaidAt);

  if (!hasReward) {
    return null;
  }

  const handleAfterPayout = async (amountPaid: number) => {
    try {
      const payload: SongRequest = {
        ...request,
        rewardPaidAt: Date.now(),
        rewardPaidBy: username || request.publisher,
        rewardPaidAmount: amountPaid,
      };
      const updatedRequest = await updateRequest(payload);
      dispatch(upsertSongRequest(updatedRequest));
      if (onRequestUpdated) {
        onRequestUpdated(updatedRequest);
      }
      window.dispatchEvent(new CustomEvent('requests:refresh'));
      toast.success('Reward marked as paid.');
    } catch (error) {
      console.error('Failed to update reward status', error);
      toast.error('Failed to mark the reward as paid. Check your connection and try again.');
    }
  };

  const handlePayReward = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!fillerAddress) {
      toast.error('Fulfiller address was not found.');
      return;
    }
    sendTipModal.open({
      recipient: fillerAddress,
      amount: rewardAmount,
      onSuccess: handleAfterPayout,
    });
  };

  return (
    <div className="rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-3 text-sm text-amber-50/90">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-amber-100">
            Completion reward: {formatAmount(rewardAmount)} {rewardCoin}
          </p>
          {rewardPaidAt ? (
            <p className="text-xs text-amber-200/80">
              Paid on {formatTimestamp(rewardPaidAt)}
              {rewardPaidBy ? ` · ${rewardPaidBy}` : ''}
              {request.rewardPaidAmount
                ? ` · ${formatAmount(request.rewardPaidAmount)} ${rewardCoin}`
                : ''}
            </p>
          ) : (
            <p className="text-xs text-amber-200/80">
              {isOwner
                ? fillerName
                  ? `Pending payout to ${fillerName} (${fillerAddress})`
                  : 'Pending payout to the fulfiller'
                : 'Waiting for payment from the publisher'}
            </p>
          )}
        </div>
        {canPayReward && (
          <Button
            onClick={handlePayReward}
            className="bg-amber-500 text-black hover:bg-amber-400 px-4 py-2 text-xs font-semibold uppercase"
          >
            Send reward
          </Button>
        )}
      </div>
      {!rewardPaidAt && !canPayReward && isOwner && !isFilled && (
        <p className="mt-2 text-xs text-amber-200/70">You can send the reward after the request is filled.</p>
      )}
    </div>
  );
};

export default RequestRewardInfo;
