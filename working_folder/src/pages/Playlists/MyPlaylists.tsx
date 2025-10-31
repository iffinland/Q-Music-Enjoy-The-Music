import React from 'react'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayListsContent } from '../../components/PlaylistsContent'
export const MyPlaylists = () => {
  const {    getMyPlaylists
  } = useFetchSongs()
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);


  const playlistsToRender = myPlaylists


  return (
<div>
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">
            Playlists
          </h1>
        </div>
        <PlayListsContent playlists={playlistsToRender} />
         <LazyLoad onLoadMore={getMyPlaylists}></LazyLoad>

     
    </div>
  
  )
}
