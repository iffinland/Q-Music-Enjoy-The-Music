
import { useEffect, useState } from "react";
import UploadModal from "../components/UploadModal";
import UploadPlaylistModal from "../components/UploadPlaylistModal";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";



interface ModalProviderProps {
}

const ModalProvider: React.FC<ModalProviderProps> = () => {
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
     
      <UploadModal />
      {newPlaylist && (
         <UploadPlaylistModal />
      )}
     
    </>
  );
}

export default ModalProvider;