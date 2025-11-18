import React, { useEffect, useRef } from 'react'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayListsContent } from '../../components/PlaylistsContent'
import LibraryPlaylistActions from '../../components/library/LibraryPlaylistActions'
export const MyPlaylists = () => {
  const {    getMyPlaylists
  } = useFetchSongs()
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    getMyPlaylists();
  }, [getMyPlaylists]);


  const playlistsToRender = myPlaylists


  return (
<div>
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">
            Playlists
          </h1>
        </div>
        <PlayListsContent
          playlists={playlistsToRender}
          renderActions={(playlist) => (
            <LibraryPlaylistActions playlist={playlist} />
          )}
        />
         <LazyLoad onLoadMore={getMyPlaylists}></LazyLoad>

     
    </div>
  
  )
}
