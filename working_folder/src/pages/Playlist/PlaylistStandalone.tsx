import React, { useContext, useMemo, useRef, useState } from 'react'
import Header from '../../components/Header'
import SearchContent from '../../components/SearchContent'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayList, addToPlaylistHashMap, removeFavPlaylist, setAddToDownloads, setCurrentPlaylist, setCurrentSong, setFavPlaylist, setImageCoverHash, setIsLoadingGlobal, setNewPlayList } from '../../state/features/globalSlice'
import { AiFillEdit, AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { FaPlay } from 'react-icons/fa'
import { FiShare2, FiTrash2, FiFlag } from 'react-icons/fi';
import { MyContext } from '../../wrappers/DownloadWrapper'
import { queueFetchAvatars } from '../../wrappers/GlobalWrapper'
import localforage from 'localforage'
import likeImg from '../../assets/img/like-button.png'
import Box from '../../components/Box';
import { searchQdnResources, getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPlaylistShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import { objectToBase64 } from '../../utils/toBase64';
import { shouldHideQdnResource } from '../../utils/qdnResourceFilters';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

export const PlaylistStandalone = ({
  playlistId,
  name
}: any) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);

  const isfavoriting = useRef(false)
  const favoritesPlaylist= useSelector((state: RootState) => state.global.favoritesPlaylist);
  const dispatch = useDispatch()
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const { downloadVideo } = useContext(MyContext)
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);

  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )
  const [playListData, setPlaylistData] = useState<any>(null)

  const getPlaylistData = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !playlistId) return
      dispatch(setIsLoadingGlobal(true))

      const responseDataSearch = await searchQdnResources({
        mode: 'ALL',
        service: 'PLAYLIST',
        query: 'enjoymusic_playlist_',
        limit: 1,
        includeMetadata: true,
        reverse: true,
        excludeBlocked: true,
        name,
        exactMatchNames: true,
        offset: 0,
        identifier: playlistId,
      });

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
        const resourceEntry = responseDataSearch.find((entry: any) => !shouldHideQdnResource(entry));
        if (!resourceEntry) return;
        let resourceData = resourceEntry
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

  const getImgCover = async (id: string, name: string, retries = 0) => {
    try {
      const url = await qortalRequest({
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
  const handleDeletePlaylist = React.useCallback(async () => {
    if (!playlistId || !name) return;
    if (username !== playListData?.user) {
      toast.error('Only the owner can delete this playlist.');
      return;
    }

    const confirmed = window.confirm('Delete this playlist permanently?');
    if (!confirmed) return;

    try {
      await qortalRequest({
        action: 'DELETE_QDN_RESOURCE',
        name,
        service: 'PLAYLIST',
        identifier: playlistId,
      });
      toast.success('Playlist deleted.');
      setPlaylistData(null);
    } catch (error) {
      console.error('Failed to delete playlist', error);
      toast.error('Could not delete the playlist.');
    }
  }, [name, playlistId, playListData?.user, username]);

  const handleReportPlaylist = React.useCallback(async () => {
    if (!playlistId || !name) return;
    if (!username) {
      toast.error('Log in to report playlists.');
      return;
    }

    const reason = window.prompt('Describe the issue with this playlist (optional):', '');
    if (reason === null) return;

    try {
      const reportId = `playlist_report_${playlistId}_${Date.now()}`;
      const payload = {
        id: reportId,
        playlistId,
        playlistPublisher: name,
        reporter: username,
        reason: reason || 'Reported without comment',
        created: Date.now(),
      };
      const data64 = await objectToBase64(payload);
      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources: [
          {
            name: username,
            service: 'DOCUMENT',
            data64,
            identifier: reportId,
            filename: `${reportId}.json`,
            title: `Playlist report ${playlistId}`.slice(0, 55),
            description: (reason || 'Reported without comment').slice(0, 120),
            encoding: 'base64',
          },
        ],
      });
      toast.success('Thanks! The playlist was reported.');
    } catch (error) {
      console.error('Failed to report playlist', error);
      toast.error('Could not report the playlist.');
    }
  }, [name, playlistId, username]);
  const handleSharePlaylist = React.useCallback(async () => {
    if (!playlistId || !name) return;
    try {
      const shareLink = buildPlaylistShareUrl(name, playlistId);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareLink;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Playlist link copied!');
    } catch (error) {
      console.error('Failed to copy playlist link', error);
      toast.error('Failed to copy playlist link.');
    }
  }, [name, playlistId]);
  const onClickPlayPlaylist = async ()=> {
    if(!playListData?.songs && playListData?.songs?.length === 0) return

    const firstLikedSong = {
      ...playListData?.songs[0],
      id: playListData?.songs[0].identifier
    }
    dispatch(
      setCurrentPlaylist(playListData.id)
    )
    if(firstLikedSong?.status?.status === 'READY' || downloads[firstLikedSong.id]?.status?.status === 'READY'){
      const resolvedUrl = await getQdnResourceUrl('AUDIO', firstLikedSong.name, firstLikedSong.id);
      dispatch(setAddToDownloads({
        name: firstLikedSong.name,
        service: 'AUDIO',
        id: firstLikedSong.id,
        identifier: firstLikedSong.id,
        url: resolvedUrl ?? undefined,
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
  
        const favoritesObj: PlayList[] | null = await favoritesStorage.getItem('favoritesPlaylist') || null
  
        if(favoritesObj){
          const newFavs = favoritesObj.filter((fav)=> fav?.id !== playlistId)
          await favoritesStorage.setItem('favoritesPlaylist', newFavs)
        } 
        
      }else {
        dispatch(setFavPlaylist(playListData))
  
        const favoritesObj:  PlayList[] | null =
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
    <Box className="overflow-hidden"
      style={{
        marginBottom: '80px'
      }}
    >
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
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
                 <div
                   onClick={handleSharePlaylist}
                   className="mt-2 rounded-full flex items-center justify-center bg-sky-700 p-3 drop-shadow-md cursor-pointer hover:bg-sky-600 hover:scale-105 transition"
                   title="Share playlist"
                 >
                   <FiShare2 className="text-white" />
                 </div>
                 {username === playListData?.user && (
                   <div
                     onClick={handleDeletePlaylist}
                     className="mt-2 rounded-full flex items-center justify-center bg-red-600/80 p-3 drop-shadow-md cursor-pointer hover:bg-red-500 hover:scale-105 transition"
                     title="Delete playlist"
                   >
                     <FiTrash2 className="text-white" />
                   </div>
                 )}
                 {username && username !== playListData?.user && (
                   <div
                     onClick={handleReportPlaylist}
                     className="mt-2 rounded-full flex items-center justify-center bg-amber-600/80 p-3 drop-shadow-md cursor-pointer hover:bg-amber-500 hover:scale-105 transition"
                     title="Report playlist"
                   >
                     <FiFlag className="text-white" />
                   </div>
                 )}
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
        <SearchContent
          songs={songs}
          showInlineActions={false}
          enableInlinePlay={false}
        />
      )}
      {/* <SearchContent songs={favoriteList} />
      <LazyLoad onLoadMore={getPlaylistSongs}></LazyLoad> */}
    </Box>
  
  )
}
