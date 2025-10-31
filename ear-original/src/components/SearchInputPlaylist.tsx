
import { useEffect, useState } from "react";


import Input from "./Input";
import { resetQueriedList, resetQueriedListPlaylist, setIsQueryingPlaylist, setQueriedValue, setQueriedValuePlaylist } from "../state/features/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { useFetchSongs } from "../hooks/fetchSongs";
import { RootState } from "../state/store";
import { FaUndoAlt } from "react-icons/fa";

export const SearchInputPlaylist = () => {
  const dispatch = useDispatch()
  const {getPlaylistsQueried} = useFetchSongs()
  const queriedValuePlaylist = useSelector((state: RootState) => state.global.queriedValuePlaylist);
  const isQueryingPlaylist = useSelector((state: RootState) => state.global.isQueryingPlaylist);

  const handleInputKeyDown = (event: any) => {
    if (event.key === 'Enter') {
      dispatch(resetQueriedListPlaylist())
      if(!queriedValuePlaylist){
        dispatch(setIsQueryingPlaylist(false))
      } else {
        dispatch(setIsQueryingPlaylist(true))
        getPlaylistsQueried()
      }
      
    }
  }
  return (
    <div className="flex items-center">
      <Input 
      placeholder="What do you want to listen to?"
      onChange={(e) => {
        dispatch(setQueriedValuePlaylist(e.target.value))
      }}
      value={queriedValuePlaylist}
      onKeyDown={handleInputKeyDown}
    />
    {isQueryingPlaylist && (
       <FaUndoAlt className=" ml-2 cursor-pointer" onClick={()=> {
        dispatch(resetQueriedListPlaylist())
        dispatch(setIsQueryingPlaylist(false))
        dispatch(setQueriedValuePlaylist(''))
       }} />
    )}
   
    </div>
    
  );
}
