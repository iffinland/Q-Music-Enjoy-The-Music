import React, { useContext, useMemo, useRef, useState } from 'react'
import Header from '../../components/Header'
import ListItem from '../../components/ListItem'
import likeImg from '../../assets/img/liked.png'
import PageContent from '../../components/PageContent'
import SearchInput from '../../components/SearchInput'
import SearchContent from '../../components/SearchContent'
import LazyLoad from '../../components/common/LazyLoad'
import { useFetchSongs } from '../../hooks/fetchSongs'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayListsContent } from '../../components/PlaylistsContent'
import { useParams } from 'react-router-dom'
import { PlayList, addToPlaylistHashMap, removeFavPlaylist, setAddToDownloads, setCurrentPlaylist, setCurrentSong, setFavPlaylist, setImageCoverHash, setIsLoadingGlobal, setNewPlayList } from '../../state/features/globalSlice'
import { AiFillEdit, AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { FaPlay } from 'react-icons/fa'
import { MyContext } from '../../wrappers/DownloadWrapper'
import { queueFetchAvatars } from '../../wrappers/GlobalWrapper'
import localforage from 'localforage'

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

export const PlaylistStandalone = ({
  playlistId,
  name
}: any) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);

  const isfavoriting = useRef(false)
  const {    getPlaylists
  } = useFetchSongs()
  const songListQueried = useSelector((state: RootState) => state.global.songListQueried);
  const playlists = useSelector((state: RootState) => state.global.playlists);
  const favoritesPlaylist= useSelector((state: RootState) => state.global.favoritesPlaylist);
  const dispatch = useDispatch()
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const { downloadVideo } = useContext(MyContext)
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);

  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )
  const [playListData, setPlaylistData] = useState<any>(null)
  console.log({playlists, playlistId})

  const getPlaylistData = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !playlistId) return
      dispatch(setIsLoadingGlobal(true))

      const url = `/arbitrary/resources/search?mode=ALL&service=PLAYLIST&query=earbump_playlist_&limit=1&includemetadata=true&reverse=true&excludeblocked=true&name=${name}&exactmatchnames=true&offset=0&identifier=${playlistId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseDataSearch = await response.json()

      // const responseDataSearch = await qortalRequest({
      //   action: "SEARCH_QDN_RESOURCES",
      //   mode: "ALL",
      //   service: "DOCUMENT",
      //   query: "bteon_vid_",
      //   limit: 1,
      //   offset: 0,
      //   includeMetadata: true,
      //   reverse: true,
      //   excludeBlocked: true,
      //   exactMatchNames: true,
      //   name: name,
      //   identifier: id
      // })
      if (responseDataSearch?.length > 0) {
        let resourceData = responseDataSearch[0]
        resourceData = {
          title: resourceData?.metadata?.title,
          category: resourceData?.metadata?.category,
          categoryName: resourceData?.metadata?.categoryName,
          tags: resourceData?.metadata?.tags || [],
          description: resourceData?.metadata?.description,
          created: resourceData?.created,
          updated: resourceData?.updated,
          user: resourceData.name,
          videoImage: '',
          id: resourceData.identifier
        }
      
        const responseData = await qortalRequest({
          action: 'FETCH_QDN_RESOURCE',
          name: name,
          service: 'PLAYLIST',
          identifier: playlistId
        })
   
        if (responseData && !responseData.error) {
          const combinedData = {
            ...resourceData,
            ...responseData
          }
       
          setPlaylistData(combinedData)
          dispatch(addToPlaylistHashMap(combinedData))
        }
      }

    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [])
  

  React.useEffect(() => {
    if (name && playlistId) {
      const existingVideo = playlistHash[playlistId]

      if (existingVideo) {
        setPlaylistData(existingVideo)
      } else {
        getPlaylistData(name, playlistId)
      }


    }

  }, [playlistId, name, playlistHash])

  const getImgCover = async (id: string, name: string, retries: number = 0) => {
    try {
      let url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: name,
        service: "THUMBNAIL",
        identifier: id
      });

      if (url === "Resource does not exist") return;

      dispatch(setImageCoverHash({ url, id }));
    } catch (error) {


    }
  }

  const isLiked = useMemo(()=> {

    let isLiked = false
    if(!playlistId || !favoritesPlaylist) {
      isLiked = false
      return isLiked
    }
    if(favoritesPlaylist?.find(play=> play.id === playlistId)) return true

    return isLiked
   
  }, [playlistId , favoritesPlaylist])
 
  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;
 

  console.log({playListData})

  const songs = useMemo(()=> {
   
    const transformSongs = (playListData?.songs || []).map((song: any)=> {
      if (!imageCoverHash[song?.identifier]) {
        queueFetchAvatars.push(() => getImgCover(song?.identifier, song?.name))
      }
      return {
        ...song,
        id: song?.identifier || song?.id
      }
    })
    return transformSongs
  }, [playListData?.songs, imageCoverHash])

  const onClickPlaylist = ()=> {
 
      dispatch(setNewPlayList(playListData))
    
   

   
  }
  const onClickPlayPlaylist = ()=> {
    if(!playListData?.songs && playListData?.songs?.length === 0) return

    const firstLikedSong = {
      ...playListData?.songs[0],
      id: playListData?.songs[0].identifier
    }
    dispatch(
      setCurrentPlaylist(playListData.id)
    )
    if(firstLikedSong?.status?.status === 'READY' || downloads[firstLikedSong.id]?.status?.status === 'READY'){
      dispatch(setAddToDownloads({
        name: firstLikedSong.name,
        service: 'AUDIO',
        id: firstLikedSong.id,
        identifier: firstLikedSong.id,
        url:`/arbitrary/AUDIO/${firstLikedSong.name}/${firstLikedSong.id}`,
        status: firstLikedSong?.status,
        title: firstLikedSong?.title || "",
        author: firstLikedSong?.author || "",
      }))
    }else {
      downloadVideo({
        name: firstLikedSong.name,
        service: 'AUDIO',
        identifier: firstLikedSong.id,
        title: firstLikedSong?.title || "",
        author: firstLikedSong?.author || "",
        id: firstLikedSong.id
      })
    }
   
    dispatch(setCurrentSong(firstLikedSong.id))
  }

  const handleLike = async () => {
    try {
      if(isfavoriting.current) return
      isfavoriting.current = true
      const isLiked =  !!favoritesPlaylist?.find(play=> play.id === playlistId)
      if(isLiked){
        dispatch(removeFavPlaylist(playListData))
  
        let favoritesObj: PlayList[] | null = await favoritesStorage.getItem('favoritesPlaylist') || null
  
        if(favoritesObj){
          const newFavs = favoritesObj.filter((fav)=> fav?.id !== playlistId)
          await favoritesStorage.setItem('favoritesPlaylist', newFavs)
        } 
        
      }else {
        dispatch(setFavPlaylist(playListData))
  
        let favoritesObj:  PlayList[] | null =
        await favoritesStorage.getItem('favoritesPlaylist') || null
  
        if(!favoritesObj){
        const newObj: PlayList[] =   [playListData]
  
          await favoritesStorage.setItem('favoritesPlaylist', newObj)
        }  else {
          const newObj: PlayList[] =   [playListData, ...favoritesObj]
  
          await favoritesStorage.setItem('favoritesPlaylist', favoritesObj)
        }
      }
  
      isfavoriting.current = false
    } catch (error) {
      console.error(error)
    }
   
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
      style={{
        marginBottom: '80px'
      }}
    >
      <Header>
      <div className="mt-20">
        <div 
          className="
            flex 
            flex-col 
            md:flex-row 
            items-center 
            gap-x-5
            relative
          "
        >
           <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '0px'
            }}

            
            >
          {playListData?.songs && playListData?.songs?.length > 0 && (
            <div className='flex items-center gap-2'>
                   <div 
                   onClick={onClickPlayPlaylist}
                   className="
                     rounded-full 
                     flex 
                     items-center 
                     justify-center 
                     bg-green-500 
                     p-4 
                     drop-shadow-md 
                     right-5
                     group-hover:opacity-100 
                     hover:scale-110
                     cursor-pointer
                   "
                 >
                   <FaPlay className="text-black" />
                 </div>
                 <button 
      className="
        cursor-pointer 
        hover:opacity-75 
        transition
      "
      onClick={handleLike}
    >
      <Icon color={isLiked ? '#22c55e' : 'white'} size={40} />
    </button>
                 </div>
              )}
              </div>
          {username === playListData?.user && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px'
            }}

            onClick={onClickPlaylist}
            >

              <AiFillEdit className='cursor-pointer 
              hover:opacity-75 
              transition'
              size={30}
              />
              </div>
          )}
          <div className="relative h-32 w-32 lg:h-44 lg:w-44">
            <img
              className="object-cover absolute"
       
              src={playListData?.image ?  playListData?.image : likeImg}
              alt="Playlist"
            />
          </div>
          <div className="flex flex-col gap-y-2 mt-4 md:mt-0">
            <p className="hidden md:block font-semibold text-sm">
              Playlist
            </p>
            <h1 
              className="
                text-white 
                text-4xl 
                sm:text-5xl 
                lg:text-7xl 
                font-bold
              "
            >
              {playListData?.title}
            </h1>
            <p className="hidden md:block font-semibold text-sm">
            {playListData?.description}
            </p>
          </div>
        </div>
      </div>
    </Header>
      {playListData && (
        <SearchContent songs={songs} />
      )}
      {/* <SearchContent songs={favoriteList} />
      <LazyLoad onLoadMore={getPlaylistSongs}></LazyLoad> */}
    </div>
  
  )
}
