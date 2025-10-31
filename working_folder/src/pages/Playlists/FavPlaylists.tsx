import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayListsContent } from '../../components/PlaylistsContent'

export const FavPlaylists = () => {
  const favoritesPlaylist = useSelector((state: RootState) => state.global.favoritesPlaylist);



  const playlistsToRender = favoritesPlaylist || []


  return (
<div>
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">
            Playlists
          </h1>
        </div>
        <PlayListsContent playlists={playlistsToRender} />
       

     
    </div>
  
  )
}
