import { create } from 'zustand';
import { SongRequest } from '../state/features/requestsSlice';

interface FillRequestModalStore {
  isOpen: boolean;
  request: SongRequest | null;
  onOpen: (request: SongRequest) => void;
  onClose: () => void;
}

const useFillRequestModal = create<FillRequestModalStore>((set) => ({
  isOpen: false,
  request: null,
  onOpen: (request: SongRequest) => set({ isOpen: true, request }),
  onClose: () => set({ isOpen: false, request: null }),
}));

export default useFillRequestModal;
