import { create } from 'zustand';

interface UploadModalStore {
  isModePickerOpen: boolean;
  isSingleOpen: boolean;
  isAlbumOpen: boolean;
  openPicker: () => void;
  openSingle: () => void;
  openAlbum: () => void;
  closePicker: () => void;
  closeSingle: () => void;
  closeAlbum: () => void;
  reset: () => void;
}

const useUploadModal = create<UploadModalStore>((set) => ({
  isModePickerOpen: false,
  isSingleOpen: false,
  isAlbumOpen: false,
  openPicker: () => set({ isModePickerOpen: true, isSingleOpen: false, isAlbumOpen: false }),
  openSingle: () => set({ isModePickerOpen: false, isSingleOpen: true, isAlbumOpen: false }),
  openAlbum: () => set({ isModePickerOpen: false, isSingleOpen: false, isAlbumOpen: true }),
  closePicker: () => set({ isModePickerOpen: false }),
  closeSingle: () => set({ isSingleOpen: false }),
  closeAlbum: () => set({ isAlbumOpen: false }),
  reset: () => set({ isModePickerOpen: false, isSingleOpen: false, isAlbumOpen: false }),
}));

export default useUploadModal;
