import { create } from 'zustand';
import { Video } from '../types';

interface UploadVideoModalStore {
  isOpen: boolean;
  mode: 'create' | 'edit';
  video?: Video;
  openCreate: () => void;
  openEdit: (video: Video) => void;
  onClose: () => void;
}

const useUploadVideoModal = create<UploadVideoModalStore>((set) => ({
  isOpen: false,
  mode: 'create',
  video: undefined,
  openCreate: () => set({ isOpen: true, mode: 'create', video: undefined }),
  openEdit: (video) => set({ isOpen: true, mode: 'edit', video }),
  onClose: () => set({ isOpen: false, mode: 'create', video: undefined }),
}));

export default useUploadVideoModal;
