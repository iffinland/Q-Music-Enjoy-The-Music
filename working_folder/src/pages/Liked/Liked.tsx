import React, { useContext, useMemo, useState } from 'react'
import Header from '../../components/Header'
import SearchContent from '../../components/SearchContent'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { FaPlay } from 'react-icons/fa'
import { setCurrentPlaylist, setCurrentSong, setNowPlayingPlaylist } from '../../state/features/globalSlice'
import { MyContext } from '../../wrappers/DownloadWrapper'
import { FavPlaylists } from '../Playlists/FavPlaylists'
import Box from '../../components/Box';
import likeImg from '../../assets/img/like-button.png'
import GoBackButton from '../../components/GoBackButton';
export const Liked = () => {
  const favoriteList = useSelector((state: RootState) => state.global.favoriteList);
  const favorites = useSelector((state: RootState) => state.global.favorites);
  const { downloadVideo } = useContext(MyContext)
  const [mode, setMode] = useState<string>('songs')

  const {getLikedSongs} = useFetchSongs()
  const dispatch = useDispatch()
  const onClickPlaylist = async ()=> {
    if(!favoriteList || favoriteList?.length === 0) return

    const firstLikedSong = favoriteList[0]
    dispatch(
      setCurrentPlaylist('likedPlaylist')
    )
    dispatch(setNowPlayingPlaylist(favoriteList))
    await downloadVideo({
      name: firstLikedSong.name,
      service: 'AUDIO',
      identifier: firstLikedSong.id,
      title: firstLikedSong?.title || "",
      author: firstLikedSong?.author || "",
      id: firstLikedSong.id
    })
   
    dispatch(setCurrentSong(firstLikedSong.id))
  }

  if(!favorites) return null
  return (
 
    <Box className="overflow-hidden">
    <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent space-y-4">
    <GoBackButton />
    <div className="mt-5 mb-5 flex flex-wrap gap-3">
         <button
                  className={ `${mode === 'songs' ? 'bg-sky-900/70 border border-sky-500/40': 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'} text-sky-100 px-4 py-2 rounded transition` }
                   onClick={() => { setMode('songs') }}
                 >
                   Favorites Songs
                 </button>
                 <button
                   className={ `${mode === 'playlists' ? 'bg-sky-900/70 border border-sky-500/40': 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'} text-sky-100 px-4 py-2 rounded transition` }
                   onClick={() => { setMode('playlists') }}
                 >
                   Favorites Playlists
                 </button>
           </div>
           {mode === 'songs' && (
            <>
             <div className="mt-20">
            <div 
              className="
                flex 
                flex-col 
                md:flex-row 
                items-center 
                gap-x-5
                relative
              "
            >
           
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px'
                }}
    
                onClick={onClickPlaylist}
                >
                  {favoriteList && favoriteList?.length > 0 && (
                       <div 
                       className="
                         rounded-full 
                         flex 
                         items-center 
                         justify-center 
                         bg-green-500 
                         p-4 
                         drop-shadow-md 
                         right-5
                         group-hover:opacity-100 
                         hover:scale-110
                         cursor-pointer
                       "
                     >
                       <FaPlay className="text-black" />
                     </div>
                  )}
              
                  </div>
         
              <div className="relative h-32 w-32 lg:h-44 lg:w-44">
                <img
                  className="object-cover absolute"
           
                  src={likeImg}
                  alt="Playlist"
                />
              </div>
              <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
                <p className="hidden md:block font-semibold text-sm">
                  Songs you marked as favorites
                </p>
                <h1 
                  className="
                    text-white 
                    text-4xl 
                    sm:text-5xl 
                    lg:text-7xl 
                    font-bold
                  "
                >
                  My Favorites Songs
                </h1>
              </div>
            </div>
          </div>
            <SearchContent songs={favoriteList} />
    <LazyLoad onLoadMore={getLikedSongs}></LazyLoad>
            </>
           
           )}
          {mode === 'playlists' && (
       <FavPlaylists />
      )}
      
    </Header>
   
  </Box>
  
  )
}
