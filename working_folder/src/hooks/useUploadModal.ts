import { create } from 'zustand';
import { SongMeta } from '../state/features/globalSlice';

interface UploadModalStore {
  isModePickerOpen: boolean;
  isSingleOpen: boolean;
  isAlbumOpen: boolean;
  songToEdit: SongMeta | null;
  openPicker: () => void;
  openSingle: () => void;
  openSingleEdit: (song: SongMeta) => void;
  openAlbum: () => void;
  closePicker: () => void;
  closeSingle: () => void;
  closeAlbum: () => void;
  reset: () => void;
}

const initialState = {
  isModePickerOpen: false,
  isSingleOpen: false,
  isAlbumOpen: false,
  songToEdit: null as SongMeta | null,
};

const useUploadModal = create<UploadModalStore>((set) => ({
  ...initialState,
  openPicker: () =>
    set({
      isModePickerOpen: true,
      isSingleOpen: false,
      isAlbumOpen: false,
      songToEdit: null,
    }),
  openSingle: () =>
    set({
      isModePickerOpen: false,
      isSingleOpen: true,
      isAlbumOpen: false,
      songToEdit: null,
    }),
  openSingleEdit: (song) =>
    set({
      isModePickerOpen: false,
      isSingleOpen: true,
      isAlbumOpen: false,
      songToEdit: song,
    }),
  openAlbum: () =>
    set({
      isModePickerOpen: false,
      isSingleOpen: false,
      isAlbumOpen: true,
      songToEdit: null,
    }),
  closePicker: () =>
    set((state) => ({
      ...state,
      isModePickerOpen: false,
    })),
  closeSingle: () =>
    set((state) => ({
      ...state,
      isSingleOpen: false,
      songToEdit: null,
    })),
  closeAlbum: () =>
    set((state) => ({
      ...state,
      isAlbumOpen: false,
    })),
  reset: () => set(initialState),
}));

export default useUploadModal;
