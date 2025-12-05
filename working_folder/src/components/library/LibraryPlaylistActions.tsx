import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaPlay } from 'react-icons/fa';
import { FiDownload, FiEdit2, FiShare2, FiThumbsUp, FiTrash2 } from 'react-icons/fi';
import { RiHandCoinLine } from 'react-icons/ri';
import { MdPlaylistAdd } from 'react-icons/md';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { toast } from 'react-hot-toast';

import HomeActionButton from '../home/HomeActionButton';
import useSendTipModal from '../../hooks/useSendTipModal';
import useUploadPlaylistModal from '../../hooks/useUploadPlaylistModal';
import { MyContext } from '../../wrappers/DownloadWrapper';
import {
  PlayList,
  removeFavPlaylist,
  removePlaylistById,
  setAddToDownloads,
  setCurrentPlaylist,
  setCurrentSong,
  setFavPlaylist,
  setNewPlayList,
  setNowPlayingPlaylist,
} from '../../state/features/globalSlice';
import { RootState } from '../../state/store';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPlaylistShareUrl } from '../../utils/qortalLinks';
import {
  fetchPlaylistLikeCount,
  hasUserLikedPlaylist,
  likePlaylist,
  unlikePlaylist,
} from '../../services/playlistLikes';
import { mapPlaylistSongsToSongs, usePlaylistPlayback } from '../../hooks/usePlaylistPlayback';
import { deletePlaylistResource } from '../../services/playlists';
import { qdnClient } from '../../state/api/client';
import { readJson, writeJson } from '../../utils/storage';

const PLAYLIST_FAVORITES_KEY = 'ear-bump-favorites:favoritesPlaylist';

const isValidPlaylistEntry = (playlist: PlayList | null | undefined): playlist is PlayList =>
  Boolean(playlist && typeof playlist.id === 'string' && playlist.id.trim().length > 0);

const sanitizeFavorites = (entries: PlayList[] | null | undefined): PlayList[] => {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isValidPlaylistEntry);
};

interface LibraryPlaylistActionsProps {
  playlist: PlayList;
}

export const LibraryPlaylistActions: React.FC<LibraryPlaylistActionsProps> = ({
  playlist,
}) => {
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const favoritesPlaylist = useSelector(
    (state: RootState) => state.global.favoritesPlaylist,
  );
  const sendTipModal = useSendTipModal();
  const uploadPlaylistModal = useUploadPlaylistModal();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [likeBusy, setLikeBusy] = useState<boolean>(false);
  const [favBusy, setFavBusy] = useState<boolean>(false);
  const [playBusy, setPlayBusy] = useState<boolean>(false);
  const [deleteBusy, setDeleteBusy] = useState<boolean>(false);
  const { ensurePlaylistSongs } = usePlaylistPlayback();

  const isFavorited = useMemo(
    () => favoritesPlaylist?.some((item) => item?.id === playlist.id) ?? false,
    [favoritesPlaylist, playlist.id],
  );

  const isOwner = useMemo(() => {
    if (!username || !playlist.user) return false;
    return username.toLowerCase() === playlist.user.toLowerCase();
  }, [playlist.user, username]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchPlaylistLikeCount(playlist.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLiked(false);
        return;
      }

      try {
        const liked = await hasUserLikedPlaylist(username, playlist.id);
        if (!cancelled) setHasLiked(liked);
      } catch (error) {
        if (!cancelled) setHasLiked(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [playlist.id, username]);

  const handlePlay = useCallback(async () => {
    if (playBusy) return;

    const ready = await ensurePlaylistSongs(playlist);
    if (!ready || !ready.songs || ready.songs.length === 0) {
      toast.error('Playlist is empty.');
      return;
    }

    const head = ready.songs[0];
    if (!head?.identifier || !head?.name) {
      toast.error('Playlist song information missing.');
      return;
    }

    try {
      setPlayBusy(true);
      dispatch(setCurrentPlaylist(ready.id));
      dispatch(setNowPlayingPlaylist(mapPlaylistSongsToSongs(ready.songs)));

      const downloadEntry = downloads[head.identifier];
      const isReady = downloadEntry?.status?.status === 'READY';

      if (isReady) {
        const resolvedUrl =
          downloadEntry?.url ||
          (await getQdnResourceUrl(
            head.service || 'AUDIO',
            head.name,
            head.identifier,
          ));
        dispatch(
          setAddToDownloads({
            name: head.name,
            service: head.service || 'AUDIO',
            id: head.identifier,
            identifier: head.identifier,
            url: resolvedUrl ?? undefined,
            status: downloadEntry?.status,
            title: head.title || '',
            author: head.author || head.name,
          }),
        );
      } else {
        downloadVideo({
          name: head.name,
          service: head.service || 'AUDIO',
          identifier: head.identifier,
          title: head.title || '',
          author: head.author || head.name,
          id: head.identifier,
        });
      }

      dispatch(setCurrentSong(head.identifier));
    } catch (error) {
      toast.error('Unable to start playback for this playlist.');
    } finally {
      setPlayBusy(false);
    }
  }, [dispatch, downloadVideo, downloads, playBusy, playlist, ensurePlaylistSongs]);

  const handleToggleFavorite = useCallback(async () => {
    if (!username) {
      toast.error('Log in to manage favorites.');
      return;
    }

    if (favBusy) return;

    try {
      setFavBusy(true);
      const existing = sanitizeFavorites(
        (await readJson<PlayList[]>(PLAYLIST_FAVORITES_KEY)) || [],
      );

      if (isFavorited) {
        const updated = existing.filter((item) => item.id !== playlist.id);
        await writeJson(PLAYLIST_FAVORITES_KEY, updated);
        dispatch(removeFavPlaylist(playlist));
      } else {
        const filtered = existing.filter((item) => item.id !== playlist.id);
        const updated = [playlist, ...filtered];
        await writeJson(PLAYLIST_FAVORITES_KEY, updated);
        dispatch(setFavPlaylist(playlist));
      }
    } catch (error) {
      toast.error('Unable to update favorites right now.');
    } finally {
      setFavBusy(false);
    }
  }, [dispatch, favBusy, isFavorited, playlist, username]);

  const handleToggleLike = useCallback(async () => {
    if (!username) {
      toast.error('Log in to like playlists.');
      return;
    }

    if (likeBusy) return;

    try {
      setLikeBusy(true);
      if (hasLiked) {
        await unlikePlaylist(username, playlist.id);
        setHasLiked(false);
        setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
      } else {
        await likePlaylist(username, playlist);
        setHasLiked(true);
        setLikeCount((prev) => (prev ?? 0) + 1);
      }
    } catch (error) {
      toast.error('Unable to update like right now.');
    } finally {
      setLikeBusy(false);
    }
  }, [hasLiked, likeBusy, playlist, username]);

  const handleDelete = useCallback(async () => {
    if (!isOwner || !username) {
      toast.error('Only the author can delete this playlist.');
      return;
    }
    const confirmed = window.confirm('Delete this playlist? This cannot be undone.');
    if (!confirmed) return;
    try {
      setDeleteBusy(true);
      await deletePlaylistResource(username, playlist.id);
      dispatch(removePlaylistById(playlist.id));
      if (isFavorited) {
        const existing = sanitizeFavorites(
          (await readJson<PlayList[]>(PLAYLIST_FAVORITES_KEY)) || [],
        );
        const updated = existing.filter((item) => item.id !== playlist.id);
        await writeJson(PLAYLIST_FAVORITES_KEY, updated);
        dispatch(removeFavPlaylist(playlist));
      }
      toast.success('Playlist deleted.');
      window.dispatchEvent(
        new CustomEvent('playlists:refresh', {
          detail: {
            playlistId: playlist.id,
            mode: 'delete',
          },
        }),
      );
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete playlist.');
    } finally {
      setDeleteBusy(false);
    }
  }, [dispatch, isFavorited, isOwner, playlist, username]);

  const handleDownload = useCallback(async () => {
    if (!playlist.user) {
      toast.error('Playlist publisher missing.');
      return;
    }

    try {
      const resource = await qdnClient.fetchResource({
        name: playlist.user,
        service: 'PLAYLIST',
        identifier: playlist.id,
      });

      if (!resource) {
        toast.error('Playlist content not available yet.');
        return;
      }

      const blob = new Blob([JSON.stringify(resource, null, 2)], {
        type: 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(playlist.title || playlist.id || 'playlist').replace(
        /\s+/g,
        '_',
      )}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success('Playlist exported.');
    } catch (error) {
      toast.error('Unable to download playlist right now.');
    }
  }, [playlist.id, playlist.title, playlist.user]);

  const handleShare = useCallback(() => {
    if (!playlist.user) {
      toast.error('Playlist publisher missing.');
      return;
    }

    try {
      const link = buildPlaylistShareUrl(playlist.user, playlist.id);
      navigator.clipboard?.writeText(link);
      toast.success('Playlist link copied.');
    } catch (error) {
      toast.error('Unable to copy playlist link.');
    }
  }, [playlist.id, playlist.user]);

  const handleTip = useCallback(() => {
    if (!username) {
      toast.error('Log in to send tips.');
      return;
    }
    if (!playlist.user) {
      toast.error('Playlist publisher missing.');
      return;
    }
    sendTipModal.open(playlist.user);
  }, [playlist.user, sendTipModal, username]);

  const handleEdit = useCallback(() => {
    if (!isOwner) {
      toast.error('Only the original publisher can edit this playlist.');
      return;
    }
    dispatch(setNewPlayList(playlist));
    uploadPlaylistModal.onOpen();
  }, [dispatch, isOwner, playlist, uploadPlaylistModal]);

  const handleCloneToPlaylist = useCallback(() => {
    if (!username) {
      toast.error('Log in to manage playlists.');
      return;
    }
    dispatch(setNewPlayList(playlist));
    uploadPlaylistModal.onOpen();
  }, [dispatch, playlist, uploadPlaylistModal, username]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handlePlay();
        }}
        title="Play"
        aria-label="Play"
        disabled={playBusy}
      >
        <FaPlay size={14} />
      </HomeActionButton>

      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handleToggleLike();
        }}
        title="Like It"
        aria-label="Like It"
        active={hasLiked}
        disabled={likeBusy}
        className="px-2"
      >
        <div className="flex items-center gap-1 text-[11px] font-semibold">
          <FiThumbsUp size={14} />
          <span>{likeCount ?? '—'}</span>
        </div>
      </HomeActionButton>

      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handleCloneToPlaylist();
        }}
        title="Add to Playlist"
        aria-label="Add to Playlist"
      >
        <MdPlaylistAdd size={16} />
      </HomeActionButton>

      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handleToggleFavorite();
        }}
        title="Add Favorites"
        aria-label="Add Favorites"
        active={isFavorited}
        disabled={favBusy}
      >
        {isFavorited ? <AiFillHeart size={16} /> : <AiOutlineHeart size={16} />}
      </HomeActionButton>

      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handleDownload();
        }}
        title="Download"
        aria-label="Download"
      >
        <FiDownload size={16} />
      </HomeActionButton>

      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handleShare();
        }}
        title="Copy link & Share It"
        aria-label="Copy link & Share It"
      >
        <FiShare2 size={16} />
      </HomeActionButton>

      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handleTip();
        }}
        title="Send Tips to Publisher"
        aria-label="Send Tips to Publisher"
      >
        <RiHandCoinLine size={16} />
      </HomeActionButton>

      {isOwner && (
        <>
          <HomeActionButton
            onClick={(event) => {
              event.stopPropagation();
              handleEdit();
            }}
            title="Edit"
            aria-label="Edit"
            disabled={deleteBusy}
          >
            <FiEdit2 size={16} />
          </HomeActionButton>
          <HomeActionButton
            onClick={(event) => {
              event.stopPropagation();
              handleDelete();
            }}
            title="Delete"
            aria-label="Delete"
            disabled={deleteBusy}
          >
            <FiTrash2 size={16} />
          </HomeActionButton>
        </>
      )}
    </div>
  );
};

export default LibraryPlaylistActions;
