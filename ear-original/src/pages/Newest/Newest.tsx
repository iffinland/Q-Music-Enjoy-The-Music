import React from 'react'
import Header from '../../components/Header'
import ListItem from '../../components/ListItem'
import likeImg from '../../assets/img/liked.png'
import PageContent from '../../components/PageContent'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { AddPlayList } from '../../components/AddPlaylist'
export const Newest = () => {
  const songListRecent = useSelector((state: RootState) => state.global.songListRecent);
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
   
    <div className="mt-12 mb-7 px-6">
      <div className="flex justify-between items-center">
        <h1 className="text-white text-2xl font-semibold">
          Newest songs
        </h1>
      </div>
      <PageContent songs={songListRecent} />
    </div>
  </div>
  
  )
}
