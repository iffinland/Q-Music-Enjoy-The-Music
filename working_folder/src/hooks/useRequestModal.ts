import { create } from 'zustand';
import { SongRequest } from '../state/features/requestsSlice';

interface RequestModalStore {
  isOpen: boolean;
  editingRequest: SongRequest | null;
  onOpen: (request?: SongRequest | null) => void;
  onClose: () => void;
}

const useRequestModal = create<RequestModalStore>((set) => ({
  isOpen: false,
  editingRequest: null,
  onOpen: (request?: SongRequest | null) =>
    set({
      isOpen: true,
      editingRequest: request ?? null,
    }),
  onClose: () =>
    set({
      isOpen: false,
      editingRequest: null,
    }),
}));

export default useRequestModal;
