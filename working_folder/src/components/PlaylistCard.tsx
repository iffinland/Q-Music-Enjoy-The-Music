import React, {
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { FiDownload, FiEdit2, FiPlay, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

import radioImg from '../assets/img/enjoy-music.jpg';
import {
  PlayList,
  removeFavPlaylist,
  setAddToDownloads,
  setCurrentPlaylist,
  setCurrentSong,
  setFavPlaylist,
  setNewPlayList,
  setNowPlayingPlaylist,
} from '../state/features/globalSlice';
import { RootState } from '../state/store';
import { MyContext } from '../wrappers/DownloadWrapper';
import { getQdnResourceUrl } from '../utils/qortalApi';
import { buildPlaylistShareUrl } from '../utils/qortalLinks';
import {
  fetchPlaylistLikeCount,
  hasUserLikedPlaylist,
  likePlaylist,
  unlikePlaylist,
} from '../services/playlistLikes';
import useUploadPlaylistModal from '../hooks/useUploadPlaylistModal';
import useSendTipModal from '../hooks/useSendTipModal';
import { RiHandCoinLine } from 'react-icons/ri';
import useCoverImage from '../hooks/useCoverImage';
import { qdnClient } from '../state/api/client';
import { mapPlaylistSongsToSongs, usePlaylistPlayback } from '../hooks/usePlaylistPlayback';
import { readJson, writeJson } from '../utils/storage';

interface PlaylistCardProps {
  data: PlayList;
  onClick?: () => void;
}

const PLAYLIST_FAVORITES_KEY = 'ear-bump-favorites:favoritesPlaylist';

const isValidPlaylistEntry = (playlist: PlayList | null | undefined): playlist is PlayList =>
  Boolean(playlist && typeof playlist.id === 'string' && playlist.id.trim().length > 0);

const sanitizeFavorites = (entries: PlayList[] | null | undefined): PlayList[] => {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isValidPlaylistEntry);
};

const PlaylistCard: React.FC<PlaylistCardProps> = ({ data, onClick }) => {
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const favoritesPlaylist = useSelector(
    (state: RootState) => state.global.favoritesPlaylist,
  );
  const { downloadVideo } = useContext(MyContext);
  const uploadPlaylistModal = useUploadPlaylistModal();
  const sendTipModal = useSendTipModal();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isLikeBusy, setIsLikeBusy] = useState<boolean>(false);
  const [isFavoriteBusy, setIsFavoriteBusy] = useState<boolean>(false);
  const [isPlayBusy, setIsPlayBusy] = useState<boolean>(false);
  const { ensurePlaylistSongs } = usePlaylistPlayback();

  const { url: coverUrl } = useCoverImage({
    identifier: data?.id ?? null,
    publisher: data?.user ?? null,
    enabled: Boolean(data?.id && data?.user),
  });

  const coverImage = data?.image || coverUrl || radioImg;

  const isFavorited = useMemo(
    () => favoritesPlaylist?.some((playlist) => playlist?.id === data.id) ?? false,
    [favoritesPlaylist, data.id],
  );
  const isOwner = useMemo(() => {
    if (!username || !data?.user) return false;
    return username.toLowerCase() === data.user.toLowerCase();
  }, [data?.user, username]);

  useEffect(() => {
    let cancelled = false;

    const loadLikeData = async () => {
      try {
        const count = await fetchPlaylistLikeCount(data.id);
        if (!cancelled) {
          setLikeCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setLikeCount(0);
        }
      }

      if (!username) {
        if (!cancelled) {
          setHasLiked(false);
        }
        return;
      }

      try {
        const liked = await hasUserLikedPlaylist(username, data.id);
        if (!cancelled) {
          setHasLiked(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasLiked(false);
        }
      }
    };

    loadLikeData();

    return () => {
      cancelled = true;
    };
  }, [data.id, username]);

  const handleCardClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCardClick();
      }
    },
    [handleCardClick],
  );

  const handlePlayPlaylist = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (isPlayBusy) return;

      const ready = await ensurePlaylistSongs(data);
      if (!ready || !ready.songs || ready.songs.length === 0) {
        toast.error('Playlist is empty.');
        return;
      }

      const firstTrack = ready.songs[0];
      if (!firstTrack?.identifier || !firstTrack?.name) {
        toast.error('Playlist track information is incomplete.');
        return;
      }

      try {
        setIsPlayBusy(true);
        const trackId = firstTrack.identifier;
        const service = firstTrack.service || 'AUDIO';
        dispatch(setCurrentPlaylist(ready.id));
        dispatch(setNowPlayingPlaylist(mapPlaylistSongsToSongs(ready.songs)));

        const downloadEntry = downloads[trackId];
        const isReady = downloadEntry?.status?.status === 'READY';

        if (isReady) {
          const resolvedUrl = await getQdnResourceUrl(
            service,
            firstTrack.name,
            trackId,
          );
          dispatch(
            setAddToDownloads({
              name: firstTrack.name,
              service,
              id: trackId,
              identifier: trackId,
              url: resolvedUrl ?? undefined,
              status: downloadEntry?.status,
              title: firstTrack.title || '',
              author: firstTrack.author || firstTrack.name,
            }),
          );
        } else {
          downloadVideo({
            name: firstTrack.name,
            service,
            identifier: trackId,
            title: firstTrack.title || '',
            author: firstTrack.author || firstTrack.name,
            id: trackId,
          });
        }

        dispatch(setCurrentSong(trackId));
        toast.success('Playlist playback starting…');
      } catch (error) {
        console.error('Failed to play playlist', error);
        toast.error('Could not play this playlist.');
      } finally {
        setIsPlayBusy(false);
      }
    },
    [data, dispatch, downloadVideo, downloads, ensurePlaylistSongs, isPlayBusy],
  );

  const handleSharePlaylist = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!data.user) {
        toast.error('Creator information is missing.');
        return;
      }

      try {
        const shareLink = buildPlaylistShareUrl(data.user, data.id);

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
    },
    [data.user, data.id],
  );

  const handleToggleFavorite = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to manage playlists.');
        return;
      }

      if (isFavoriteBusy) return;

      try {
        setIsFavoriteBusy(true);
        const existing = sanitizeFavorites(
          (await readJson<PlayList[]>(PLAYLIST_FAVORITES_KEY)) || [],
        );

        if (isFavorited) {
          const updated = existing.filter((playlist) => playlist.id !== data.id);
          await writeJson(PLAYLIST_FAVORITES_KEY, updated);
          dispatch(removeFavPlaylist(data));
          toast.success('Playlist removed from favorites.');
        } else {
          const filtered = existing.filter((playlist) => playlist.id !== data.id);
          const updated = [data, ...filtered];
          await writeJson(PLAYLIST_FAVORITES_KEY, updated);
          dispatch(setFavPlaylist(data));
          toast.success('Playlist added to favorites!');
        }
      } catch (error) {
        console.error('Failed to toggle playlist favorite', error);
        toast.error('Could not update favorites. Please try again.');
      } finally {
        setIsFavoriteBusy(false);
      }
    },
    [username, isFavoriteBusy, isFavorited, data, dispatch],
  );

  const handleToggleLike = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to like playlists.');
        return;
      }

      if (isLikeBusy) return;

      try {
        setIsLikeBusy(true);
        if (hasLiked) {
          await unlikePlaylist(username, data.id);
          setHasLiked(false);
          setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
          toast.success(`Removed like from "${data.title}".`);
        } else {
          await likePlaylist(username, data);
          setHasLiked(true);
          setLikeCount((prev) => (prev ?? 0) + 1);
          toast.success(`You liked "${data.title}".`);
        }
      } catch (error) {
        console.error('Failed to toggle playlist like', error);
        toast.error('Could not update like. Please try again.');
      } finally {
        setIsLikeBusy(false);
      }
    },
    [username, isLikeBusy, hasLiked, data],
  );

  const FavoriteIcon = isFavorited ? AiFillHeart : AiOutlineHeart;

  const handleDownloadPlaylist = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!data.user) {
        toast.error('Creator information is missing.');
        return;
      }

      try {
        const resource = await qdnClient.fetchResource({
          name: data.user,
          service: 'PLAYLIST',
          identifier: data.id,
        });

        if (!resource) {
          toast.error('Playlist content not found.');
          return;
        }

        const blob = new Blob([JSON.stringify(resource, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${(data.title || data.id || 'playlist').replace(/\s+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success('Playlist downloaded.');
      } catch (error) {
        console.error('Failed to download playlist', error);
        toast.error('Could not download this playlist.');
      }
    },
    [data.id, data.title, data.user],
  );

  const handleSendTip = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }
      if (!data.user) {
        toast.error('Creator information is missing.');
        return;
      }

      sendTipModal.open(data.user);
    },
    [data.user, sendTipModal, username],
  );

  const handleEditPlaylist = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!isOwner) {
        toast.error('Only the original creator can edit this playlist.');
        return;
      }

      dispatch(setNewPlayList(data));
      uploadPlaylistModal.onOpen();
    },
    [data, dispatch, isOwner, uploadPlaylistModal],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="
        group 
        flex 
        flex-col 
        items-start 
        rounded-md 
        overflow-hidden 
        bg-sky-950/40 
        border 
        border-sky-900/40 
        hover:bg-sky-900/50 
        transition 
        p-4 
        w-[240px] 
        min-w-[240px] 
        h-[360px]
        text-left
        focus:outline-none
        focus:ring-2
        focus:ring-sky-500/60
      "
    >
      <div className="relative w-full h-40 rounded-md overflow-hidden">
        <img
          src={coverImage}
          alt={data?.title || 'Playlist cover'}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex flex-col gap-y-2 w-full pt-4 text-sky-200/90">
        <p className="font-semibold truncate text-white">{data?.title}</p>
        <p
          className="text-sm leading-snug text-sky-200/70"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data?.description || 'No description available.'}
        </p>
      </div>
      <div className="mt-auto w-full pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sky-200/80">
        <button
          type="button"
          onClick={handlePlayPlaylist}
          disabled={isPlayBusy}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-800/70 text-white transition hover:bg-sky-700 disabled:opacity-60"
          aria-label="Play"
          title="Play"
        >
          <FiPlay size={16} />
        </button>
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={isLikeBusy}
          className={`flex items-center justify-center gap-1 rounded-full px-2.5 h-9 text-[11px] font-semibold transition ${
            hasLiked
              ? 'bg-sky-800/70 text-white hover:bg-sky-700'
              : 'bg-sky-900/40 text-sky-200/70 hover:bg-sky-800/50'
          } disabled:opacity-60`}
          aria-label="Like It"
          title="Like It"
        >
          <FiThumbsUp size={16} />
          <span>{likeCount ?? '—'}</span>
        </button>
        <button
          type="button"
          onClick={handleToggleFavorite}
          disabled={isFavoriteBusy}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            isFavorited
              ? 'bg-sky-800/70 text-white hover:bg-sky-700'
              : 'bg-sky-900/40 text-sky-200/70 hover:bg-sky-800/50'
          } disabled:opacity-60`}
          aria-label="Add Favorites"
          title="Add Favorites"
        >
          <FavoriteIcon size={18} />
        </button>
        <button
          type="button"
          onClick={handleDownloadPlaylist}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/40 text-sky-200/70 transition hover:bg-sky-800/50"
          aria-label="Download"
          title="Download"
        >
          <FiDownload size={16} />
        </button>
        <button
          type="button"
          onClick={handleSharePlaylist}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/40 text-sky-200/70 transition hover:bg-sky-800/50"
          aria-label="Copy link & Share It"
          title="Copy link & Share It"
        >
          <FiShare2 size={16} />
        </button>
        <button
          type="button"
          onClick={handleSendTip}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/40 text-sky-200/70 transition hover:bg-sky-800/50"
          aria-label="Send Tips to Publisher"
          title="Send Tips to Publisher"
        >
          <RiHandCoinLine size={16} />
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={handleEditPlaylist}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/40 text-sky-200/70 transition hover:bg-sky-800/50"
            aria-label="Edit"
            title="Edit"
          >
            <FiEdit2 size={16} />
          </button>
        )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistCard;
