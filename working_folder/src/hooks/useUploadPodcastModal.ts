import { create } from 'zustand';
import { Podcast } from '../types';

interface UploadPodcastModalStore {
  isOpen: boolean;
  mode: 'create' | 'edit';
  podcast?: Podcast;
  openCreate: () => void;
  openEdit: (podcast: Podcast) => void;
  onClose: () => void;
}

const useUploadPodcastModal = create<UploadPodcastModalStore>((set) => ({
  isOpen: false,
  mode: 'create',
  podcast: undefined,
  openCreate: () => set({ isOpen: true, mode: 'create', podcast: undefined }),
  openEdit: (podcast) => set({ isOpen: true, mode: 'edit', podcast }),
  onClose: () => set({ isOpen: false, mode: 'create', podcast: undefined }),
}));

export default useUploadPodcastModal;
