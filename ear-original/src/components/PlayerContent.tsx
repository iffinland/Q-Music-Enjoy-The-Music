import useSound from "use-sound";
import { useContext, useEffect, useMemo, useState } from "react";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import CircularProgress from '@mui/material/CircularProgress'
import * as RadixSlider from '@radix-ui/react-slider';



// import LikeButton from "./LikeButton";
import MediaItem from "./MediaItem";
import Slider from "./Slider";
import { Song } from "../types";
import usePlayer from "../hooks/usePlayer";
import LikeButton from "./LikeButton";
import { useDispatch, useSelector } from "react-redux";
import { setAddToDownloads, setCurrentSong, setVolumePlayer, upsertNowPlayingPlaylist } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { AddToPlaylistButton } from "./AddToPlayistButton";
import { MyContext } from "../wrappers/DownloadWrapper";


interface PlayerContentProps {
  song: Song;
  songUrl: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ 
  song, 
  songUrl
}) => {
  const player = usePlayer();
  const volume = useSelector(
    (state: RootState) => state.global.volume
  )
 
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false)
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);

  const dispatch = useDispatch()
  const nowPlayingPlaylist = useSelector(
    (state: RootState) => state.global.nowPlayingPlaylist
  )
  const favoriteList = useSelector(
    (state: RootState) => state.global.favoriteList
  )
  const currentPlaylist = useSelector(
    (state: RootState) => state.global.currentPlaylist
  )
  const { downloadVideo } = useContext(MyContext)
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);

  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )
  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;
  const [progress, setProgress] = useState(0)
  const setVolume = (val: number)=> {
    dispatch(setVolumePlayer(val))
  }
  const songData = useMemo(()=> {
    return song
  }, [songUrl])

  const handleNowPlayingPlaylist = ()=> {
    if (nowPlayingPlaylist.length === 0) {
      return;
    }

    const currentIndex = nowPlayingPlaylist.findIndex((item) => item.id === song.id);
    const nextSong = nowPlayingPlaylist[currentIndex + 1];

    if (!nextSong) {
      dispatch(setCurrentSong(nowPlayingPlaylist[0].id))
      return
    }
    dispatch(setCurrentSong(nextSong.id))
  }

  const handleLikedPlaylist = ()=> {
    if (favoriteList.length === 0) {
      return;
    }

    const currentIndex = favoriteList.findIndex((item) => item.id === song.id);
    const nextSong = favoriteList[currentIndex + 1];
    let songToPlay = favoriteList[0]
    if (nextSong?.id) {
      songToPlay = nextSong
    }
    dispatch(setCurrentSong(songToPlay?.id))

    if(songToPlay?.status?.status === 'READY' || downloads[songToPlay.id]?.status?.status === 'READY'){
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: songToPlay.id,
        identifier: songToPlay.id,
        url:`/arbitrary/AUDIO/${songToPlay.name}/${songToPlay.id}`,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: songToPlay.id,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: songToPlay.id
      })
    }
   
  }

  const handleCustomPlaylist = (playlist: any)=> {
    console.log('handleCustomPlaylist', playlist)
    if (!playlist?.songs || playlist?.songs?.length === 0) {
      return;
    }
    const songList = playlist?.songs
    const currentIndex = songList.findIndex((item: any) => item?.identifier === song?.id);
    const nextSong = songList[currentIndex + 1];
    let songToPlay = songList[0]
    if (nextSong?.identifier) {
      songToPlay = nextSong
    }
    dispatch(setCurrentSong(songToPlay?.identifier))

    if(songToPlay?.status?.status === 'READY' || downloads[songToPlay.id]?.status?.status === 'READY'){
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: songToPlay.identifier,
        identifier: songToPlay.identifier,
        url:`/arbitrary/AUDIO/${songToPlay.name}/${songToPlay.identifier}`,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: songToPlay.identifier,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: songToPlay.identifier
      })
    }
   
  }
  
  const onPlayNext = () => {
    console.log('currentPlaylist', currentPlaylist, playlistHash)
    if(currentPlaylist === 'nowPlayingPlaylist'){
      handleNowPlayingPlaylist()
    } else if(currentPlaylist === 'likedPlaylist'){
      handleLikedPlaylist()
    } else if(playlistHash[currentPlaylist]){
      handleCustomPlaylist(playlistHash[currentPlaylist])
    }
   
  }

  
  const handleNowPlayingPlaylistPrev = ()=> {
   
    if (nowPlayingPlaylist.length === 0) {
      return;
    }

    const currentIndex = nowPlayingPlaylist.findIndex((item) => item.id === song.id);
    const previousSong = nowPlayingPlaylist[currentIndex - 1];

    if (!previousSong) {
      const lastSong = nowPlayingPlaylist[nowPlayingPlaylist.length - 1]
      dispatch(setCurrentSong(lastSong.id))
      return
    }

    dispatch(setCurrentSong(previousSong.id))
  }

  const handleLikedPlaylistPrev = ()=> {
    if (favoriteList.length === 0) {
      return;
    }

    const currentIndex = favoriteList.findIndex((item) => item.id === song.id);
    const nextSong = favoriteList[currentIndex - 1];
    let songToPlay = favoriteList[0]
    if (nextSong?.id) {
      songToPlay = nextSong
    }
    dispatch(setCurrentSong(songToPlay?.id))

    if(songToPlay?.status?.status === 'READY' || downloads[songToPlay.id]?.status?.status === 'READY'){
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: songToPlay.id,
        identifier: songToPlay.id,
        url:`/arbitrary/AUDIO/${songToPlay.name}/${songToPlay.id}`,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: songToPlay.id,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: songToPlay.id
      })
    }
   
  }

  const handleCustomPlaylistPrev = (playlist: any)=> {
    console.log('handleCustomPlaylist', playlist)
    if (!playlist?.songs || playlist?.songs?.length === 0) {
      return;
    }
    const songList = playlist?.songs
    const currentIndex = songList.findIndex((item: any) => item?.identifier === song?.id);
    const nextSong = songList[currentIndex - 1];
    let songToPlay = songList[0]
    if (nextSong?.identifier) {
      songToPlay = nextSong
    }
    dispatch(setCurrentSong(songToPlay?.identifier))

    if(songToPlay?.status?.status === 'READY' || downloads[songToPlay.id]?.status?.status === 'READY'){
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: songToPlay.identifier,
        identifier: songToPlay.identifier,
        url:`/arbitrary/AUDIO/${songToPlay.name}/${songToPlay.identifier}`,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: songToPlay.identifier,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: songToPlay.identifier
      })
    }
   
  }

  const onPlayPrevious = () => {
    if(currentPlaylist === 'nowPlayingPlaylist'){
      handleNowPlayingPlaylistPrev()
    } else if(currentPlaylist === 'likedPlaylist'){
      handleLikedPlaylistPrev()
    } else if(playlistHash[currentPlaylist]){
      handleCustomPlaylistPrev(playlistHash[currentPlaylist])
    }

  }

  const [play, { pause, sound }] = useSound(
    songUrl || '',
    { 
      volume: volume,
      onplay: () => {
        setIsLoaded(true)
        setIsPlaying(true)
      } ,
      onend: () => {
        setIsPlaying(false);
        onPlayNext();
      },
      onpause: () => setIsPlaying(false),
      format: ['mp3', 'wav', 'ogg']
    },
  );


  useEffect(() => {
    sound?.play();
    
    return () => {
      sound?.unload();
    }
  }, [sound]);


  const handlePlay = () => {
    if (!isPlaying) {
      play();
    } else {
      pause();
    }
  }

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(1);
    } else {
      setVolume(0);
    }
  }

  const handleProgressChange = (value: number) => {
  
    if (sound) {
      sound.seek(value * sound.duration());
    }
  };

  useEffect(() => {
    if (sound) {
      const interval = setInterval(() => {
        setProgress((sound.seek() as number) / (sound.duration() as number));
      }, 1000);
  
      return () => {
        clearInterval(interval);
      };
    }
  }, [sound]);

  useEffect(()=> {
    dispatch(upsertNowPlayingPlaylist([songData]))
  }, [songData])


  return ( 
    <div className="grid grid-cols-2 md:grid-cols-3 h-full">
        <div className="flex w-full justify-start">
          <div className="flex items-center gap-x-4">
            <MediaItem data={song} />
            <AddToPlaylistButton song={song} />
            <LikeButton songId={song.id} name={song.name} service={song.service} songData={song} />
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
            onClick={handlePlay} 
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
          <AiFillStepBackward
            onClick={onPlayPrevious}
            size={30} 
            className="
              text-neutral-400 
              cursor-pointer 
              hover:text-white 
              transition
            "
          />
           {!isLoaded ? (
             <CircularProgress />
          ): (
            <div className="flex flex-col items-center 
            justify-center">
            <div 
            onClick={handlePlay} 
            className="
              flex 
              items-center 
              justify-center
              h-10
              w-10 
              rounded-full 
              bg-white 
              p-1 
              cursor-pointer
            "
          >
            <Icon size={30} className="text-black" />
    

          </div>
          <Slider 
              value={progress} 
              onChange={(value) => handleProgressChange(value)}
              styles={{
                width: '250px',
    height: 'auto',
    padding: '10px 0px 5px 0px',
    cursor: 'pointer'
              }}
            />
          </div>
          )}
          
          <AiFillStepForward
            onClick={onPlayNext}
            size={30} 
            className="
              text-neutral-400 
              cursor-pointer 
              hover:text-white 
              transition
            " 
          />
        </div>

        <div className="hidden md:flex w-full justify-end pr-2">
          <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon 
              onClick={toggleMute} 
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
 
export default PlayerContent;