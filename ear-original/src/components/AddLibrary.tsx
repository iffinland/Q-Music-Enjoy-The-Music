
import { TbPlaylist } from "react-icons/tb";
import { AiOutlinePlus } from "react-icons/ai";
import { toast } from "react-hot-toast";
import MediaItem from "./MediaItem";
import { Song } from "../types";
import useUploadModal from "../hooks/useUploadModal";
import useUploadPlaylistModal from "../hooks/useUploadPlaylistModal";
import useOnPlay from "../hooks/useOnPlay";
import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { useFetchSongs } from "../hooks/fetchSongs";
import LazyLoad from "./common/LazyLoad";
import { FcMusic } from "react-icons/fc"
import { BsMusicNoteList, BsMusicNote } from "react-icons/bs"
import { setNewPlayList } from "../state/features/globalSlice";
import Portal from "./common/Portal";

interface LibraryProps {
  songs: Song[];
}

export const AddLibrary: React.FC<LibraryProps> = ({
  songs
}) => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);

  const dispatch = useDispatch()
  const uploadModal = useUploadModal();
  const uploadPlaylistModal = useUploadPlaylistModal()

  const onClick = () => {
    if (!username) {
      toast.error('Please authenticate')
      return
    }

    return uploadModal.onOpen();
  }

  const onClickPlaylist = () => {

    dispatch(setNewPlayList({
      title: "",
      description: "",
      songs: [],
      image: null
    }))




  }


  return (
    <>

      <div className="flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="inline-flex items-center gap-x-2">
            <BsMusicNote className="text-neutral-400" size={26} />
            <p className="text-neutral-400 font-medium text-md">
              Add Song
            </p>
          </div>
          <AiOutlinePlus
            onClick={onClick}
            size={20}
            className="
            text-neutral-400 
            cursor-pointer 
            hover:text-white 
            transition
          "
          />
        </div>
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="inline-flex items-center gap-x-2">
            <BsMusicNoteList className="text-neutral-400" size={26} />
            <p className="text-neutral-400 font-medium text-md">
              Add Playlist
            </p>
          </div>
          <AiOutlinePlus
            onClick={onClickPlaylist}
            size={20}
            className="
            text-neutral-400 
            cursor-pointer 
            hover:text-white 
            transition
          "
          />
        </div>
      </div>
      {newPlaylist && (
        <Portal>
          <div className="bg-red-500 fixed top-10 right-5 p-3 flex flex-col space-y-2">
            <div className="flex space-x-2">
              <p>{newPlaylist?.title || 'New Playlist'}</p>
              <p>{newPlaylist?.songs?.length}</p>
            </div>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={() => { uploadPlaylistModal.onOpen() }}
            >
              Save Playlist
            </button>
            <button
              className="bg-gray-300 text-black px-2 py-1 rounded text-sm"
              onClick={() => {dispatch(setNewPlayList(null)) }}
            >
              Cancel
            </button>
          </div>
        </Portal>
      )}
    </>
  );
}

