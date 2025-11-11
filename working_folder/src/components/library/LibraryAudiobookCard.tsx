import {
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { FaPlay } from 'react-icons/fa';
import {
  FiDownload,
  FiEdit2,
  FiShare2,
  FiThumbsUp,
} from 'react-icons/fi';
import { MdPlaylistAdd } from 'react-icons/md';
import { RiHandCoinLine } from 'react-icons/ri';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { toast } from 'react-hot-toast';

import HomeActionButton from '../home/HomeActionButton';
import { Audiobook, Song } from '../../types';
import { MyContext } from '../../wrappers/DownloadWrapper';
import {
  setAddToDownloads,
  setCurrentSong,
} from '../../state/features/globalSlice';
import { RootState } from '../../state/store';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildAudiobookShareUrl } from '../../utils/qortalLinks';
import useSendTipModal from '../../hooks/useSendTipModal';
import useUploadAudiobookModal from '../../hooks/useUploadAudiobookModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import {
  fetchAudiobookLikeCount,
  fetchAudiobookLikeUsers,
  hasUserLikedAudiobook,
  likeAudiobook as publishAudiobookLike,
  unlikeAudiobook,
} from '../../services/audiobookLikes';
import radioImg from '../../assets/img/enjoy-music.jpg';

const audiobookFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-audiobook-favorites',
});

interface LibraryAudiobookCardProps {
  audiobook: Audiobook;
  onFavoriteChange?: () => void;
}

export const LibraryAudiobookCard: React.FC<LibraryAudiobookCardProps> = ({
  audiobook,
  onFavoriteChange,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const sendTipModal = useSendTipModal();
  const uploadAudiobookModal = useUploadAudiobookModal();
  const addSongToPlaylistModal = useAddSongToPlaylistModal();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [likeBusy, setLikeBusy] = useState<boolean>(false);
  const [favoriteBusy, setFavoriteBusy] = useState<boolean>(false);
  const [playBusy, setPlayBusy] = useState<boolean>(false);
  const [likeUsers, setLikeUsers] = useState<string[]>([]);
  const [likeUsersLoading, setLikeUsersLoading] = useState(false);
  const [isLikePopoverOpen, setIsLikePopoverOpen] = useState(false);
  const likeUsersLoadedRef = useRef(false);

  const coverImage = audiobook.coverImage || radioImg;
  const creatorDisplay = audiobook.author?.trim() || audiobook.publisher || 'Unknown narrator';
  const isOwner = useMemo(() => {
    if (!username || !audiobook.publisher) return false;
    return username.toLowerCase() === audiobook.publisher.toLowerCase();
  }, [audiobook.publisher, username]);

  const handleLikePopover = useCallback(
    (open: boolean) => {
      setIsLikePopoverOpen(open);
      if (open && !likeUsersLoadedRef.current) {
        setLikeUsersLoading(true);
        fetchAudiobookLikeUsers(audiobook.id)
          .then((users) => {
            setLikeUsers(users);
            likeUsersLoadedRef.current = true;
          })
          .catch(() => {
            setLikeUsers([]);
          })
          .finally(() => {
            setLikeUsersLoading(false);
          });
      }
    },
    [audiobook.id],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchAudiobookLikeCount(audiobook.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLiked(false);
      } else {
        try {
          const liked = await hasUserLikedAudiobook(username, audiobook.id);
          if (!cancelled) setHasLiked(liked);
        } catch (error) {
          if (!cancelled) setHasLiked(false);
        }
      }

      try {
        const existing =
          (await audiobookFavoritesStorage.getItem<string[]>('favorites')) || [];
        if (!cancelled) {
          setIsFavorite(existing.includes(audiobook.id));
        }
      } catch (error) {
        if (!cancelled) setIsFavorite(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [audiobook.id, username]);

  const handleNavigate = useCallback(() => {
    if (!audiobook.publisher || !audiobook.id) return;
    navigate(
      `/audiobooks/${encodeURIComponent(audiobook.publisher)}/${encodeURIComponent(
        audiobook.id,
      )}`,
    );
  }, [navigate, audiobook.id, audiobook.publisher]);

  const handlePlay = useCallback(
    async (event?: MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      if (playBusy) return;

      try {
        setPlayBusy(true);
        const existingDownload = downloads[audiobook.id];
        const isReady =
          existingDownload?.status?.status === 'READY' ||
          audiobook.status?.status === 'READY';

        if (isReady) {
          const resolvedUrl =
            existingDownload?.url ||
            (await getQdnResourceUrl('AUDIO', audiobook.publisher, audiobook.id));

        dispatch(
          setAddToDownloads({
            name: audiobook.publisher,
            service: 'AUDIO',
            id: audiobook.id,
            identifier: audiobook.id,
            url: resolvedUrl ?? undefined,
            status: audiobook.status,
            title: audiobook.title || '',
            author: creatorDisplay,
          }),
        );
      } else {
        toast.success('Fetching the audiobook. Playback will start shortly.');
        downloadVideo({
          name: audiobook.publisher,
          service: 'AUDIO',
          identifier: audiobook.id,
          title: audiobook.title || '',
          author: creatorDisplay,
          id: audiobook.id,
        });
      }

        dispatch(setCurrentSong(audiobook.id));
      } catch (error) {
        toast.error('Could not start the audiobook.');
      } finally {
        setPlayBusy(false);
      }
    },
    [creatorDisplay, dispatch, downloadVideo, downloads, playBusy, audiobook],
  );

  const handleToggleLike = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to like audiobooks.');
        return;
      }
      if (likeBusy) return;

      try {
        setLikeBusy(true);
        if (hasLiked) {
          await unlikeAudiobook(username, audiobook.id);
          setHasLiked(false);
          setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        } else {
          await publishAudiobookLike(username, audiobook);
          setHasLiked(true);
          setLikeCount((prev) => (prev ?? 0) + 1);
        }
      } catch (error) {
        toast.error('Unable to update like right now.');
      } finally {
        setLikeBusy(false);
      }
    },
    [hasLiked, likeBusy, audiobook, username],
  );

  const handleToggleFavorite = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (favoriteBusy) return;
      try {
        setFavoriteBusy(true);
        const favorites =
          (await audiobookFavoritesStorage.getItem<string[]>('favorites')) || [];

        if (isFavorite) {
          const updated = favorites.filter((id) => id !== audiobook.id);
          await audiobookFavoritesStorage.setItem('favorites', updated);
          setIsFavorite(false);
          toast.success('Audiobook removed from favorites.');
        } else {
          const updated = Array.from(new Set([audiobook.id, ...favorites]));
          await audiobookFavoritesStorage.setItem('favorites', updated);
          setIsFavorite(true);
          toast.success('Audiobook added to favorites!');
        }

        onFavoriteChange?.();
      } catch (error) {
        toast.error('Could not update favorites.');
      } finally {
        setFavoriteBusy(false);
      }
    },
    [favoriteBusy, isFavorite, onFavoriteChange, audiobook.id],
  );

  const handleDownload = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const directUrl = await getQdnResourceUrl(
          'AUDIO',
          audiobook.publisher,
          audiobook.id,
        );

        if (!directUrl) {
          toast.error('Audiobook download not available yet.');
          return;
        }

        const anchor = document.createElement('a');
        anchor.href = directUrl;
        anchor.download =
          audiobook.audioFilename ||
          `${audiobook.title?.replace(/\s+/g, '_') || audiobook.id}.audio`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        dispatch(
          setAddToDownloads({
            name: audiobook.publisher,
            service: 'AUDIO',
            id: audiobook.id,
            identifier: audiobook.id,
            url: directUrl,
            status: audiobook.status,
            title: audiobook.title || '',
            author: creatorDisplay,
          }),
        );
        toast.success('Audiobook download started.');
      } catch (error) {
        toast.error('Failed to download audiobook.');
      }
    },
    [creatorDisplay, dispatch, audiobook],
  );

  const handleCopyLink = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const link = buildAudiobookShareUrl(
          audiobook.publisher,
          audiobook.id,
        );
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
    [audiobook.id, audiobook.publisher],
  );

  const handleSendTip = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }
      if (!audiobook.publisher) {
        toast.error('Audiobook publisher missing.');
        return;
      }
      sendTipModal.open(audiobook.publisher);
    },
    [audiobook.publisher, sendTipModal, username],
  );

  const handleEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!isOwner) {
        toast.error('Only the original publisher can edit this audiobook.');
        return;
      }
      uploadAudiobookModal.openEdit(audiobook);
    },
    [isOwner, audiobook, uploadAudiobookModal],
  );

  const handleAddToPlaylist = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const songData: Song = {
        id: audiobook.id,
        title: audiobook.title,
        name: audiobook.publisher,
        author: creatorDisplay,
        service: audiobook.service || 'AUDIO',
        status: audiobook.status,
      };
      addSongToPlaylistModal.onOpen(songData);
    },
    [addSongToPlaylistModal, audiobook, creatorDisplay],
  );

  return (
    <div className="rounded-xl border border-sky-900/60 bg-sky-950/60 p-4 transition hover:border-sky-700/70 hover:bg-sky-950/80">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div
          role="button"
          tabIndex={0}
          onClick={handleNavigate}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleNavigate();
            }
          }}
          className="flex flex-1 flex-col gap-3 cursor-pointer"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div className="flex-shrink-0 overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40 shadow-inner">
              <img
                src={coverImage}
                alt={audiobook.title || 'Audiobook cover'}
                className="h-32 w-32 object-cover md:h-36 md:w-36"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-white md:text-xl">
                  {audiobook.title || 'Untitled audiobook'}
                </h3>
                <span className="text-xs uppercase tracking-wide text-sky-300/80">
                  {formatTimestamp(audiobook.updated ?? audiobook.created)}
                </span>
              </div>
              <p className="text-xs text-sky-400/80">
                {`Published by ${creatorDisplay}`}
                {audiobook.category ? ` • ${audiobook.category}` : ''}
              </p>
              {audiobook.description && (
                <p
                  className="text-sm text-sky-200/85"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {audiobook.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 md:w-72">
          <HomeActionButton
            onClick={(event) => handlePlay(event)}
            title="Play"
            aria-label="Play"
            disabled={playBusy}
          >
            <FaPlay size={14} />
          </HomeActionButton>

          <div
            className="relative"
            onMouseEnter={() => handleLikePopover(true)}
            onMouseLeave={() => handleLikePopover(false)}
            onFocusCapture={() => handleLikePopover(true)}
            onBlurCapture={() => handleLikePopover(false)}
          >
            <HomeActionButton
              onClick={handleToggleLike}
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
            {isLikePopoverOpen && (
              <div className="absolute right-1/2 top-full z-30 mt-2 w-44 translate-x-1/2 rounded-lg border border-sky-800/60 bg-sky-950/95 p-3 text-left shadow-xl">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                  Liked by
                </p>
                {likeUsersLoading ? (
                  <p className="text-xs text-sky-200/80">Loading…</p>
                ) : likeUsers.length === 0 ? (
                  <p className="text-xs text-sky-200/80">No likes yet.</p>
                ) : (
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-sky-100">
                    {likeUsers.map((user) => (
                      <li key={user}>@{user}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <HomeActionButton
            onClick={handleAddToPlaylist}
            title="Add to Playlist"
            aria-label="Add to Playlist"
          >
            <MdPlaylistAdd size={16} />
          </HomeActionButton>

          <HomeActionButton
            onClick={handleToggleFavorite}
            title="Add Favorites"
            aria-label="Add Favorites"
            active={isFavorite}
            disabled={favoriteBusy}
          >
          {isFavorite ? <AiFillHeart size={16} /> : <AiOutlineHeart size={16} />}
          </HomeActionButton>

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
            <FiShare2 size={16} />
          </HomeActionButton>

          <HomeActionButton
            onClick={handleSendTip}
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
      </div>
    </div>
  );
};

const formatTimestamp = (value?: number): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

export default LibraryAudiobookCard;
