import { create } from 'zustand';

interface RequestModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const useRequestModal = create<RequestModalStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));

export default useRequestModal;
