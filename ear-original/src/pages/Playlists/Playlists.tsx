import React from 'react'
import Header from '../../components/Header'
import ListItem from '../../components/ListItem'
import likeImg from '../../assets/img/liked.png'
import PageContent from '../../components/PageContent'
import SearchInput from '../../components/SearchInput'
import SearchContent from '../../components/SearchContent'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayListsContent } from '../../components/PlaylistsContent'
import { SearchInputPlaylist } from '../../components/SearchInputPlaylist'
export const Playlists = () => {
  const {    getPlaylists
  } = useFetchSongs()
  const songListQueried = useSelector((state: RootState) => state.global.songListQueried);
  const playlists = useSelector((state: RootState) => state.global.playlists);
  const playlistQueried = useSelector((state: RootState) => state.global.playlistQueried);
  const isQueryingPlaylist = useSelector((state: RootState) => state.global.isQueryingPlaylist);

  console.log({playlists})

  let playlistsToRender = playlists

  if(isQueryingPlaylist){
    playlistsToRender = playlistQueried
  }
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
      <Header className="from-bg-neutral-900">
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
     
    </div>
  
  )
}
