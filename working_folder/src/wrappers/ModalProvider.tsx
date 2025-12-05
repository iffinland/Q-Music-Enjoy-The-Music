
import { useEffect, useState } from "react";
import UploadModal from "../components/UploadModal";
import UploadPlaylistModal from "../components/UploadPlaylistModal";
import UploadPodcastModal from "../components/UploadPodcastModal";
import UploadAudiobookModal from "../components/UploadAudiobookModal";
import AddRequestModal from "../components/requests/AddRequestModal";
import FillRequestModal from "../components/requests/FillRequestModal";
import AddSongToPlaylistModal from "../components/AddSongToPlaylistModal";
import SendTipModal from "../components/SendTipModal";



const ModalProvider: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <UploadModal />
      <AddRequestModal />
      <FillRequestModal />
      <UploadPodcastModal />
      <UploadAudiobookModal />
      <AddSongToPlaylistModal />
      <SendTipModal />
      <UploadPlaylistModal />
     
    </>
  );
}

export default ModalProvider;
