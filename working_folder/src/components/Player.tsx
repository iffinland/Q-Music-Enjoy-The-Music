

import { useCallback, useEffect, useMemo, useRef } from "react";
import PlayerContent from "./PlayerContent";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import { PlayerContentShow } from "./PlayerContentShow";
import { Song } from "../types";

interface DownloadStatus {
  status?: string;
  percentLoaded?: number;
}

type DownloadEntry = Song & {
  identifier?: string;
  url?: string;
  status?: DownloadStatus;
};

const Player = () => {
  // const player = usePlayer();
  // const { song } = useGetSongById(player.activeId);

  // const songUrl = useLoadSongUrl(song!);
  const hasRedownloaded = useRef(false)
  const currentSong = useSelector(
    (state: RootState) => state.global.currentSong
  )
  const downloads = useSelector(
    (state: RootState) => state.global.downloads as Record<string, DownloadEntry>
  )

  useEffect(()=> {
    if(currentSong){
      hasRedownloaded.current = false
    }
  }, [currentSong])

  
  const songItem = useMemo<DownloadEntry | undefined>(() => {
    if (!currentSong) return undefined;
    return downloads[currentSong];
  }, [downloads, currentSong]);

  const status = songItem?.status?.status ?? "";
  const songUrl = songItem?.status?.status === 'READY' && songItem.url ? songItem.url : null;

  interface ResourceIdentifier {
    name: string;
    service: string;
    identifier: string;
  }

  const refetch = useCallback(async ({ name, service, identifier }: ResourceIdentifier) => {
    try {
      await qortalRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier,
      });
    } catch (error) {
      console.error('Failed to refresh resource status', error);
    }
  }, []);

  useEffect(() => {
    if (
      songItem && status === 'DOWNLOADED' &&
        hasRedownloaded?.current === false
    ) {
      const identifier = songItem.identifier ?? songItem.id;
      if (!identifier) {
        return;
      }

      refetch({
        name: songItem.name,
        service: 'AUDIO',
        identifier,
      });

      hasRedownloaded.current = true;
    }
  }, [status, songItem, refetch])

  if (!songItem) return null
  if (!songUrl) {
    return <div
      className="
      fixed 
      bottom-0 
      bg-sky-950/80 
      border-t 
      border-sky-900/60 
      w-full 
      py-2 
      h-[80px] 
      px-4
    "
    >
      <PlayerContentShow song={songItem} percentLoaded={`${(songItem?.status?.percentLoaded || 0)}%`} />
    </div>
  }

  return (
    <div
      className="
        fixed 
        bottom-0 
        bg-sky-950/80 
        border-t 
        border-sky-900/60 
        w-full 
        py-2 
        h-[80px] 
      px-4
    "
    >
      <PlayerContent song={songItem} songUrl={songUrl} />
    </div>
  );
}

export default Player;
