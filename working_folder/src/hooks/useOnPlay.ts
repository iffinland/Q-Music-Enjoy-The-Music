
import { useCallback, useContext, useMemo } from "react";
import { useDispatch } from "react-redux";

import { Song } from "../types";
import usePlayer from "./usePlayer";
import { MyContext } from "../wrappers/DownloadWrapper";
import { setCurrentPlaylist, setCurrentSong, setNowPlayingPlaylist } from "../state/features/globalSlice";

const useOnPlay = (songs: Song[]) => {
  const player = usePlayer();
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);

  const normalizedSongs = useMemo(
    () =>
      songs
        .filter((song) => Boolean(song?.id))
        .map((song) => ({
          ...song,
          service: song.service || "AUDIO",
        })),
    [songs],
  );

  const onPlay = useCallback(
    async (id: string) => {
      const song = normalizedSongs.find((entry) => entry.id === id);
      if (!song || !song.name) return;

      player.setId(id);
      player.setIds(normalizedSongs.map((entry) => entry.id));

      dispatch(setCurrentSong(id));
      dispatch(setCurrentPlaylist("nowPlayingPlaylist"));
      dispatch(setNowPlayingPlaylist(normalizedSongs));

      await downloadVideo({
        name: song.name,
        service: song.service,
        identifier: song.id,
        title: song.title || "",
        author: song.author || song.name,
        id: song.id,
      });
    },
    [dispatch, downloadVideo, normalizedSongs, player],
  );

  return onPlay;
};

export default useOnPlay;
