import { create } from 'zustand';

export interface SendTipModalOpenPayload {
  recipient: string;
  amount?: number | null;
  onSuccess?: (amount: number) => void;
}

interface SendTipModalState {
  isOpen: boolean;
  recipient?: string;
  amount?: number | null;
  onSuccess?: ((amount: number) => void) | null;
  open: (payload: string | SendTipModalOpenPayload) => void;
  close: () => void;
}

const useSendTipModal = create<SendTipModalState>((set) => ({
  isOpen: false,
  recipient: undefined,
  amount: null,
  onSuccess: null,
  open: (payload) => {
    if (typeof payload === 'string') {
      set({ isOpen: true, recipient: payload, amount: null, onSuccess: null });
      return;
    }
    set({
      isOpen: true,
      recipient: payload.recipient,
      amount: payload.amount ?? null,
      onSuccess: payload.onSuccess ?? null,
    });
  },
  close: () => set({ isOpen: false, recipient: undefined, amount: null, onSuccess: null }),
}));

export default useSendTipModal;
