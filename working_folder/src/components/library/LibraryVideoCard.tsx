import {
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
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
import { useNavigate } from 'react-router-dom';

import HomeActionButton from '../home/HomeActionButton';
import { Video, Song } from '../../types';
import { RootState } from '../../state/store';
import { MyContext } from '../../wrappers/DownloadWrapper';
import useSendTipModal from '../../hooks/useSendTipModal';
import useUploadVideoModal from '../../hooks/useUploadVideoModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { buildVideoShareUrl } from '../../utils/qortalLinks';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import {
  fetchVideoLikeCount,
  hasUserLikedVideo,
  likeVideo,
  unlikeVideo,
} from '../../services/videoLikes';

const videoFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-video-favorites',
});

interface LibraryVideoCardProps {
  video: Video;
  onPlay: (video: Video) => void;
  onFavoriteChange?: () => void;
}

export const LibraryVideoCard: React.FC<LibraryVideoCardProps> = ({
  video,
  onPlay,
  onFavoriteChange,
}) => {
  const { downloadVideo } = useContext(MyContext);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const sendTipModal = useSendTipModal();
  const uploadVideoModal = useUploadVideoModal();
  const addSongToPlaylistModal = useAddSongToPlaylistModal();
  const navigate = useNavigate();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [likeBusy, setLikeBusy] = useState<boolean>(false);
  const [favoriteBusy, setFavoriteBusy] = useState<boolean>(false);

  const coverImage = video.coverImage || radioImg;
  const isOwner = useMemo(() => {
    if (!username || !video.publisher) return false;
    return username.toLowerCase() === video.publisher.toLowerCase();
  }, [username, video.publisher]);

  const handleNavigate = useCallback(() => {
    if (!video.publisher || !video.id) return;
    navigate(
      `/videos/${encodeURIComponent(video.publisher)}/${encodeURIComponent(video.id)}`,
    );
  }, [navigate, video.id, video.publisher]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchVideoLikeCount(video.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLiked(false);
      } else {
        try {
          const liked = await hasUserLikedVideo(username, video.id);
          if (!cancelled) setHasLiked(liked);
        } catch (error) {
          if (!cancelled) setHasLiked(false);
        }
      }

      try {
        const existing =
          (await videoFavoritesStorage.getItem<string[]>('favorites')) || [];
        if (!cancelled) setIsFavorite(existing.includes(video.id));
      } catch (error) {
        if (!cancelled) setIsFavorite(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [username, video.id]);

  const handleToggleLike = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to like videos.');
        return;
      }
      if (likeBusy) return;

      try {
        setLikeBusy(true);
        if (hasLiked) {
          await unlikeVideo(username, video.id);
          setHasLiked(false);
          setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        } else {
          await likeVideo(username, video);
          setHasLiked(true);
          setLikeCount((prev) => (prev ?? 0) + 1);
        }
      } catch (error) {
        toast.error('Unable to update like right now.');
      } finally {
        setLikeBusy(false);
      }
    },
    [hasLiked, likeBusy, username, video],
  );

  const handleToggleFavorite = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (favoriteBusy) return;

      try {
        setFavoriteBusy(true);
        const existing =
          (await videoFavoritesStorage.getItem<string[]>('favorites')) || [];

        if (isFavorite) {
          const updated = existing.filter((id) => id !== video.id);
          await videoFavoritesStorage.setItem('favorites', updated);
          setIsFavorite(false);
          toast.success('Video removed from favorites.');
        } else {
          const updated = Array.from(new Set([video.id, ...existing]));
          await videoFavoritesStorage.setItem('favorites', updated);
          setIsFavorite(true);
          toast.success('Video added to favorites!');
        }

        onFavoriteChange?.();
      } catch (error) {
        toast.error('Could not update favorites.');
      } finally {
        setFavoriteBusy(false);
      }
    },
    [favoriteBusy, isFavorite, onFavoriteChange, video.id],
  );

  const handleDownload = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const directUrl = await getQdnResourceUrl(
          'VIDEO',
          video.publisher,
          video.id,
        );

        if (!directUrl) {
          toast.error('Video download not available yet.');
          return;
        }

        const anchor = document.createElement('a');
        anchor.href = directUrl;
        anchor.download =
          video.videoFilename ||
          `${video.title?.replace(/\s+/g, '_') || video.id}.mp4`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success('Video download started.');
      } catch (error) {
        toast.error('Failed to download video.');
      }
    },
    [video],
  );

  const handleCopyLink = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      try {
        const link = buildVideoShareUrl(video.publisher, video.id);
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
    [video.id, video.publisher],
  );

  const handleSendTip = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }
      if (!video.publisher) {
        toast.error('Video publisher missing.');
        return;
      }
      sendTipModal.open(video.publisher);
    },
    [sendTipModal, username, video.publisher],
  );

  const handleEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!isOwner) {
        toast.error('Only the original publisher can edit this video.');
        return;
      }
      uploadVideoModal.openEdit(video);
    },
    [isOwner, uploadVideoModal, video],
  );

  const handleAddToPlaylist = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const songData: Song = {
        id: video.id,
        title: video.title,
        name: video.publisher,
        author: video.author || video.publisher,
        service: video.service || 'VIDEO',
        status: video.status,
      };
      addSongToPlaylistModal.onOpen(songData);
    },
    [addSongToPlaylistModal, video],
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
                alt={video.title || 'Video cover'}
                className="h-32 w-56 object-cover md:h-36 md:w-60"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-white md:text-xl">
                  {video.title || 'Untitled video'}
                </h3>
                <span className="text-xs uppercase tracking-wide text-sky-300/80">
                  {formatTimestamp(video.updated ?? video.created)}
                </span>
              </div>
              <p className="text-xs text-sky-400/80">
                {video.publisher
                  ? `Published by ${video.publisher}`
                  : 'Publisher unknown'}
              </p>
              {video.description && (
                <p
                  className="text-sm text-sky-200/85"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {video.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 md:w-72">
          <HomeActionButton
            onClick={(event) => {
              event.stopPropagation();
              onPlay(video);
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

export default LibraryVideoCard;
