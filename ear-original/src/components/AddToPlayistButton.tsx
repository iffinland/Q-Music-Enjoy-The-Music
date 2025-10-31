"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AiOutlineHeart, AiFillHeart } from "react-icons/ai";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { Favorites, removeFavSong, setFavSong, setNewPlayList } from "../state/features/globalSlice";
import { Song } from "../types";
import {MdPlaylistAdd} from 'react-icons/md'




interface LikeButtonProps {

  song: Song
};

export const AddToPlaylistButton: React.FC<LikeButtonProps> = ({
  song
}) => {
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);


  const dispatch = useDispatch()

  const addSongToPlaylist = ()=> {
    if(!newPlaylist) return
    if(newPlaylist && newPlaylist?.songs?.find((item)=> song.id === item.identifier)){
      return
    }
  const playlist = {
    ...newPlaylist,
    songs: [...newPlaylist.songs, {
      identifier: song.id,
      name: song.name,
      service: 'AUDIO',
      title: song.title,
      author: song.author
    }]
  }
  dispatch(setNewPlayList(playlist))
  }

  if(!newPlaylist) return null

  return (
    <button 
      className="
        cursor-pointer 
        hover:opacity-75 
        transition
      "
      onClick={addSongToPlaylist}
    >
      <MdPlaylistAdd color={ 'white'} size={25} />
    </button>
  );
}


