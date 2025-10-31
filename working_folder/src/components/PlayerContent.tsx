import useSound from "use-sound";
import { useContext, useEffect, useState } from "react";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import CircularProgress from '@mui/material/CircularProgress'



// import LikeButton from "./LikeButton";
import MediaItem from "./MediaItem";
import Slider from "./Slider";
import { Song } from "../types";
import LikeButton from "./LikeButton";
import { useDispatch, useSelector } from "react-redux";
import { setAddToDownloads, setCurrentSong, setVolumePlayer, upsertNowPlayingPlaylist, PlayList, SongReference, Status } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { AddToPlaylistButton } from "./AddToPlayistButton";
import { MyContext } from "../wrappers/DownloadWrapper";
import { getQdnResourceUrl } from "../utils/qortalApi";

type PlaylistSong = SongReference & { status?: Status; id?: string; url?: string };
type DownloadEntry = Song & { status?: Status; identifier?: string; url?: string };


interface PlayerContentProps {
  song: Song;
  songUrl: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ 
  song, 
  songUrl
}) => {
  const volume = useSelector(
    (state: RootState) => state.global.volume
  )
 
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false)
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash as Record<string, PlayList>);

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

  const downloads = useSelector(
    (state: RootState) => state.global.downloads as Record<string, DownloadEntry>
  )
  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;
  const [progress, setProgress] = useState(0)
  const setVolume = (val: number)=> {
    dispatch(setVolumePlayer(val))
  }

  const resolveIdentifier = (entry?: { id?: string; identifier?: string }): string | undefined =>
    entry?.id ?? entry?.identifier;

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

  const handleLikedPlaylist = async ()=> {
    if (favoriteList.length === 0) {
      return;
    }

    const currentIndex = favoriteList.findIndex((item) => item.id === song.id);
    const nextSong = favoriteList[currentIndex + 1];
    let songToPlay = favoriteList[0];
    if (nextSong?.id) {
      songToPlay = nextSong;
    }

    const downloadKey = resolveIdentifier(songToPlay);
    if (!downloadKey) {
      return;
    }

    dispatch(setCurrentSong(downloadKey));
    if (songToPlay?.status?.status === 'READY' || downloads[downloadKey]?.status?.status === 'READY') {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', songToPlay.name, downloadKey);
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: downloadKey,
        identifier: downloadKey,
        url: resolvedUrl ?? undefined,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: downloadKey,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: downloadKey
      })
    }
   
  }

  const handleCustomPlaylist = async (playlist: PlayList)=> {
    const songs = (playlist?.songs as PlaylistSong[]) || [];
    if (songs.length === 0) {
      return;
    }
    const currentIndex = songs.findIndex((item) => item?.identifier === song?.id);
    const nextSong = songs[currentIndex + 1];
    let songToPlay = songs[0];
    if (nextSong?.identifier) {
      songToPlay = nextSong;
    }
    const downloadKey = resolveIdentifier(songToPlay);
    if (!downloadKey) {
      return;
    }

    dispatch(setCurrentSong(downloadKey));
    if (songToPlay?.status?.status === 'READY' || downloads[downloadKey]?.status?.status === 'READY') {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', songToPlay.name, downloadKey);
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: downloadKey,
        identifier: downloadKey,
        url: resolvedUrl ?? undefined,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: downloadKey,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: downloadKey
      })
    }
   
  }
  
  const onPlayNext = () => {
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

  const handleLikedPlaylistPrev = async ()=> {
    if (favoriteList.length === 0) {
      return;
    }

    const currentIndex = favoriteList.findIndex((item) => item.id === song.id);
    const previousSong = favoriteList[currentIndex - 1];
    let songToPlay = favoriteList[0];
    if (previousSong?.id) {
      songToPlay = previousSong;
    }

    const downloadKey = resolveIdentifier(songToPlay);
    if (!downloadKey) {
      return;
    }

    dispatch(setCurrentSong(downloadKey));

    if(songToPlay?.status?.status === 'READY' || downloads[downloadKey]?.status?.status === 'READY'){
      const resolvedUrl = await getQdnResourceUrl('AUDIO', songToPlay.name, downloadKey);
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: downloadKey,
        identifier: downloadKey,
        url: resolvedUrl ?? undefined,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: downloadKey,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: downloadKey
      })
    }
   
  }

  const handleCustomPlaylistPrev = async (playlist: PlayList)=> {
    const songs = (playlist?.songs as PlaylistSong[]) || [];
    if (songs.length === 0) {
      return;
    }
    const currentIndex = songs.findIndex((item) => item?.identifier === song?.id);
    const previousSong = songs[currentIndex - 1];
    let songToPlay = songs[0];
    if (previousSong?.identifier) {
      songToPlay = previousSong;
    }
    const downloadKey = resolveIdentifier(songToPlay);
    if (!downloadKey) {
      return;
    }

    dispatch(setCurrentSong(downloadKey));
    if (songToPlay?.status?.status === 'READY' || downloads[downloadKey]?.status?.status === 'READY') {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', songToPlay.name, downloadKey);
      dispatch(setAddToDownloads({
        name: songToPlay.name,
        service: 'AUDIO',
        id: downloadKey,
        identifier: downloadKey,
        url: resolvedUrl ?? undefined,
        status: songToPlay?.status,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
      }))
    }else {
      downloadVideo({
        name: songToPlay.name,
        service: 'AUDIO',
        identifier: downloadKey,
        title: songToPlay?.title || "",
        author: songToPlay?.author || "",
        id: downloadKey
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
    dispatch(upsertNowPlayingPlaylist([song]))
  }, [dispatch, song])


  return ( 
    <div className="grid grid-cols-2 md:grid-cols-3 h-full">
        <div className="flex w-full justify-start">
          <div className="flex items-center gap-x-4">
            <MediaItem data={song} />
            <AddToPlaylistButton song={song} />
            <LikeButton songId={song.id} name={song.name} service={song.service ?? ''} songData={song} />
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
