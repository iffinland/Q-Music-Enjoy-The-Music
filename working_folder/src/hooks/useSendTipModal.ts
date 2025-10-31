import { create } from 'zustand';

interface SendTipModalState {
  isOpen: boolean;
  recipient?: string;
  open: (recipient: string) => void;
  close: () => void;
}

const useSendTipModal = create<SendTipModalState>((set) => ({
  isOpen: false,
  recipient: undefined,
  open: (recipient) => set({ isOpen: true, recipient }),
  close: () => set({ isOpen: false, recipient: undefined }),
}));

export default useSendTipModal;
