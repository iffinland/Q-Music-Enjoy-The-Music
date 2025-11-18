import { create } from 'zustand';
import { SongMeta } from '../state/features/globalSlice';

interface UploadModalStore {
  isSingleOpen: boolean;
  songToEdit: SongMeta | null;
  openSingle: () => void;
  openSingleEdit: (song: SongMeta) => void;
  closeSingle: () => void;
  reset: () => void;
}

const initialState = {
  isSingleOpen: false,
  songToEdit: null as SongMeta | null,
};

const useUploadModal = create<UploadModalStore>((set) => ({
  ...initialState,
  openSingle: () =>
    set({
      isSingleOpen: true,
      songToEdit: null,
    }),
  openSingleEdit: (song) =>
    set({
      isSingleOpen: true,
      songToEdit: song,
    }),
  closeSingle: () =>
    set((state) => ({
      ...state,
      isSingleOpen: false,
      songToEdit: null,
    })),
  reset: () => set(initialState),
}));

export default useUploadModal;
