

import PlayerContent from "./PlayerContent";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import { PlayerContentShow } from "./PlayerContentShow";
import { useContext, useEffect, useMemo, useRef } from "react";
import { MyContext } from "../wrappers/DownloadWrapper";

const Player = () => {
  // const player = usePlayer();
  // const { song } = useGetSongById(player.activeId);

  // const songUrl = useLoadSongUrl(song!);
  const { downloadVideo } = useContext(MyContext)

  const hasRedownloaded = useRef(false)
  const currentSong = useSelector(
    (state: RootState) => state.global.currentSong
  )
  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )

  useEffect(()=> {
    if(currentSong){
      hasRedownloaded.current = false
    }
  }, [currentSong])

  
  const status = useMemo(()=> {
    let statusVar = ""
    let song = null
    if (currentSong && downloads[currentSong]) {
      song = downloads[currentSong]
    }
    if(song){
      statusVar = song?.status?.status || ""
    }
    return statusVar

  }, [downloads, currentSong])
  const songItem = useMemo(()=> {
    let song = null
    if (currentSong && downloads[currentSong]) {
      song = downloads[currentSong]

    }
   
    return song

  }, [downloads, currentSong])

  
  const player = {
    activeId: "1",
  }

  let song: any = null

  if (currentSong && downloads[currentSong]) {
    song = downloads[currentSong]
  }
  let songUrl = null

  if (song && song?.status?.status === 'READY' &&
    !!song.url) {
    songUrl = song.url
  }

  const refetch = async ({name, service, identifier}: any)=> {
    try {
      await qortalRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier
      })
    } catch (error) {
      
    }
   
  }

  useEffect(() => {
    if (
      songItem && status === 'DOWNLOADED' &&
        hasRedownloaded?.current === false
    ) {
     
   
        refetch({
          name: songItem.name,
          service: 'AUDIO',
          identifier: songItem.id
        })

   
      hasRedownloaded.current = true
    }
  }, [status, songItem])

  if (!song) return null
  if (!songUrl) {
    return <div
      className="
      fixed 
      bottom-0 
      bg-black 
      w-full 
      py-2 
      h-[80px] 
      px-4
    "
    >
      <PlayerContentShow song={song} songUrl={songUrl} percentLoaded={`${(song?.status?.percentLoaded || 0)}%`} />
    </div>
  }

  return (
    <div
      className="
        fixed 
        bottom-0 
        bg-black 
        w-full 
        py-2 
        h-[80px] 
        px-4
      "
    >
      <PlayerContent song={song} songUrl={songUrl} />
    </div>
  );
}

export default Player;
