import React, {  useCallback, useEffect,  useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import NavBar from "../components/layout/Navbar/Navbar";
import PageLoader from "../components/common/PageLoader";
import { RootState } from "../state/store";
import { Favorites, PlayList, SongMeta, setFavoritesFromStorage, setFavoritesFromStoragePlaylists, setImageCoverHash } from "../state/features/globalSlice";
import localforage
 from "localforage";
const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

import { RequestQueue } from "../utils/queue";


interface Props {
  children: React.ReactNode;
  setTheme: (val: string) => void;
}

export const queueFetchAvatars = new RequestQueue();

const GlobalWrapper: React.FC<Props> = ({ children, setTheme }) => {

  const dispatch = useDispatch();

  const [userAvatar, setUserAvatar] = useState<string>("");
  const { user } = useSelector((state: RootState) => state.auth);
  const songListLibrary = useSelector((state: RootState) => state.global.songListLibrary);  
  const songHash = useSelector((state: RootState) => state.global.songHash);
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const songListRecent = useSelector((state: RootState) => state.global.imageCoverHash);
  useEffect(() => {
    if (!user?.name) return;

    getAvatar();
  }, [user?.name]);

 

 

  const getAvatar = async () => {
    try {
      let url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: user?.name,
        service: "THUMBNAIL",
        identifier: "qortal_avatar"
      });

      if (url === "Resource does not exist") return;

      setUserAvatar(url);
    } catch (error) {
      console.error(error);
    }
  };

  const {
    isLoadingGlobal,
  } = useSelector((state: RootState) => state.global);

  async function getNameInfo(address: string) {
    const response = await fetch("/names/address/" + address);
    const nameData = await response.json();

    if (nameData?.length > 0) {
      return nameData[0].name;
    } else {
      return "";
    }
  }




  const askForAccountInformation = React.useCallback(async () => {
    try {
      let account = await qortalRequest({
        action: "GET_USER_ACCOUNT"
      });

      const name = await getNameInfo(account.address);
      dispatch(addUser({ ...account, name }));
    } catch (error) {
      console.error(error);
    }
  }, []);


  const getFavouritesFromStorage = async()=> {
    try {
      let favorites: Favorites | null =
        await favoritesStorage.getItem('favorites') || null
        if(favorites){
          dispatch(setFavoritesFromStorage(favorites))
        } else {
          dispatch(setFavoritesFromStorage({
            
              songs: {},
              playlists: {}
            
          }))
        }
    } catch (error) {
      
    }
   
  }
  const getFavouritesFromStoragePlaylists = async()=> {
    try {
      let favorites: PlayList[] | null =
        await favoritesStorage.getItem('favoritesPlaylist') || null
        if(favorites){
          dispatch(setFavoritesFromStoragePlaylists(favorites))
        } else {
          dispatch(setFavoritesFromStoragePlaylists([]))
        }
    } catch (error) {
      
    }
   
  }



  React.useEffect(() => {
    askForAccountInformation();
    getFavouritesFromStorage()
    getFavouritesFromStoragePlaylists()
  }, []);

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      {children}
    </>
  );
};

export default GlobalWrapper;
