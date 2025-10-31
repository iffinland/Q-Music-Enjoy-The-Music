import { useContext, useEffect, useState } from "react";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import CircularProgress from '@mui/material/CircularProgress'



// import LikeButton from "./LikeButton";
import MediaItem from "./MediaItem";
import Slider from "./Slider";
import { Song } from "../types";
import usePlayer from "../hooks/usePlayer";
import LikeButton from "./LikeButton";
import { setVolumePlayer } from "../state/features/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { AddToPlaylistButton } from "./AddToPlayistButton";
import { FaUndoAlt } from "react-icons/fa";
import { MyContext } from "../wrappers/DownloadWrapper";


interface PlayerContentProps {
  song: Song;
  songUrl: string;
  percentLoaded: string
}

export const PlayerContentShow: React.FC<PlayerContentProps> = ({ 
  song, 
  songUrl,
  percentLoaded
}) => {
  const dispatch = useDispatch()
  const player = usePlayer();
  const volume = useSelector(
    (state: RootState) => state.global.volume
  )
  const currentSong = useSelector(
    (state: RootState) => state.global.currentSong
  )
  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )
  const [isPlaying, setIsPlaying] = useState(false);
  const { downloadVideo } = useContext(MyContext)

  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  const onPlayNext = () => {
   
  }

  const onPlayPrevious = () => {
    
  }


  
  const setVolume = (val: number)=> {
    dispatch(setVolumePlayer(val))
  }
 

  const refresh = () => {
    try {
      if(!currentSong) return
      const findSongInDownloads = downloads[currentSong]
      if(findSongInDownloads){
      
        downloadVideo(findSongInDownloads)
      }
    } catch (error) {
      
    }
  }



  return ( 
    <div className="grid grid-cols-2 md:grid-cols-3 h-full">
        <div className="flex w-full justify-start">
          <div className="flex items-center gap-x-4">
            <MediaItem data={song} />
            <AddToPlaylistButton song={song} />
            <LikeButton songId={song.id} name={song.name} service={song.service} songData={song} />
            <FaUndoAlt size={25} className=" ml-2 cursor-pointer" onClick={()=> {
        refresh()
       }} />
          </div>
        </div>

        <div 
          className="
            flex 
            md:hidden 
            col-auto 
            w-full 
            justify-end 
            items-center
          "
        >
          <div 
            onClick={()=> {}} 
            className="
              h-10
              w-10
              flex 
              items-center 
              justify-center 
              rounded-full 
              bg-white 
              p-1 
              cursor-pointer
            "
          >
            <Icon size={30} className="text-black" />
          </div>
        
        </div>

        <div 
          className="
            hidden
            h-full
            md:flex 
            justify-center 
            items-center 
            w-full 
            max-w-[722px] 
            gap-x-6
          "
        >
          {/* <AiFillStepBackward
            onClick={onPlayPrevious}
            size={30} 
            className="
              text-neutral-400 
              cursor-pointer 
              hover:text-white 
              transition
            "
          /> */}
         
             <CircularProgress />
    
          {percentLoaded}
          {/* <AiFillStepForward
            onClick={onPlayNext}
            size={30} 
            className="
              text-neutral-400 
              cursor-pointer 
              hover:text-white 
              transition
            " 
          /> */}
        </div>
       
        <div className="hidden md:flex w-full justify-end pr-2">
          <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon 
              onClick={()=> {}} 
              className="cursor-pointer" 
              size={34} 
            />
            <Slider 
              value={volume} 
              onChange={(value) => setVolume(value)}
            />
          </div>
        </div>

      </div>
   );
}
 
