import React from 'react'
import Header from '../../components/Header'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayListsContent } from '../../components/PlaylistsContent'
import { SearchInputPlaylist } from '../../components/SearchInputPlaylist'
import Box from '../../components/Box';

export const Playlists = () => {
  const { getPlaylists } = useFetchSongs()
  const playlists = useSelector((state: RootState) => state.global.playlists);
  const playlistQueried = useSelector((state: RootState) => state.global.playlistQueried);
  const isQueryingPlaylist = useSelector((state: RootState) => state.global.isQueryingPlaylist);

  let playlistsToRender = playlists

  if(isQueryingPlaylist){
    playlistsToRender = playlistQueried
  }
  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">
            Playlists
          </h1>
          <SearchInputPlaylist />
        </div>
      </Header>
      <PlayListsContent playlists={playlistsToRender} />
      {!isQueryingPlaylist && (
         <LazyLoad onLoadMore={getPlaylists}></LazyLoad>
      )}
     
    </Box>
  
  )
}
