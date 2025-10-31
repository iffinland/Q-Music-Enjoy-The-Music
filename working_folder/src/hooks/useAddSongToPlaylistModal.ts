import { create } from 'zustand';
import { Song } from '../types';

interface AddSongToPlaylistModalStore {
  isOpen: boolean;
  song: Song | null;
  onOpen: (song: Song) => void;
  onClose: () => void;
}

const useAddSongToPlaylistModal = create<AddSongToPlaylistModalStore>((set) => ({
  isOpen: false,
  song: null,
  onOpen: (song) => set({ isOpen: true, song }),
  onClose: () => set({ isOpen: false, song: null }),
}));

export default useAddSongToPlaylistModal;
