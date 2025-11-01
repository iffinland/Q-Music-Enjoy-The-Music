import {
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaPlay } from 'react-icons/fa';
import { FiDownload, FiEdit2, FiThumbsUp } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import { MdPlaylistAdd } from 'react-icons/md';
import { RiHandCoinLine } from 'react-icons/ri';
import { toast } from 'react-hot-toast';

import { Song } from '../../types';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { SongMeta, setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import { RootState } from '../../state/store';
import useSendTipModal from '../../hooks/useSendTipModal';
import useUploadModal from '../../hooks/useUploadModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildSongShareUrl } from '../../utils/qortalLinks';
import {
  fetchSongLikeCount,
  hasUserLikedSong,
  likeSong,
  unlikeSong,
} from '../../services/songLikes';
import HomeActionButton from '../home/HomeActionButton';
import LikeButton from '../LikeButton';

interface LibrarySongActionsProps {
  song: Song;
}

export const LibrarySongActions: React.FC<LibrarySongActionsProps> = ({
  song,
}) => {
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const sendTipModal = useSendTipModal();
  const uploadModal = useUploadModal();
  const addSongToPlaylistModal = useAddSongToPlaylistModal();
  const navigate = useNavigate();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLike, setHasLike] = useState<boolean>(false);
  const [likeBusy, setLikeBusy] = useState<boolean>(false);

  const isOwner = useMemo(() => {
    if (!username || !song?.name) return false;
    return username.toLowerCase() === song.name.toLowerCase();
  }, [song?.name, username]);

  const favoriteSongData: Song = useMemo(
    () => ({
      id: song.id,
      title: song.title,
      name: song.name,
      author: song.author,
      service: song.service,
      status: song.status,
    }),
    [song],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchSongLikeCount(song.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLike(false);
        return;
      }

      try {
        const liked = await hasUserLikedSong(username, song.id);
        if (!cancelled) setHasLike(liked);
      } catch (error) {
        if (!cancelled) setHasLike(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [song.id, username]);

  const handlePlay = useCallback(async () => {
    if (!song.name) {
      toast.error('Song publisher missing.');
      return;
    }

    const downloadEntry = downloads[song.id];
    const isReady =
      downloadEntry?.status?.status === 'READY' ||
      song.status?.status === 'READY';

    try {
      if (isReady) {
        const resolvedUrl =
          downloadEntry?.url ||
          (await getQdnResourceUrl('AUDIO', song.name, song.id));
        dispatch(
          setAddToDownloads({
            name: song.name,
            service: 'AUDIO',
            id: song.id,
            identifier: song.id,
            url: resolvedUrl ?? undefined,
            status: song.status,
            title: song.title || '',
            author: song.author || '',
          }),
        );
      } else {
        downloadVideo({
          name: song.name,
          service: 'AUDIO',
          identifier: song.id,
          title: song.title || '',
          author: song.author || '',
          id: song.id,
        });
      }

      dispatch(setCurrentSong(song.id));
    } catch (error) {
      toast.error('Unable to start playback right now.');
    }
  }, [dispatch, downloadVideo, downloads, song]);

  const handleToggleLike = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!username) {
        toast.error('Log in to like songs.');
        return;
      }

      if (likeBusy) return;

      try {
        setLikeBusy(true);
        if (hasLike) {
          await unlikeSong(username, song.id);
          setHasLike(false);
          setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        } else {
          await likeSong(username, {
            id: song.id,
            name: song.name,
            title: song.title,
          });
          setHasLike(true);
          setLikeCount((prev) => (prev ?? 0) + 1);
        }
      } catch (error) {
        toast.error('Unable to update like right now.');
      } finally {
        setLikeBusy(false);
      }
    },
    [hasLike, likeBusy, song.id, song.name, song.title, username],
  );

  const handleDownload = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!song.name) {
        toast.error('Song publisher missing.');
        return;
      }

      try {
        const resolvedUrl = await getQdnResourceUrl('AUDIO', song.name, song.id);
        if (!resolvedUrl) {
          toast.error('Song download not available yet.');
          return;
        }

        const anchor = document.createElement('a');
        anchor.href = resolvedUrl;
        anchor.download = `${(song.title || song.id || 'song').replace(
          /\s+/g,
          '_',
        )}.audio`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        dispatch(
          setAddToDownloads({
            name: song.name,
            service: 'AUDIO',
            id: song.id,
            identifier: song.id,
            url: resolvedUrl,
            status: song.status,
            title: song.title || '',
            author: song.author || '',
          }),
        );
        toast.success('Song download started.');
      } catch (error) {
        toast.error('Song could not be downloaded right now.');
      }
    },
    [dispatch, song],
  );

  const handleCopyLink = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!song.name) {
        toast.error('Song publisher missing.');
        return;
      }

      try {
        const link = buildSongShareUrl(song.name, song.id);
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
        } else {
          const ta = document.createElement('textarea');
          ta.value = link;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        toast.success('Link copied to clipboard.');
      } catch (error) {
        toast.error('Failed to copy link.');
      }
    },
    [song.id, song.name],
  );

  const handleTip = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }
      if (!song.name) {
        toast.error('Song publisher missing.');
        return;
      }
      sendTipModal.open(song.name);
    },
    [sendTipModal, song.name, username],
  );

  const handleEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!isOwner) {
        toast.error('Only the original publisher can edit this song.');
        return;
      }

      const songMetaForEdit: SongMeta = {
        id: song.id,
        name: song.name,
        title: song.title || '',
        author: song.author,
        description: (song as any)?.description || '',
        created: (song as any)?.created || Date.now(),
        updated: (song as any)?.updated || Date.now(),
        status: song.status,
        service: song.service,
      };

      uploadModal.openSingleEdit(songMetaForEdit);
    },
    [isOwner, song, uploadModal],
  );

  const handleAddToPlaylist = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      addSongToPlaylistModal.onOpen({
        id: song.id,
        title: song.title,
        name: song.name,
        author: song.author,
        service: song.service,
        status: song.status,
      });
    },
    [addSongToPlaylistModal, song],
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <HomeActionButton
        onClick={(event) => {
          event.stopPropagation();
          handlePlay();
        }}
        title="Play"
        aria-label="Play"
      >
        <FaPlay size={14} />
      </HomeActionButton>

      <HomeActionButton
        onClick={handleToggleLike}
        title="Like It"
        aria-label="Like It"
        active={hasLike}
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
          handleAddToPlaylist(event);
        }}
        title="Add to Playlist"
        aria-label="Add to Playlist"
      >
        <MdPlaylistAdd size={16} />
      </HomeActionButton>

      <div
        onClick={(event) => event.stopPropagation()}
        className="flex items-center"
      >
        <LikeButton
          songId={song.id}
          name={song.name}
          service={song.service || 'AUDIO'}
          songData={favoriteSongData}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/50 text-sky-200/80 hover:bg-sky-800/60"
          activeClassName="bg-sky-800/80 text-white hover:bg-sky-700/80"
          inactiveClassName="bg-sky-900/50 text-sky-200/80 hover:bg-sky-800/60"
          iconSize={16}
          title="Add Favorites"
          ariaLabel="Add Favorites"
        />
      </div>

      <HomeActionButton
        onClick={handleDownload}
        title="Download"
        aria-label="Download"
      >
        <FiDownload size={16} />
      </HomeActionButton>

      <HomeActionButton
        onClick={handleCopyLink}
        title="Copy link & Share It"
        aria-label="Copy link & Share It"
      >
        <LuCopy size={16} />
      </HomeActionButton>

      <HomeActionButton
        onClick={handleTip}
        title="Send Tips to Publisher"
        aria-label="Send Tips to Publisher"
      >
        <RiHandCoinLine size={16} />
      </HomeActionButton>

      {isOwner && (
        <HomeActionButton
          onClick={handleEdit}
          title="Edit"
          aria-label="Edit"
        >
          <FiEdit2 size={16} />
        </HomeActionButton>
      )}
    </div>
  );
};

export default LibrarySongActions;
