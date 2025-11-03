import React, { useContext, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import SearchContent from '../../components/SearchContent';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlayList,
  addToPlaylistHashMap,
  removeFavPlaylist,
  setAddToDownloads,
  setCurrentPlaylist,
  setCurrentSong,
  setFavPlaylist,
  setImageCoverHash,
  setIsLoadingGlobal,
  setNewPlayList,
  removePlaylistById,
} from '../../state/features/globalSlice';
import { FiShare2, FiTrash2, FiFlag, FiPlay, FiEdit2 } from 'react-icons/fi';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { queueFetchAvatars } from '../../wrappers/GlobalWrapper';
import localforage from 'localforage';
import likeImg from '../../assets/img/like-button.png';
import Box from '../../components/Box';
import { searchQdnResources, getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPlaylistShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import { objectToBase64 } from '../../utils/toBase64';
import { shouldHideQdnResource } from '../../utils/qdnResourceFilters';
import HomeActionButton from '../../components/home/HomeActionButton';
import useUploadPlaylistModal from '../../hooks/useUploadPlaylistModal';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

export const Playlist = () => {
  const navigate = useNavigate();
  const uploadPlaylistModal = useUploadPlaylistModal();
  const username = useSelector((state: RootState) => state.auth?.user?.name);

  const { playlistId, name } = useParams()
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
 
  const songs = useMemo(()=> {
   
    const transformSongs = (playListData?.songs || []).map((song: any)=> {
      if (!imageCoverHash[song?.identifier]) {
        queueFetchAvatars.push(() => getImgCover(song?.identifier, song?.name), `${song?.name}:${song?.identifier}`)
      }
      return {
        ...song,
        id: song?.identifier || song?.id
      }
    })
    return transformSongs
  }, [playListData?.songs, imageCoverHash])

  const onClickPlaylist = () => {
    if (!username) {
      toast.error('Log in to continue');
      return;
    }
    if (!playListData) {
      toast.error('Playlist data missing.');
      return;
    }
    dispatch(setNewPlayList(playListData));
    uploadPlaylistModal.onOpen();
  };
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
      dispatch(removePlaylistById(playlistId));
      if (favoritesStorage) {
        const favoritesObj: PlayList[] | null = await favoritesStorage.getItem('favoritesPlaylist') || null;
        if (favoritesObj) {
          const updatedFavorites = favoritesObj.filter((fav) => fav.id !== playlistId);
          await favoritesStorage.setItem('favoritesPlaylist', updatedFavorites);
        }
      }
      toast.success('Playlist deleted.');
      navigate('/playlists');
    } catch (error) {
      console.error('Failed to delete playlist', error);
      toast.error('Could not delete the playlist.');
    }
  }, [dispatch, name, navigate, playlistId, playListData?.user, username]);

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
            description: (reason || 'Reported without comment').slice(0, 4000),
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

  const hasSongs = Boolean(playListData?.songs && playListData.songs.length > 0);
  const isOwner = username && username === playListData?.user;
  const LikeIcon = isLiked ? AiFillHeart : AiOutlineHeart;

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <HomeActionButton
        onClick={onClickPlayPlaylist}
        title="Esita"
        aria-label="Play playlist"
        disabled={!hasSongs}
      >
        <FiPlay size={16} />
      </HomeActionButton>
      <HomeActionButton
        onClick={handleSharePlaylist}
        title="Jaga"
        aria-label="Share playlist"
      >
        <FiShare2 size={16} />
      </HomeActionButton>
      <HomeActionButton
        onClick={handleLike}
        title={isLiked ? 'Eemalda meeldimine' : 'Meeldib'}
        aria-label="Toggle like"
        active={isLiked}
        className={isLiked ? 'text-emerald-300 hover:text-white' : undefined}
      >
        <LikeIcon size={18} />
      </HomeActionButton>
      {isOwner ? (
        <HomeActionButton
          onClick={handleDeletePlaylist}
          title="Kustuta"
          aria-label="Delete playlist"
          className="text-red-200/80 hover:text-white hover:bg-red-600/70"
        >
          <FiTrash2 size={16} />
        </HomeActionButton>
      ) : (
        username && (
          <HomeActionButton
            onClick={handleReportPlaylist}
            title="Raporteeri"
            aria-label="Report playlist"
            className="text-amber-200/80 hover:text-white hover:bg-amber-600/70"
          >
            <FiFlag size={16} />
          </HomeActionButton>
        )
      )}
    </div>
  );

  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <div className="mt-12 flex flex-col gap-6 lg:flex-row">
          <div className="flex-shrink-0">
            <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-sky-900/60 bg-sky-950/60 lg:h-44 lg:w-44">
              <img
                className="absolute inset-0 h-full w-full object-cover"
                src={playListData?.image ? playListData?.image : likeImg}
                alt="Playlist"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                  {playListData?.title || 'Untitled playlist'}
                </h1>
                {isOwner && (
                  <HomeActionButton
                    onClick={onClickPlaylist}
                    title="Muuda"
                    aria-label="Edit playlist"
                    compact={false}
                  >
                    <FiEdit2 size={18} />
                  </HomeActionButton>
                )}
              </div>
              {playListData?.description && (
                <p className="text-sm text-sky-200/80 md:text-base">{playListData.description}</p>
              )}
            </div>
            {actionButtons}
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
    </Box>
  );
};
