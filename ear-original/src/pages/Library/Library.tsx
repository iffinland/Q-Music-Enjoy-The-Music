import React, { useMemo, useState , useRef, useEffect, useCallback} from 'react'
import Header from '../../components/Header'
import ListItem from '../../components/ListItem'
import likeImg from '../../assets/img/liked.png'
import PageContent from '../../components/PageContent'
import SearchInput from '../../components/SearchInput'
import { toast } from "react-hot-toast";
import {IoMdCloudUpload} from "react-icons/io"

import SearchContent from '../../components/SearchContent'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import useUploadModal from '../../hooks/useUploadModal'
import useOnPlay from '../../hooks/useOnPlay'
import { MyPlaylists } from '../Playlists/MyPlaylists'
export const Library = () => {
  const initialFetch = useRef(false)
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const songListLibrary = useSelector((state: RootState) => state?.global.songListLibrary);
  const [mode, setMode] = useState<string>('songs')

  const {getYourLibrary} = useFetchSongs()
  const uploadModal = useUploadModal();


  const onClick = () => {
    if (!username) {
      toast.error('Please authenticate')
      return
    }

    return uploadModal.onOpen();
  }

  const fetchMyLibrary = useCallback(async()=> {
    try {
      if(!username) return
      await getYourLibrary(username)
      initialFetch.current = true
    } catch (error) {
      
    }
  }, [username, getYourLibrary])

  useEffect(()=> {
    if(username && !initialFetch.current){
      fetchMyLibrary()
    }

  }, [username])
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
    <div className="mt-5 mb-5">
         <button
                  className={ `${mode === 'songs' ? 'bg-neutral-100/10': ''} text-white px-4 py-2 rounded mr-5` }
                   onClick={() => { setMode('songs') }}
                 >
                   My Songs
                 </button>
                 <button
                   className={ `${mode === 'playlists' ? 'bg-neutral-100/10': ''} text-white px-4 py-2 rounded` }
                   onClick={() => { setMode('playlists') }}
                 >
                   My Playlists
                 </button>
           </div>
      {mode === 'playlists' && (
       <MyPlaylists />
      )}
      {mode === 'songs' && (
        <>
          <div className="mt-5">
        <div 
          className="
            flex 
            flex-col 
            md:flex-row 
            items-center 
            gap-x-5
          "
        >
          <div className="relative h-10 w-10">
            <IoMdCloudUpload style={{
              height: '35px',
              width: 'auto'
            }} />
          </div>
          <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
           
            <h1 
              className="
                text-white 
                text-lg 
                font-bold
              "
            >
              Your library
            </h1>
          </div>
        </div>
      </div>
        
        <SearchContent songs={songListLibrary} />
    <LazyLoad onLoadMore={fetchMyLibrary}></LazyLoad>
        </>
      
      )}
      
    </Header>
    
  </div>
  
  )
}
