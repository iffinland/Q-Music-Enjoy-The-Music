import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom';
import Header from '../../components/Header'
import SearchContent from '../../components/SearchContent'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { PlayList, SongReference, Status, addToPlaylistHashMap, removeFavPlaylist, setCurrentPlaylist, setCurrentSong, setFavPlaylist, setNewPlayList, setNowPlayingPlaylist } from '../../state/features/globalSlice'
import { AiFillEdit, AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { FiChevronDown, FiChevronUp, FiList, FiPlay } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import { MyContext } from '../../wrappers/DownloadWrapper'
import localforage from 'localforage'
import likeImg from '../../assets/img/like-button.png'
import Box from '../../components/Box';
import { buildPlaylistShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import { shouldHideQdnResource } from '../../utils/qdnResourceFilters';
import { cachedSearchQdnResources } from '../../services/resourceCache';
import { mapPlaylistSongsToSongs, usePlaylistPlayback } from '../../hooks/usePlaylistPlayback';
import GoBackButton from '../../components/GoBackButton';
import { mapPlaylistSummary } from '../../utils/playlistHelpers';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

const sanitizeFavoritesList = (entries: PlayList[] | null | undefined): PlayList[] => {
  if (!Array.isArray(entries)) return [];
  return entries.filter(
    (playlist) => playlist && typeof playlist.id === 'string' && playlist.id.trim().length > 0,
  );
};

export const PlaylistStandalone = ({
  playlistId,
  name
}: any) => {
  const params = useParams();
  const resolvedPlaylistId = playlistId || params.playlistId;
  const resolvedName = name || params.name;
  const username = useSelector((state: RootState) => state.auth?.user?.name);

  const isfavoriting = useRef(false)
  const favoritesPlaylist= useSelector((state: RootState) => state.global.favoritesPlaylist);
  const dispatch = useDispatch()
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const { downloadVideo } = useContext(MyContext)
  const { ensurePlaylistSongs } = usePlaylistPlayback();

  const [playListData, setPlaylistData] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isReordering, setIsReordering] = useState(false);
  const [reorderedSongs, setReorderedSongs] = useState<SongReference[]>([]);

  const getPlaylistData = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !id) return
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
        identifier: id,
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
          name,
          service: 'PLAYLIST',
          identifier: id
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
  }, [dispatch])
  

  useEffect(() => {
    if (resolvedName && resolvedPlaylistId) {
      const existing = playlistHash[resolvedPlaylistId]

      if (existing) {
        setPlaylistData(existing)
      } else {
        getPlaylistData(resolvedName, resolvedPlaylistId)
      }
    }
  }, [resolvedPlaylistId, resolvedName, playlistHash, getPlaylistData])

  useEffect(() => {
    if (!playListData?.songs) {
      setReorderedSongs([]);
      return;
    }
    setReorderedSongs(
      playListData.songs.map((song: any) => ({
        ...song,
        id: song?.identifier || song?.id,
      })),
    );
  }, [playListData?.songs]);

  const isLiked = useMemo(()=> {
    if(!resolvedPlaylistId || !favoritesPlaylist) {
      return false
    }
    if(favoritesPlaylist?.find((play)=> play?.id === resolvedPlaylistId)) return true

    return false
  }, [resolvedPlaylistId , favoritesPlaylist])
 
  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;
 

  const songs = useMemo(() => {
    return (playListData?.songs || []).map((song: any) => ({
      ...song,
      id: song?.identifier || song?.id,
    }));
  }, [playListData?.songs]);

  const onClickPlaylist = ()=> {

      dispatch(setNewPlayList(playListData))



   
  }
  const handleSharePlaylist = React.useCallback(async () => {
    if (!resolvedPlaylistId || !resolvedName) return;
    try {
      const shareLink = buildPlaylistShareUrl(resolvedName, resolvedPlaylistId);
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
  }, [resolvedName, resolvedPlaylistId]);
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

    await downloadVideo({
      name: firstSong.name,
      service: 'AUDIO',
      identifier: firstSong.id,
      title: firstSong?.title || '',
      author: firstSong?.author || '',
      id: firstSong.id,
    });

    dispatch(setCurrentSong(firstSong.id));
  };

  const handleLike = async () => {
    try {
      if(isfavoriting.current) return
      isfavoriting.current = true
    const isLiked =  !!favoritesPlaylist?.find((play)=> play?.id === resolvedPlaylistId)
      if(isLiked){
        dispatch(removeFavPlaylist(playListData))
  
        const favoritesObj = sanitizeFavoritesList(
          await favoritesStorage.getItem<PlayList[]>('favoritesPlaylist'),
        )

        if(favoritesObj.length){
          const newFavs = favoritesObj.filter((fav)=> fav.id !== resolvedPlaylistId)
          await favoritesStorage.setItem('favoritesPlaylist', newFavs)
        } 
        
      }else {
        dispatch(setFavPlaylist(playListData))
  
        const favoritesObj = sanitizeFavoritesList(
          await favoritesStorage.getItem<PlayList[]>('favoritesPlaylist'),
        )
        if (playListData?.id) {
          const filtered = favoritesObj.filter((fav)=> fav.id !== resolvedPlaylistId)
          const newObj: PlayList[] =   [playListData, ...filtered]
          await favoritesStorage.setItem('favoritesPlaylist', newObj)
        }
      }
  
      isfavoriting.current = false
    } catch (error) {
      console.error(error)
    }
   
  }

  const moveSong = (index: number, direction: 'up' | 'down') => {
    setReorderedSongs((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      setPlaylistData((existing: any) =>
        existing ? { ...existing, songs: next } : existing,
      );
      return next;
    });
  };

  const QuickActionWrapper: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="group relative">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-900/50 bg-sky-950/80 px-3 py-1 text-xs font-medium text-sky-100 opacity-0 shadow-lg shadow-sky-950/50 transition group-hover:opacity-100">
        {label}
      </span>
    </div>
  );

  const QuickActionButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }> = ({ icon, label, onClick, disabled }) => (
    <QuickActionWrapper label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-gradient-to-br from-sky-900/70 to-slate-900/80 text-sky-100 shadow-lg shadow-sky-950/50 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:from-sky-800/80 hover:to-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon}
      </button>
    </QuickActionWrapper>
  );

  const headerTitle = playListData?.title || 'Playlist';
  const headerSubtitle = playListData?.description || 'Enjoy this playlist';
  const canInteract = Boolean(playListData) && !isLoadingDetails;

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{headerTitle}</h1>
            <p className="text-sky-300/80">
              {playListData?.user ? `By ${playListData.user}` : 'Community playlist'}
            </p>
            <p className="text-sky-200/70 text-sm">{headerSubtitle}</p>
          </div>
        </div>
      </Header>

      <div className="mt-4 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-4 shadow-lg shadow-sky-950/30">
        <div className="flex flex-wrap items-center gap-4">
          <QuickActionButton
            icon={<FiPlay className="h-5 w-5" />}
            label={playListData?.songs?.length ? 'Play This' : 'No Songs'}
            onClick={onClickPlayPlaylist}
            disabled={!canInteract || !playListData?.songs?.length}
          />
          <QuickActionButton
            icon={<LuCopy className="h-5 w-5" />}
            label="Copy Link & Share It"
            onClick={handleSharePlaylist}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<Icon color={isLiked ? '#22c55e' : 'white'} className="h-5 w-5" />}
            label={isLiked ? 'Remove Favorite' : 'Add to Favorites'}
            onClick={handleLike}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiList className={`h-5 w-5 ${isReordering ? 'text-emerald-300' : ''}`} />}
            label={isReordering ? 'Finish Reordering' : 'Reorder Tracks'}
            onClick={() => setIsReordering((prev) => !prev)}
            disabled={!canInteract || !playListData?.songs?.length}
          />
          {username === playListData?.user && (
            <QuickActionButton
              icon={<AiFillEdit className="h-5 w-5" />}
              label="Edit"
              onClick={onClickPlaylist}
              disabled={!canInteract}
            />
          )}
          <div className="ml-auto">
            <GoBackButton className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2 text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-500/60" />
          </div>
        </div>
      </div>

      {isLoadingDetails && (
        <div className="mt-6 text-sky-200/80">Loading latest playlist data…</div>
      )}
      {!isLoadingDetails && !playListData && (
        <div className="mt-6 rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
          Playlist details are unavailable.
        </div>
      )}

      {playListData && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
          <Box className="flex flex-col items-center gap-4 p-6">
            <img
              className="w-full rounded-lg border border-sky-900/60 object-cover"
              src={playListData?.image ? playListData?.image : likeImg}
              alt="Playlist"
            />
            <div className="w-full text-center md:text-left">
              <h2 className="text-xl font-semibold text-white">{playListData?.title}</h2>
              {playListData?.user && (
                <p className="mt-1 text-sm text-sky-200/80">
                  Published by <span className="font-medium text-sky-100">{playListData.user}</span>
                </p>
              )}
              {playListData?.songs?.length ? (
                <p className="mt-1 text-xs text-sky-400/60">
                  {playListData.songs.length} tracks
                </p>
              ) : null}
            </div>
          </Box>

          <div className="flex flex-col gap-6">
            <Box className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Description</h3>
              {playListData?.description ? (
                <p className="text-sky-100/90 leading-relaxed whitespace-pre-line">
                  {playListData.description}
                </p>
              ) : (
                <p className="text-sm text-sky-200/70">
                  No description has been provided for this playlist yet.
                </p>
              )}
            </Box>

            <Box className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Tracks</h3>
              {isReordering ? (
                reorderedSongs.length ? (
                  <div className="space-y-2">
                    {reorderedSongs.map((song, idx) => (
                      <div
                        key={song.identifier || (song as any).id || `${song.name}-${idx}`}
                        className="flex items-center justify-between rounded-lg border border-sky-900/60 bg-sky-950/50 px-3 py-2 text-sm text-sky-100"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold">{song.title || song.identifier || `Track ${idx + 1}`}</span>
                          <span className="text-xs text-sky-400/80">{song.author || song.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded border border-sky-800/80 p-1 text-sky-200 transition hover:border-sky-500 hover:text-white disabled:opacity-40"
                            onClick={() => moveSong(idx, 'up')}
                            disabled={idx === 0}
                            aria-label="Move track up"
                          >
                            <FiChevronUp />
                          </button>
                          <button
                            type="button"
                            className="rounded border border-sky-800/80 p-1 text-sky-200 transition hover:border-sky-500 hover:text-white disabled:opacity-40"
                            onClick={() => moveSong(idx, 'down')}
                            disabled={idx === reorderedSongs.length - 1}
                            aria-label="Move track down"
                          >
                            <FiChevronDown />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-sky-200/70">No tracks to reorder.</p>
                )
              ) : (
                <SearchContent
                  songs={songs}
                  showInlineActions={false}
                  enableInlinePlay={false}
                />
              )}
            </Box>
          </div>
        </div>
      )}
    </div>
  )
}
