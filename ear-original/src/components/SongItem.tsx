

import PlayButton from "./PlayButton";
import { Song } from "../types";
import useLoadImage from "../hooks/useLoadImage";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import radioImg from '../assets/img/radio-cassette.webp'
import { useContext } from "react";
import { MyContext } from "../wrappers/DownloadWrapper";
import { setAddToDownloads, setCurrentSong, setNewPlayList } from "../state/features/globalSlice";
import {MdPlaylistAdd} from 'react-icons/md'
interface SongItemProps {
  data: Song;
  onClick: (id: string) => void;
}

const SongItem: React.FC<SongItemProps> = ({
  data,
  onClick
}) => {
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const { downloadVideo } = useContext(MyContext)
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);

  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )

  const dispatch = useDispatch()

  const addSongToPlaylist = (song: Song)=> {
    if(!newPlaylist) return
    if(newPlaylist && newPlaylist?.songs?.find((item)=> song.id === item.identifier)){
      return
    }
  const playlist = {
    ...newPlaylist,
    songs: [...newPlaylist.songs, {
      identifier: song.id,
      name: song.name,
      service: 'AUDIO',
      title: song.title,
      author: song.author
    }]
  }
  dispatch(setNewPlayList(playlist))
  }
  return ( 
    <div
    onClick={() => {
      if(data?.status?.status === 'READY' || downloads[data.id]?.status?.status === 'READY'){
        dispatch(setAddToDownloads({
          name: data.name,
          service: 'AUDIO',
          id: data.id,
          identifier: data.id,
          url:`/arbitrary/AUDIO/${data.name}/${data.id}`,
          status: data?.status,
          title: data?.title || "",
          author: data?.author || "",
        }))
      }else {
        downloadVideo({
          name: data.name,
          service: 'AUDIO',
          identifier: data.id,
          title: data?.title || "",
          author: data?.author || "",
          id: data.id
        })
      }
     
      dispatch(setCurrentSong(data.id))
    }} 
    className="
      relative 
      group 
      flex 
      flex-col 
      items-center 
      justify-center 
      rounded-md 
      overflow-hidden 
      gap-x-4 
      bg-neutral-400/5 
      hover:bg-neutral-400/10 
      transition 
      p-3
    "
  >
    <div 
      className="
        relative 
        aspect-square 
        w-full
        h-full 
        rounded-md 
        overflow-hidden
      "
    >
      <img
        className="object-cover absolute"
        src={imageCoverHash[data.id] || radioImg}
        alt="Image"
      />
      {newPlaylist && (
        <button
        className="
        absolute top-3 left-3
          transition 
          opacity-0 
          rounded-full 
          flex 
          items-center 
          justify-center 
          bg-green-500 
          p-3
          drop-shadow-md 
          translate
          translate-y-1/4
          group-hover:opacity-100 
          group-hover:translate-y-0
          hover:scale-110
        "
      >
        <MdPlaylistAdd 
          className="text-black h-6 w-6" 
          onClick={(event: any) => {
            event.stopPropagation();
            addSongToPlaylist(data)
            // Handle the 'add to playlist' logic here
          }}
        />
      </button>
      )}
    
      
    </div>
    <div className="flex flex-col items-start w-full pt-4 gap-y-1">
      <p className="font-semibold truncate w-full">
        {data?.title}
      </p>
      <p 
        className="
          text-neutral-400 
          text-sm 
          pb-4 
          w-full 
          truncate
        "
      >
        By {data?.author}
      </p>
    </div>
    <div 
      className="
        absolute 
        bottom-24 
        right-5
      "
    >
      <PlayButton />
    </div>
  </div>
  
   );
}
 
export default SongItem;
