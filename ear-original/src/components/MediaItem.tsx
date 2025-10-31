"use client";

import { useDispatch, useSelector } from "react-redux";
import useLoadImage from "../hooks/useLoadImage";
import usePlayer from "../hooks/usePlayer";
import { Song } from "../types";
import { RootState } from "../state/store";
import radioImg from '../assets/img/radio-cassette.webp'
import { useContext } from "react";
import { MyContext } from "../wrappers/DownloadWrapper";
import { setAddToDownloads, setCurrentSong } from "../state/features/globalSlice";



interface MediaItemProps {
  data: Song;
  onClick?: (id: string) => void;
}

const MediaItem: React.FC<MediaItemProps> = ({
  data,
  onClick,
}) => {
  const player = usePlayer();
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const { downloadVideo } = useContext(MyContext)
  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )

  const dispatch = useDispatch()

  const handleClick = () => {

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
  
    // return player.setId(data.id);
  };


  return ( 
    <div
      onClick={handleClick}
      className="
        flex 
        items-center 
        gap-x-3 
        cursor-pointer 
        hover:bg-neutral-800/50 
        w-full 
        p-2 
        rounded-md
      "
    >
      <div 
        className="
          relative 
          rounded-md 
          min-h-[48px] 
          min-w-[48px] 
          overflow-hidden
        "
      >
        <img
          src={imageCoverHash[data?.id] || radioImg}
          alt="MediaItem"
          className="object-cover absolute"
        />
      </div>
      <div className="flex flex-col gap-y-1 overflow-hidden">
        <p className="text-white truncate">{data?.title}</p>
        <p className="text-neutral-400 text-sm truncate">
          By {data?.author}
        </p>
      </div>
    </div>
  );
}
 
export default MediaItem;
