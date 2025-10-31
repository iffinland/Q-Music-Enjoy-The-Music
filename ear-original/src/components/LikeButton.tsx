"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AiOutlineHeart, AiFillHeart } from "react-icons/ai";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { Favorites, removeFavSong, setFavSong } from "../state/features/globalSlice";
import { Song } from "../types";
import localforage from 'localforage'


const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

interface LikeButtonProps {
  songId: string;
  name: string;
  service: string
  songData: Song
};

const LikeButton: React.FC<LikeButtonProps> = ({
  songId,
  name,
  service = 'AUDIO',
  songData
}) => {
  const songs = useSelector((state: RootState) => state.global?.favorites?.songs);
  const dispatch = useDispatch()
  const isfavoriting = useRef(false)
const isLiked = songs && songs[songId]
 

  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;
   
  const handleLike = async () => {
    try {
      if(isfavoriting.current) return
      isfavoriting.current = true
      const isLiked = songs && songs[songId]
      if(isLiked){
        dispatch(removeFavSong({
          identifier: songId,
          name,
          service
        }))
  
        let favoritesObj: Favorites | null =
        await favoritesStorage.getItem('favorites') || null
  
        if(favoritesObj && favoritesObj?.songs[songId]){
          delete favoritesObj.songs[songId]
          await favoritesStorage.setItem('favorites', favoritesObj)
        } 
        
      }else {
        dispatch(setFavSong({
          identifier: songId,
          name,
          service,
          songData
        }))
  
        let favoritesObj: Favorites | null =
        await favoritesStorage.getItem('favorites') || null
  
        if(!favoritesObj){
        const newObj: Favorites =   {
            songs: {
              [songId]: {
                identifier: songId,
                name,
                service,
              }
            },
            playlists: {}
          }
  
          await favoritesStorage.setItem('favorites', newObj)
        }  else {
          favoritesObj.songs[songId] = {
            identifier: songId,
            name,
            service,
          }
  
          await favoritesStorage.setItem('favorites', favoritesObj)
        }
      }
  
      isfavoriting.current = false
    } catch (error) {
      console.error(error)
    }
   
  }

  

  return (
    <button 
      className="
        cursor-pointer 
        hover:opacity-75 
        transition
      "
      onClick={handleLike}
    >
      <Icon color={isLiked ? '#22c55e' : 'white'} size={25} />
    </button>
  );
}

export default LikeButton;
