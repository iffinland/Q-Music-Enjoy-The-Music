import React, { useCallback, useEffect } from 'react'
import Header from '../../components/Header'
import ListItem from '../../components/ListItem'
import likeImg from '../../assets/img/liked.png'
import PageContent from '../../components/PageContent'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { AddPlayList } from '../../components/AddPlaylist'
import { PlaylistStandalone } from '../Playlist/PlaylistStandalone'
import { PlayList } from '../../state/features/globalSlice'
import { useFetchSongs } from '../../hooks/fetchSongs'
export const Home = () => {
  const randomPlaylist = useSelector((state: RootState) => state.global.randomPlaylist);
  const {getRandomPlaylist} = useFetchSongs()
  
  useEffect(()=> {
    getRandomPlaylist()
  }, [getRandomPlaylist])
  return (
    <div
    className="
      bg-neutral-900 
      rounded-lg 
      h-full 
      w-full 
      overflow-hidden 
      overflow-y-auto
    "
  
  >
    <Header>
      <div className="mb-2">
        <div className='flex justify-between'>
        <h1 
          className="
          text-white 
            text-3xl 
            font-semibold
          ">
            Welcome back
        </h1>
        </div>
       
        <div 
          className="
            grid 
            grid-cols-1 
            sm:grid-cols-2 
            xl:grid-cols-3 
            2xl:grid-cols-4 
            gap-3 
            mt-4
          "
        >
          <ListItem 
            name="Liked Songs" 
            image={likeImg}
            href="liked" 
          />
        </div>
      </div>
    </Header>
    <div className="mt-2 mb-7 px-6">
      <div className="flex justify-between items-center">
        <h1 className="text-white text-2xl font-semibold">
          Discover a Playlist (Shuffle)
        </h1>
      </div>
      {randomPlaylist && (
        <PlaylistStandalone playlistId={randomPlaylist?.id}
        name={randomPlaylist?.user} />
      )}
      {/* <PageContent songs={songListRecent} /> */}
    </div>
  </div>
  
  )
}
