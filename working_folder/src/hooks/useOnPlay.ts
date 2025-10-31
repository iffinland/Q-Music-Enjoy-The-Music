
import usePlayer from "./usePlayer";
import useAuthModal from "./useAuthModal";
import { Song } from "../types";

const useOnPlay = (songs: Song[]) => {
  const player = usePlayer();


  const onPlay = (id: string) => {


    player.setId(id);
    player.setIds(songs.map((song) => song.id));
  }

  return onPlay;
};

export default useOnPlay;
