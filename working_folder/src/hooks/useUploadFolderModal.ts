import { create } from 'zustand';

interface UploadFolderModalStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const useUploadFolderModal = create<UploadFolderModalStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export default useUploadFolderModal;
