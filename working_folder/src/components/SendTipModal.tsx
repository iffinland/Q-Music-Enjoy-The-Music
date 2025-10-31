import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import useSendTipModal from '../hooks/useSendTipModal';

const DEFAULT_AMOUNT = '5';
const ADJUST_STEP = 1;

const sanitizeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractBalance = (payload: any): number | null => {
  if (!payload) return null;

  const candidates = [
    payload?.available,
    payload?.availableBalance,
    payload?.balance,
    payload?.confirmedBalance,
    payload,
  ];

  for (const candidate of candidates) {
    const parsed = sanitizeNumber(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const formatAmountValue = (value: number): string => {
  if (!Number.isFinite(value)) return DEFAULT_AMOUNT;
  const clamped = Math.max(0, value);
  const fixed = clamped.toFixed(8);
  return fixed.replace(/\.?0+$/, '') || '0';
};

const formatBalanceDisplay = (balance: number | null): string => {
  if (balance === null) return 'N/A';
  return `${balance.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  })} QORT`;
};

const SendTipModal: React.FC = () => {
  const { isOpen, recipient, close } = useSendTipModal();
  const [amount, setAmount] = useState<string>(DEFAULT_AMOUNT);
  const [balance, setBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setAmount(DEFAULT_AMOUNT);
      setBalance(null);
      setIsBalanceLoading(false);
      setIsSubmitting(false);
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    const fetchBalance = async () => {
      setIsBalanceLoading(true);
      try {
        const response = await qortalRequest({
          action: 'GET_WALLET_BALANCE',
          coin: 'QORT',
        });
        if (isCancelled) return;

        const parsedBalance = extractBalance(response);
        setBalance(parsedBalance);
      } catch (error) {
        console.error('Failed to fetch QORT balance', error);
        if (!isCancelled) {
          setBalance(null);
          toast.error('Could not load your QORT balance.');
        }
      } finally {
        if (!isCancelled) {
          setIsBalanceLoading(false);
        }
      }
    };

    fetchBalance();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const handleClose = () => {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    close();
  };

  const adjustAmount = (delta: number) => {
    setAmount((prev) => {
      const previousAmount = sanitizeNumber(prev) ?? 0;
      const next = previousAmount + delta;
      return formatAmountValue(next);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!recipient) {
      toast.error('Missing creator information.');
      return;
    }

    const numericAmount = sanitizeNumber(amount);

    if (numericAmount === null || numericAmount <= 0) {
      toast.error('Enter a valid amount greater than zero.');
      return;
    }

    if (balance !== null && numericAmount > balance) {
      toast.error('Insufficient balance for this tip.');
      return;
    }

    try {
      setIsSubmitting(true);
      await qortalRequest({
        action: 'SEND_COIN',
        coin: 'QORT',
        recipient,
        amount: numericAmount,
      });

      toast.success('Tip sending was successful.', {
        duration: 2500,
      });

      successTimeoutRef.current = window.setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (error) {
      console.error('Failed to send tip', error);
      toast.error('Could not send the tip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      title="Send Tips to this creators"
      description="Support creators with a QORT tip."
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="rounded-md border border-sky-900/60 bg-sky-950/60 p-4 text-sm text-sky-200/90">
          <div className="flex items-center justify-between">
            <span>Balance:</span>
            <span className="font-semibold text-white">
              {isBalanceLoading ? 'Loading…' : formatBalanceDisplay(balance)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>To:</span>
            <span className="font-semibold text-white">
              {recipient || 'Unknown'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm font-semibold text-sky-100">
          <label htmlFor="tip-amount">Amount</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustAmount(-ADJUST_STEP)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-sky-900/60 bg-sky-950/70 text-lg text-sky-100 transition hover:text-white"
            >
              –
            </button>
            <Input
              id="tip-amount"
              type="number"
              min="0"
              step="0.00000001"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="text-center text-base"
              placeholder="Enter amount"
            />
            <button
              type="button"
              onClick={() => adjustAmount(ADJUST_STEP)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-sky-900/60 bg-sky-950/70 text-lg text-sky-100 transition hover:text-white"
            >
              +
            </button>
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          SEND TIPS
        </Button>
      </form>
    </Modal>
  );
};

export default SendTipModal;
