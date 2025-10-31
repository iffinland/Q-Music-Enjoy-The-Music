
import { useEffect, useState } from "react";


import Input from "./Input";
import { resetQueriedList, setQueriedValue } from "../state/features/globalSlice";
import { useDispatch } from "react-redux";
import { useFetchSongs } from "../hooks/fetchSongs";

const SearchInput = () => {
  const dispatch = useDispatch()
  const {getQueriedSongs} = useFetchSongs()


  const handleInputKeyDown = (event: any) => {
    if (event.key === 'Enter') {
      dispatch(resetQueriedList())
      getQueriedSongs()
    }
  }
  return ( 
    <Input 
      placeholder="What do you want to listen to?"
      onChange={(e) => dispatch(setQueriedValue(e.target.value))}
      onKeyDown={handleInputKeyDown}
    />
  );
}
 
export default SearchInput;