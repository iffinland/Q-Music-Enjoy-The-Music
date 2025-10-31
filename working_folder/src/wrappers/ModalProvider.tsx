
import { useEffect, useState } from "react";
import UploadModal from "../components/UploadModal";
import UploadAlbumModal from "../components/UploadAlbumModal";
import UploadPlaylistModal from "../components/UploadPlaylistModal";
import UploadPodcastModal from "../components/UploadPodcastModal";
import UploadVideoModal from "../components/UploadVideoModal";
import AddRequestModal from "../components/requests/AddRequestModal";
import FillRequestModal from "../components/requests/FillRequestModal";
import AddSongToPlaylistModal from "../components/AddSongToPlaylistModal";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import SendTipModal from "../components/SendTipModal";
import SongUploadModeModal from "../components/SongUploadModeModal";



const ModalProvider: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <SongUploadModeModal />
      <UploadModal />
      <UploadAlbumModal />
      <AddRequestModal />
      <FillRequestModal />
      <UploadPodcastModal />
      <UploadVideoModal />
      <AddSongToPlaylistModal />
      <SendTipModal />
      {newPlaylist && (
         <UploadPlaylistModal />
      )}
     
    </>
  );
}

export default ModalProvider;
