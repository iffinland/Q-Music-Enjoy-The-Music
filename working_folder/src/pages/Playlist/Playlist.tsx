import React, { useContext, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import SearchContent from '../../components/SearchContent';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlayList,
  SongReference,
  Status,
  addToPlaylistHashMap,
  removeFavPlaylist,
  setAddToDownloads,
  setCurrentPlaylist,
  setCurrentSong,
  setFavPlaylist,
  setIsLoadingGlobal,
  setNewPlayList,
  removePlaylistById,
  upsertMyPlaylists,
  setNowPlayingPlaylist,
} from '../../state/features/globalSlice';
import { FiShare2, FiTrash2, FiFlag, FiPlay, FiEdit2, FiList, FiChevronUp, FiChevronDown, FiCheck, FiX } from 'react-icons/fi';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { MyContext } from '../../wrappers/DownloadWrapper';
import localforage from 'localforage';
import likeImg from '../../assets/img/like-button.png';
import Box from '../../components/Box';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPlaylistShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import { cachedSearchQdnResources } from '../../services/resourceCache';
import { objectToBase64 } from '../../utils/toBase64';
import { shouldHideQdnResource } from '../../utils/qdnResourceFilters';
import HomeActionButton from '../../components/home/HomeActionButton';
import { mapPlaylistSongsToSongs, usePlaylistPlayback } from '../../hooks/usePlaylistPlayback';
import useUploadPlaylistModal from '../../hooks/useUploadPlaylistModal';
import MediaItem from '../../components/MediaItem';
import { Song } from '../../types';
import GoBackButton from '../../components/GoBackButton';

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
  const { ensurePlaylistSongs } = usePlaylistPlayback();

  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )
  const [playListData, setPlaylistData] = useState<any>(null)
  const [isReordering, setIsReordering] = useState(false);
  const [reorderedSongs, setReorderedSongs] = useState<SongReference[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const getPlaylistData = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !playlistId) return
      dispatch(setIsLoadingGlobal(true))

      const responseDataSearch = await cachedSearchQdnResources({
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

  const isLiked = useMemo(()=> {

    let isLiked = false
    if(!playlistId || !favoritesPlaylist) {
      isLiked = false
      return isLiked
    }
    if(favoritesPlaylist?.find(play=> play.id === playlistId)) return true

    return isLiked
   
  }, [playlistId , favoritesPlaylist])
 
  const songs = useMemo(() => {
    return (playListData?.songs || []).map((song: any) => ({
      ...song,
      id: song?.identifier || song?.id,
    }));
  }, [playListData?.songs]);

  React.useEffect(() => {
    if (!playListData?.songs) {
      setReorderedSongs([]);
      return;
    }
    setReorderedSongs(playListData.songs.map((song: SongReference) => ({ ...song })));
  }, [playListData?.songs]);

  const hasSongs = Boolean(playListData?.songs && playListData.songs.length > 0);
  const isOwner = Boolean(username && username === playListData?.user);

  const hasOrderChanged = React.useMemo(() => {
    if (!playListData?.songs || playListData.songs.length !== reorderedSongs.length) {
      return false;
    }

    return playListData.songs.some(
      (song: SongReference, index: number) =>
        song.identifier !== reorderedSongs[index]?.identifier,
    );
  }, [playListData?.songs, reorderedSongs]);

  const moveSong = React.useCallback((index: number, direction: 'up' | 'down') => {
    setReorderedSongs((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const cancelReorder = React.useCallback(() => {
    setIsReordering(false);
    setReorderedSongs(playListData?.songs ? playListData.songs.map((song: SongReference) => ({ ...song })) : []);
  }, [playListData?.songs]);

  const handleSaveOrder = React.useCallback(async () => {
    if (!isOwner) {
      toast.error('Ainult playlisti omanik saab järjekorda muuta.');
      return;
    }
    if (!playListData || !playListData?.id) return;
    if (!hasOrderChanged) {
      setIsReordering(false);
      return;
    }
    try {
      setIsSavingOrder(true);
      const playlistPayload = {
        songs: reorderedSongs,
        title: playListData.title,
        description: playListData.description,
        image: playListData.image ?? null,
      };
      const playlistData64 = await objectToBase64(playlistPayload);
      await qortalRequest({
        action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
        resources: [
          {
            name: playListData.user || username,
            service: 'PLAYLIST',
            data64: playlistData64,
            title: (playListData.title || '').slice(0, 55),
            description: (playListData.description || '').slice(0, 4000),
            identifier: playListData.id,
          },
        ],
      });

      const updatedPlaylist = {
        ...playListData,
        songs: reorderedSongs.map((song) => ({ ...song })),
      };
      setPlaylistData(updatedPlaylist);
      dispatch(addToPlaylistHashMap(updatedPlaylist));
      dispatch(upsertMyPlaylists([updatedPlaylist]));
      dispatch(setNewPlayList(updatedPlaylist));
      toast.success('Playlisti järjekord on uuendatud.');
      setIsReordering(false);
    } catch (error) {
      toast.error('Playlisti järjekorra uuendamine ebaõnnestus.');
    } finally {
      setIsSavingOrder(false);
    }
  }, [dispatch, hasOrderChanged, isOwner, playListData, reorderedSongs, username]);

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
  const onClickPlayPlaylist = async () => {
    if (!playListData) return;
    const ready = await ensurePlaylistSongs(playListData);
    if (!ready || !ready.songs || ready.songs.length === 0) {
      toast.error('Playlist is empty.');
      return;
    }

    const firstEntry = ready.songs[0] as SongReference & { status?: Status };
    const firstSong = {
      ...firstEntry,
      id: firstEntry.identifier,
    };

    if (!firstSong?.id || !firstSong?.name) {
      toast.error('Playlist song information missing.');
      return;
    }

    dispatch(setCurrentPlaylist(ready.id));
    dispatch(setNowPlayingPlaylist(mapPlaylistSongsToSongs(ready.songs)));

    if (
      firstSong?.status?.status === 'READY' ||
      downloads[firstSong.id]?.status?.status === 'READY'
    ) {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', firstSong.name, firstSong.id);
      dispatch(
        setAddToDownloads({
          name: firstSong.name,
          service: 'AUDIO',
          id: firstSong.id,
          identifier: firstSong.id,
          url: resolvedUrl ?? undefined,
          status: firstSong?.status,
          title: firstSong?.title || '',
          author: firstSong?.author || '',
        }),
      );
    } else {
      downloadVideo({
        name: firstSong.name,
        service: 'AUDIO',
        identifier: firstSong.id,
        title: firstSong?.title || '',
        author: firstSong?.author || '',
        id: firstSong.id,
      });
    }

    dispatch(setCurrentSong(firstSong.id));
  };

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
      {isOwner && (
        <HomeActionButton
          onClick={() => setIsReordering((prev) => !prev)}
          title={isReordering ? 'Lõpeta järjestamine' : 'Järjesta lugusid'}
          aria-label="Reorder playlist songs"
          active={isReordering}
        >
          <FiList size={16} />
        </HomeActionButton>
      )}
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
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent space-y-4">
        <GoBackButton />
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
      {playListData && !isReordering && (
        <SearchContent
          songs={songs}
          showInlineActions={false}
          enableInlinePlay={false}
          sortStrategy="none"
          showCategoryFilter={false}
        />
      )}
      {isOwner && isReordering && (
        <div className="flex flex-col gap-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-sky-100">
              Kasuta nooli, et muuta lugude järjekorda ja salvesta muudatused.
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={!hasOrderChanged || isSavingOrder}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCheck size={16} />
                Salvesta
              </button>
              <button
                type="button"
                onClick={cancelReorder}
                disabled={isSavingOrder}
                className="inline-flex items-center gap-2 rounded-full border border-sky-900/70 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiX size={16} />
                Loobu
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {reorderedSongs.length === 0 ? (
              <p className="text-sky-200/80">Playlistis ei ole ühtegi lugu.</p>
            ) : (
              reorderedSongs.map((song, index) => {
                const id = song?.identifier || (song as any)?.id;
                const name = song?.name;
                if (!id || !name) return null;
                const mediaSong: Song = {
                  id,
                  name,
                  title: song?.title || 'Nimetu lugu',
                  author: song?.author || (song as any)?.artist,
                  service: song?.service,
                  status: (song as any)?.status,
                };
                return (
                  <div
                    key={`${id}-${index}`}
                    className="flex w-full items-center gap-3 rounded-lg border border-sky-900/60 bg-sky-950/40 p-2"
                  >
                    <span className="w-6 text-right text-sm text-sky-300">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      <MediaItem data={mediaSong} showPlayButton={false} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveSong(index, 'up')}
                        disabled={index === 0}
                        aria-label="Liiguta lugu üles"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-900/60 bg-sky-950/60 text-sky-200/80 transition hover:bg-sky-900/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSong(index, 'down')}
                        disabled={index === reorderedSongs.length - 1}
                        aria-label="Liiguta lugu alla"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-900/60 bg-sky-950/60 text-sky-200/80 transition hover:bg-sky-900/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Box>
  );
};
