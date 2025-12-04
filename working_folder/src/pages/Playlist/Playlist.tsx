import React, { useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import Header from '../../components/Header';
import SearchContent from '../../components/SearchContent';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { useParams } from 'react-router-dom';
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
  setNewPlayList,
  upsertMyPlaylists,
  setNowPlayingPlaylist,
} from '../../state/features/globalSlice';
import { FiPlay, FiEdit2, FiList, FiChevronUp, FiChevronDown, FiThumbsUp } from 'react-icons/fi';
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
import { mapPlaylistSongsToSongs, usePlaylistPlayback } from '../../hooks/usePlaylistPlayback';
import useUploadPlaylistModal from '../../hooks/useUploadPlaylistModal';
import MediaItem from '../../components/MediaItem';
import { Song } from '../../types';
import GoBackButton from '../../components/GoBackButton';
import { mapPlaylistSummary } from '../../utils/playlistHelpers';
import useSendTipModal from '../../hooks/useSendTipModal';
import { LuCopy } from 'react-icons/lu';
import { RiHandCoinLine } from 'react-icons/ri';
import { fetchPlaylistLikeCount, hasUserLikedPlaylist, likePlaylist, unlikePlaylist } from '../../services/playlistLikes';

// Provided by the Qortal runtime
declare const qortalRequest: (payload: any) => Promise<any>;

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

const sanitizeFavoritesList = (entries: PlayList[] | null | undefined): PlayList[] => {
  if (!Array.isArray(entries)) return [];
  return entries.filter(
    (playlist) => playlist && typeof playlist.id === 'string' && playlist.id.trim().length > 0,
  );
};

export const Playlist = () => {
  const uploadPlaylistModal = useUploadPlaylistModal();
  const username = useSelector((state: RootState) => state.auth?.user?.name);

  const { playlistId, name } = useParams()
  const isfavoriting = useRef(false)
  const favoritesPlaylist= useSelector((state: RootState) => state.global.favoritesPlaylist);
  const dispatch = useDispatch()
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const globalPlaylists = useSelector((state: RootState) => state.global.playlists);
  const myPlaylists = useSelector((state: RootState) => state.global.myPlaylists);
  const { downloadVideo } = useContext(MyContext)
  const { ensurePlaylistSongs } = usePlaylistPlayback();
  const sendTipModal = useSendTipModal();

  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )
  const [playListData, setPlaylistData] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderedSongs, setReorderedSongs] = useState<SongReference[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [playlistLikeCount, setPlaylistLikeCount] = useState<number | null>(null);
  const [hasPlaylistLike, setHasPlaylistLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  const getPlaylistData = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !playlistId) return
      setIsLoadingDetails(true)

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
        const resourceData = mapPlaylistSummary(resourceEntry);
      
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
      setIsLoadingDetails(false)
    }
  }, [dispatch, playlistId])
  

  React.useEffect(() => {
    if (!playlistId) return;
    const hashEntry = playlistHash[playlistId];
    const fallbackEntry =
      hashEntry ||
      globalPlaylists.find((playlist) => playlist?.id === playlistId) ||
      myPlaylists.find((playlist) => playlist?.id === playlistId);
    if (fallbackEntry) {
      setPlaylistData(fallbackEntry);
    }
    const publisher = name || fallbackEntry?.user;
    if (publisher) {
      getPlaylistData(publisher, playlistId);
    }
  }, [playlistId, name, playlistHash, globalPlaylists, myPlaylists, getPlaylistData]);

  useEffect(() => {
    let cancelled = false;

    const loadLikeData = async () => {
      if (!playlistId) {
        setPlaylistLikeCount(0);
        setHasPlaylistLike(false);
        return;
      }

      try {
        const count = await fetchPlaylistLikeCount(playlistId);
        if (!cancelled) {
          setPlaylistLikeCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setPlaylistLikeCount(0);
        }
      }

      if (!username) {
        if (!cancelled) {
          setHasPlaylistLike(false);
        }
        return;
      }

      try {
        const liked = await hasUserLikedPlaylist(username, playlistId);
        if (!cancelled) {
          setHasPlaylistLike(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasPlaylistLike(false);
        }
      }
    };

    loadLikeData();

    return () => {
      cancelled = true;
    };
  }, [playlistId, username]);

  const isFavorite = useMemo(()=> {
    if(!playlistId || !favoritesPlaylist) {
      return false;
    }
    return Boolean(favoritesPlaylist?.find((play)=> play?.id === playlistId));
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

  const persistPlaylistOrder = useCallback(
    async (nextOrder?: SongReference[]) => {
      const orderToSave = nextOrder ?? reorderedSongs;
      if (!isOwner) {
        toast.error('Only the playlist owner can reorder tracks.');
        return;
      }
      if (!playListData?.id) return;
      if (isSavingOrder) return;
      if (!playListData.songs || playListData.songs.length !== orderToSave.length) return;

      const isSame = playListData.songs.every(
        (song: SongReference, index: number) => song.identifier === orderToSave[index]?.identifier,
      );
      if (isSame) return;

      try {
        setIsSavingOrder(true);
        const playlistPayload = {
          songs: orderToSave,
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
          songs: orderToSave.map((song) => ({ ...song })),
          updated: Date.now(),
        };
        setPlaylistData(updatedPlaylist);
        setReorderedSongs(orderToSave.map((song) => ({ ...song })));
        dispatch(addToPlaylistHashMap(updatedPlaylist));
        dispatch(upsertMyPlaylists([updatedPlaylist]));
        dispatch(setNewPlayList(updatedPlaylist));
        toast.success('Playlist order updated.', { id: 'playlist-order-updated' });
        window.dispatchEvent(
          new CustomEvent('playlists:refresh', {
            detail: {
              playlist: updatedPlaylist,
              mode: 'edit',
            },
          }),
        );
      } catch (error) {
        toast.error('Failed to update playlist order.');
      } finally {
        setIsSavingOrder(false);
      }
    },
    [dispatch, isOwner, isSavingOrder, playListData, reorderedSongs, username],
  );

  const moveSong = React.useCallback(
    (index: number, direction: 'up' | 'down') => {
      setReorderedSongs((prev) => {
        const next = [...prev];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        window.setTimeout(() => {
          persistPlaylistOrder(next);
        }, 0);
        return next;
      });
    },
    [persistPlaylistOrder],
  );

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
      toast.success('Link copied! Happy sharing!');
    } catch (error) {
      console.error('Failed to copy playlist link', error);
      toast.error('Could not copy the link right now.');
    }
  }, [name, playlistId]);

  const handleSendTip = useCallback(() => {
    if (!username) {
      toast.error('Log in to send tips.');
      return;
    }
    const publisher = name || playListData?.user;
    if (!publisher) {
      toast.error('Creator information is missing.');
      return;
    }
    sendTipModal.open(publisher);
  }, [name, playListData?.user, sendTipModal, username]);

  const handleTogglePlaylistLike = useCallback(async () => {
    if (!playlistId || !playListData) return;
    if (!username) {
      toast.error('Log in to like playlists.');
      return;
    }
    if (isProcessingLike) return;

    try {
      setIsProcessingLike(true);
      if (hasPlaylistLike) {
        await unlikePlaylist(username, playlistId);
        setHasPlaylistLike(false);
        setPlaylistLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        toast.success(`Removed like from "${playListData.title || 'this playlist'}".`);
      } else {
        await likePlaylist(username, playListData);
        setHasPlaylistLike(true);
        setPlaylistLikeCount((prev) => (prev ?? 0) + 1);
        toast.success(`You liked "${playListData.title || 'this playlist'}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle playlist like', error);
      toast.error('Could not update like. Please try again.');
    } finally {
      setIsProcessingLike(false);
    }
  }, [hasPlaylistLike, isProcessingLike, playListData, playlistId, username]);
  const handlePlayPlaylist = useCallback(async () => {
    if (!playListData) {
      toast.error('Playlist data missing.');
      return;
    }
    try {
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
    } catch (error) {
      console.error('Failed to play playlist', error);
      toast.error('Failed to start playback. Please try again.');
    }
  }, [dispatch, downloadVideo, downloads, ensurePlaylistSongs, playListData]);

  const handleToggleFavorite = async () => {
    if (!playListData) {
      toast.error('Playlist data missing.');
      return;
    }
    try {
      if(isfavoriting.current) return
      isfavoriting.current = true
      const alreadyFavorite =  !!favoritesPlaylist?.find((play)=> play?.id === playlistId)
      if(alreadyFavorite){
        dispatch(removeFavPlaylist(playListData))
  
        const favoritesObj = sanitizeFavoritesList(
          await favoritesStorage.getItem<PlayList[]>('favoritesPlaylist'),
        )

        if(favoritesObj.length){
          const newFavs = favoritesObj.filter((fav)=> fav.id !== playlistId)
          await favoritesStorage.setItem('favoritesPlaylist', newFavs)
      } 
      
    }else {
        dispatch(setFavPlaylist(playListData))

        const favoritesObj = sanitizeFavoritesList(
          await favoritesStorage.getItem<PlayList[]>('favoritesPlaylist'),
        )
        if (playListData?.id) {
          const filtered = favoritesObj.filter((fav)=> fav.id !== playlistId)
          const newObj: PlayList[] =   [playListData, ...filtered]
          await favoritesStorage.setItem('favoritesPlaylist', newObj)
        }
      }
  
      isfavoriting.current = false
    } catch (error) {
      console.error(error)
    }
   
  }

  const LikeIcon = isFavorite ? AiFillHeart : AiOutlineHeart;

  const publisherName = useMemo(() => name || playListData?.user || '', [name, playListData?.user]);
  const canInteract = Boolean(playListData);

  const QuickActionWrapper: React.FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="group relative">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-900/50 bg-sky-950/80 px-3 py-1 text-xs font-medium text-sky-100 opacity-0 shadow-lg shadow-sky-950/50 transition group-hover:opacity-100">
        {label}
      </span>
    </div>
  );

  const QuickActionButton: React.FC<{
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    badge?: ReactNode;
    active?: boolean;
  }> = ({ icon, label, onClick, disabled, badge, active }) => (
    <QuickActionWrapper label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-gradient-to-br from-sky-900/70 to-slate-900/80 text-sky-100 shadow-lg shadow-sky-950/50 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:from-sky-800/80 hover:to-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-emerald-400/80' : ''}`}
      >
        {icon}
        {badge && (
          <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500/80 px-1.5 text-[10px] font-semibold text-black">
            {badge}
          </span>
        )}
      </button>
    </QuickActionWrapper>
  );

  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent space-y-4">
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
          </div>
          {playListData?.description && (
            <p className="text-sm text-sky-200/80 md:text-base">{playListData.description}</p>
          )}
        </div>
      </div>
    </div>
  </Header>
      <div className="mx-4 mt-4 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-4 shadow-lg shadow-sky-950/30">
        <div className="flex flex-wrap items-center gap-4">
          {isOwner && (
            <QuickActionButton
              icon={<FiList className={`h-5 w-5 ${isReordering ? 'text-emerald-300' : ''}`} />}
              label={isReordering ? 'Stop Reordering' : 'Reorder Songs'}
              onClick={() => setIsReordering((prev) => !prev)}
              active={isReordering}
            />
          )}
          <QuickActionButton
            icon={<FiPlay className="h-5 w-5" />}
            label="Play This"
            onClick={handlePlayPlaylist}
            disabled={!hasSongs}
          />
          <QuickActionButton
            icon={<FiThumbsUp className={`h-5 w-5 ${hasPlaylistLike ? 'text-emerald-300' : ''}`} />}
            label="Like It"
            onClick={handleTogglePlaylistLike}
            disabled={isProcessingLike}
            badge={typeof playlistLikeCount === 'number' ? playlistLikeCount : null}
          />
          <QuickActionButton
            icon={<RiHandCoinLine className="h-5 w-5" />}
            label="Send Tips To Publisher"
            onClick={handleSendTip}
            disabled={!publisherName}
          />
          <QuickActionWrapper label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}>
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60 ${isFavorite ? 'bg-emerald-600/10 border-emerald-400/70' : ''}`}
              aria-label="Toggle favorite playlist"
            >
              <LikeIcon size={22} className="pointer-events-none" />
            </button>
          </QuickActionWrapper>
          <QuickActionButton
            icon={<LuCopy className="h-5 w-5" />}
            label="Copy Link & Share It"
            onClick={handleSharePlaylist}
          />
          {isOwner && (
            <QuickActionButton
              icon={<FiEdit2 className="h-5 w-5" />}
              label="Edit"
              onClick={onClickPlaylist}
            />
          )}
          <div className="ml-auto">
            <GoBackButton className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2 text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-500/60" />
          </div>
        </div>
      </div>
      {isLoadingDetails && (
        <div className="px-6 py-2 text-xs text-sky-200/80">
          Loading latest playlist data…
        </div>
      )}
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
              Use the arrows to reorder songs. Changes are saved automatically.
            </p>
            {isSavingOrder && (
              <span className="ml-auto text-xs text-emerald-200/80">Saving…</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {reorderedSongs.length === 0 ? (
              <p className="text-sky-200/80">This playlist does not contain any songs.</p>
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
                        aria-label="Move song up"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-900/60 bg-sky-950/60 text-sky-200/80 transition hover:bg-sky-900/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSong(index, 'down')}
                        disabled={index === reorderedSongs.length - 1}
                        aria-label="Move song down"
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
