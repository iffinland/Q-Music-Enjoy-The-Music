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
import { FiDownload, FiEdit2, FiShare2, FiThumbsUp, FiTrash2 } from 'react-icons/fi';
import { MdPlaylistAdd } from 'react-icons/md';
import { RiHandCoinLine } from 'react-icons/ri';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { toast } from 'react-hot-toast';

import HomeActionButton from '../home/HomeActionButton';
import { Podcast, Song } from '../../types';
import { MyContext } from '../../wrappers/DownloadWrapper';
import {
  setAddToDownloads,
  setCurrentSong,
} from '../../state/features/globalSlice';
import { RootState } from '../../state/store';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { resolveAudioUrl } from '../../utils/resolveAudioUrl';
import { buildPodcastShareUrl } from '../../utils/qortalLinks';
import useSendTipModal from '../../hooks/useSendTipModal';
import useUploadPodcastModal from '../../hooks/useUploadPodcastModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import {
  fetchPodcastLikeCount,
  fetchPodcastLikeUsers,
  hasUserLikedPodcast,
  likePodcast as publishPodcastLike,
  unlikePodcast,
} from '../../services/podcastLikes';
import { deletePodcastResources } from '../../services/podcasts';
import radioImg from '../../assets/img/enjoy-music.jpg';
import useCoverImage from '../../hooks/useCoverImage';
import { buildDownloadFilename } from '../../utils/downloadFilename';

const podcastFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-podcast-favorites',
});

interface LibraryPodcastCardProps {
  podcast: Podcast;
  onFavoriteChange?: () => void;
  showDeleteButton?: boolean;
  onDeleted?: (podcastId: string) => void;
}

export const LibraryPodcastCard: React.FC<LibraryPodcastCardProps> = ({
  podcast,
  onFavoriteChange,
  showDeleteButton = false,
  onDeleted,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const sendTipModal = useSendTipModal();
  const uploadPodcastModal = useUploadPodcastModal();
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
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { url: coverUrl } = useCoverImage({
    identifier: podcast?.id ?? null,
    publisher: podcast?.publisher ?? null,
    enabled: Boolean(podcast?.id && podcast?.publisher),
  });
  const coverImage = podcast.coverImage || coverUrl || radioImg;
  const creatorDisplay = podcast.author?.trim() || podcast.publisher || 'Unknown host';
  const isOwner = useMemo(() => {
    if (!username || !podcast.publisher) return false;
    return username.toLowerCase() === podcast.publisher.toLowerCase();
  }, [podcast.publisher, username]);

  const handleLikePopover = useCallback(
    (open: boolean) => {
      setIsLikePopoverOpen(open);
      if (open && !likeUsersLoadedRef.current) {
        setLikeUsersLoading(true);
        fetchPodcastLikeUsers(podcast.id)
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
    [podcast.id],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchPodcastLikeCount(podcast.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLiked(false);
      } else {
        try {
          const liked = await hasUserLikedPodcast(username, podcast.id);
          if (!cancelled) setHasLiked(liked);
        } catch (error) {
          if (!cancelled) setHasLiked(false);
        }
      }

      try {
        const existing =
          (await podcastFavoritesStorage.getItem<string[]>('favorites')) || [];
        if (!cancelled) {
          setIsFavorite(existing.includes(podcast.id));
        }
      } catch (error) {
        if (!cancelled) setIsFavorite(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [podcast.id, username]);

  const handleNavigate = useCallback(() => {
    if (!podcast.publisher || !podcast.id) return;
    navigate(
      `/podcasts/${encodeURIComponent(podcast.publisher)}/${encodeURIComponent(
        podcast.id,
      )}`,
    );
  }, [navigate, podcast.id, podcast.publisher]);

  const handlePlay = useCallback(
    async (event?: MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      if (playBusy) return;

      try {
        setPlayBusy(true);
        const existingDownload = downloads[podcast.id];
        const isReady =
          existingDownload?.status?.status === 'READY' ||
          podcast.status?.status === 'READY';
        const readyStatus =
          existingDownload?.status?.status === 'READY' || podcast.status?.status === 'READY'
            ? existingDownload?.status || podcast.status
            : null;

        if (isReady) {
          const resolvedUrl =
            existingDownload?.url ||
            (await resolveAudioUrl(podcast.publisher, podcast.id));

          if (!resolvedUrl) {
            toast.success('Fetching the podcast. Playback will start shortly.');
            downloadVideo({
              name: podcast.publisher,
              service: 'AUDIO',
              identifier: podcast.id,
              title: podcast.title || '',
              author: creatorDisplay,
              id: podcast.id,
              mediaType: 'PODCAST',
            });
            dispatch(setCurrentSong(podcast.id));
            return;
          }

          dispatch(
            setAddToDownloads({
              name: podcast.publisher,
              service: 'AUDIO',
              id: podcast.id,
              identifier: podcast.id,
              url: resolvedUrl,
              status:
                readyStatus ??
                { ...(podcast.status ?? {}), status: 'READY', percentLoaded: 100 },
              title: podcast.title || '',
              author: creatorDisplay,
              mediaType: 'PODCAST',
            }),
          );
      } else {
        toast.success('Fetching the podcast. Playback will start shortly.');
        downloadVideo({
          name: podcast.publisher,
          service: 'AUDIO',
          identifier: podcast.id,
          title: podcast.title || '',
          author: creatorDisplay,
          id: podcast.id,
          mediaType: 'PODCAST',
        });
      }

        dispatch(setCurrentSong(podcast.id));
      } catch (error) {
        toast.error('Could not start the podcast.');
      } finally {
        setPlayBusy(false);
      }
    },
    [creatorDisplay, dispatch, downloadVideo, downloads, playBusy, podcast],
  );

  const handleToggleLike = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to like podcasts.');
        return;
      }
      if (likeBusy) return;

      try {
        setLikeBusy(true);
        if (hasLiked) {
          await unlikePodcast(username, podcast.id);
          setHasLiked(false);
          setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        } else {
          await publishPodcastLike(username, podcast);
          setHasLiked(true);
          setLikeCount((prev) => (prev ?? 0) + 1);
        }
      } catch (error) {
        toast.error('Unable to update like right now.');
      } finally {
        setLikeBusy(false);
      }
    },
    [hasLiked, likeBusy, podcast, username],
  );

  const handleToggleFavorite = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (favoriteBusy) return;
      try {
        setFavoriteBusy(true);
        const favorites =
          (await podcastFavoritesStorage.getItem<string[]>('favorites')) || [];

        if (isFavorite) {
          const updated = favorites.filter((id) => id !== podcast.id);
          await podcastFavoritesStorage.setItem('favorites', updated);
          setIsFavorite(false);
          toast.success('Podcast removed from favorites.');
        } else {
          const updated = Array.from(new Set([podcast.id, ...favorites]));
          await podcastFavoritesStorage.setItem('favorites', updated);
          setIsFavorite(true);
          toast.success('Podcast added to favorites!');
        }

        onFavoriteChange?.();
      } catch (error) {
        toast.error('Could not update favorites.');
      } finally {
        setFavoriteBusy(false);
      }
    },
    [favoriteBusy, isFavorite, onFavoriteChange, podcast.id],
  );

  const handleDownload = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const existingDownload = downloads[podcast.id];
        const directUrl = await getQdnResourceUrl(
          'AUDIO',
          podcast.publisher,
          podcast.id,
        );

        if (!directUrl) {
          toast.error('Podcast download not available yet.');
          return;
        }

        const anchor = document.createElement('a');
        anchor.href = directUrl;
        anchor.download = buildDownloadFilename({
          preferredFilename: podcast.audioFilename,
          title: podcast.title,
          fallbackId: podcast.id,
          resolvedUrl: directUrl,
          mimeType: podcast.audioMimeType,
        });
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        dispatch(
          setAddToDownloads({
            name: podcast.publisher,
            service: 'AUDIO',
            id: podcast.id,
            identifier: podcast.id,
            url: directUrl,
            status:
              directUrl && (podcast.status?.status === 'READY' || existingDownload?.status?.status === 'READY')
                ? existingDownload?.status || podcast.status
                : directUrl
                ? { ...(podcast.status ?? {}), status: 'READY', percentLoaded: 100 }
                : podcast.status,
            title: podcast.title || '',
            mediaType: 'PODCAST',
            author: creatorDisplay,
          }),
        );
        toast.success('Podcast download started.');
      } catch (error) {
        toast.error('Failed to download podcast.');
      }
    },
    [creatorDisplay, dispatch, podcast],
  );

  const handleCopyLink = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const link = buildPodcastShareUrl(
          podcast.publisher,
          podcast.id,
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
    [podcast.id, podcast.publisher],
  );

  const handleSendTip = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }
      if (!podcast.publisher) {
        toast.error('Podcast publisher missing.');
        return;
      }
      sendTipModal.open(podcast.publisher);
    },
    [podcast.publisher, sendTipModal, username],
  );

  const handleEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!isOwner) {
        toast.error('Only the original publisher can edit this podcast.');
        return;
      }
      uploadPodcastModal.openEdit(podcast);
    },
    [isOwner, podcast, uploadPodcastModal],
  );

  const handleAddToPlaylist = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const songData: Song = {
        id: podcast.id,
        title: podcast.title,
        name: podcast.publisher,
        author: creatorDisplay,
        service: podcast.service || 'AUDIO',
        status: podcast.status,
      };
      addSongToPlaylistModal.onOpen(songData);
    },
    [addSongToPlaylistModal, creatorDisplay, podcast],
  );

  const handleDelete = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!showDeleteButton) {
        toast.error('Deletion not available here.');
        return;
      }
      if (!isOwner || !podcast.publisher) {
        toast.error('Only the original publisher can delete this podcast.');
        return;
      }
      const confirmed = window.confirm('Delete this podcast? This cannot be undone.');
      if (!confirmed) return;

      try {
        setDeleteBusy(true);
        await deletePodcastResources(podcast.publisher, podcast.id);
        toast.success('Podcast deleted.');
        onDeleted?.(podcast.id);
        window.dispatchEvent(new CustomEvent('podcasts:refresh'));
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete podcast.');
      } finally {
        setDeleteBusy(false);
      }
    },
    [isOwner, onDeleted, podcast.id, podcast.publisher, showDeleteButton],
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
                alt={podcast.title || 'Podcast cover'}
                className="h-32 w-32 object-cover md:h-36 md:w-36"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-white md:text-xl">
                  {podcast.title || 'Untitled podcast'}
                </h3>
                <span className="text-xs uppercase tracking-wide text-sky-300/80">
                  {formatTimestamp(podcast.updated ?? podcast.created)}
                </span>
              </div>
              <p className="text-xs text-sky-400/80">
                {`Published by ${creatorDisplay}`}
                {podcast.category ? ` • ${podcast.category}` : ''}
              </p>
              {podcast.description && (
                <p
                  className="text-sm text-sky-200/85"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {podcast.description}
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
          {isOwner && showDeleteButton && (
            <HomeActionButton
              onClick={handleDelete}
              title="Delete"
              aria-label="Delete"
              disabled={deleteBusy}
            >
              <FiTrash2 size={16} />
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

export default LibraryPodcastCard;
