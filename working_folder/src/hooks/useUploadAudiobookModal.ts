import { create } from 'zustand';
import { Audiobook } from '../types';

interface UploadAudiobookModalStore {
  isOpen: boolean;
  mode: 'create' | 'edit';
  audiobook?: Audiobook;
  openCreate: () => void;
  openEdit: (audiobook: Audiobook) => void;
  onClose: () => void;
}

const useUploadAudiobookModal = create<UploadAudiobookModalStore>((set) => ({
  isOpen: false,
  mode: 'create',
  audiobook: undefined,
  openCreate: () => set({ isOpen: true, mode: 'create', audiobook: undefined }),
  openEdit: (audiobook) => set({ isOpen: true, mode: 'edit', audiobook }),
  onClose: () => set({ isOpen: false, mode: 'create', audiobook: undefined }),
}));

export default useUploadAudiobookModal;
