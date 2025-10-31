import { MouseEvent } from "react";
import { MdPlaylistAdd } from "react-icons/md";
import useAddSongToPlaylistModal from "../hooks/useAddSongToPlaylistModal";
import { Song } from "../types";
import { twMerge } from "tailwind-merge";

interface AddToPlaylistButtonProps {
  song: Song;
  className?: string;
  iconSize?: number;
}

export const AddToPlaylistButton: React.FC<AddToPlaylistButtonProps> = ({
  song,
  className,
  iconSize = 25
}) => {
  const playlistModal = useAddSongToPlaylistModal();

  const handleClick = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    playlistModal.onOpen(song);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={twMerge(
        "cursor-pointer rounded-full bg-sky-900/50 p-2 text-white transition hover:bg-sky-800/60",
        className
      )}
      aria-label="Add song to playlist"
      title="Add song to playlist"
    >
      <MdPlaylistAdd size={iconSize} className="pointer-events-none" />
    </button>
  );
};
