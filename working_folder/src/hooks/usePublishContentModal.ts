import { create } from 'zustand';
import { PublishType } from '../types/publish';

interface PublishContentModalStore {
  isOpen: boolean;
  preferredType: PublishType;
  open: (type?: PublishType) => void;
  openMulti: () => void;
  close: () => void;
}

const DEFAULT_TYPE: PublishType = 'audio';

const usePublishContentModal = create<PublishContentModalStore>((set) => ({
  isOpen: false,
  preferredType: DEFAULT_TYPE,
  open: (type = DEFAULT_TYPE) =>
    set({
      isOpen: true,
      preferredType: type,
    }),
  openMulti: () =>
    set({
      isOpen: true,
      preferredType: 'multi',
    }),
  close: () =>
    set({
      isOpen: false,
      preferredType: DEFAULT_TYPE,
    }),
}));

export default usePublishContentModal;
