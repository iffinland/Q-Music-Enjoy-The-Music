import React, { useCallback, useMemo, useState, useRef } from 'react';
import moment from 'moment';
import { FiDownload, FiEdit2, FiPlay, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { RiHandCoinLine } from 'react-icons/ri';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { Podcast, Song } from '../../types';
import { fetchPodcastLikeUsers } from '../../services/podcastLikes';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { useNavigate } from 'react-router-dom';
import { MdPlaylistAdd } from 'react-icons/md';

interface PodcastCardProps {
  podcast: Podcast;
  onPlay?: (podcast: Podcast) => void;
  onLike?: (podcast: Podcast) => void;
  onAddFavorite?: (podcast: Podcast) => void;
  onAddToPlaylist?: (songData: Song) => void;
  onDownload?: (podcast: Podcast) => void;
  onCopyLink?: (podcast: Podcast) => void;
  onSendTips?: (podcast: Podcast) => void;
  isHighlighted?: boolean;
  onEdit?: (podcast: Podcast) => void;
  isFavorite?: boolean;
  isLiked?: boolean;
  likeCount?: number;
}

const formatFileSize = (size?: number): string | null => {
  if (typeof size !== 'number' || size <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const displayValue =
    value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1);

  return `${displayValue} ${units[index]}`;
};

const formatPublishedLabel = (podcast: Podcast): string => {
  const baseTimestamp = podcast.updated ?? podcast.created;
  const sizeLabel = formatFileSize(podcast.size);

  const publishedPrefix = baseTimestamp
    ? `Published ${moment(baseTimestamp).format('MMM D, YYYY • HH:mm')}`
    : 'Published';

  const sizeSegment = sizeLabel ? ` | Size: ${sizeLabel}` : '';
  const hostName = podcast.author?.trim() || podcast.publisher;
  const publisherSegment = hostName
    ? ` | by ${hostName}`
    : '';

  return `${publishedPrefix}${sizeSegment}${publisherSegment}`;
};

const ActionIcon: React.FC<{
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  isActive?: boolean;
}> = ({ title, onClick, children, isActive = false }) => {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onClick?.();
    },
    [onClick],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
        isActive ? 'border-sky-400 bg-sky-800/80 text-white' : 'border-sky-800/80 bg-sky-900/40 text-sky-100'
      } transition hover:border-sky-500 hover:bg-sky-800/70 hover:text-white`}
      aria-label={title}
    >
      {children}
    </button>
  );
};

export const PodcastCard: React.FC<PodcastCardProps> = ({
  podcast,
  onPlay,
  onLike,
  onAddFavorite,
  onAddToPlaylist,
  onDownload,
  onCopyLink,
  onSendTips,
  isHighlighted = false,
  onEdit,
  isFavorite = false,
  isLiked = false,
  likeCount = 0,
}) => {
  const navigate = useNavigate();
  const description =
    podcast.description?.trim() ||
    'No description was provided for this podcast yet.';
  const coverImage =
    podcast.coverImage && podcast.coverImage.trim().length > 0
      ? podcast.coverImage
      : radioImg;
  const creatorDisplay = podcast.author?.trim() || podcast.publisher || 'Unknown host';
  const handleNavigate = useCallback(() => {
    if (!podcast.publisher || !podcast.id) return;
    navigate(`/podcasts/${encodeURIComponent(podcast.publisher)}/${encodeURIComponent(podcast.id)}`);
  }, [navigate, podcast.publisher, podcast.id]);
  const playlistSongData = useMemo<Song>(() => ({
    id: podcast.id,
    title: podcast.title,
    name: podcast.publisher,
    author: creatorDisplay,
    service: podcast.service || 'PODCAST',
    status: podcast.status,
  }), [creatorDisplay, podcast.id, podcast.publisher, podcast.service, podcast.status, podcast.title]);

  const [isLikePopoverOpen, setIsLikePopoverOpen] = useState(false);
  const [likeUsers, setLikeUsers] = useState<string[]>([]);
  const [isLoadingLikeUsers, setIsLoadingLikeUsers] = useState(false);
  const likeUsersLoadedRef = useRef(false);

  const handleLikePopover = useCallback(
    (open: boolean) => {
      setIsLikePopoverOpen(open);
      if (open && !likeUsersLoadedRef.current) {
        setIsLoadingLikeUsers(true);
        fetchPodcastLikeUsers(podcast.id)
          .then((users) => {
            setLikeUsers(users);
            likeUsersLoadedRef.current = true;
          })
          .catch(() => {
            setLikeUsers([]);
          })
          .finally(() => {
            setIsLoadingLikeUsers(false);
          });
      }
    },
    [podcast.id],
  );

  return (
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
      className={`flex flex-col gap-4 rounded-xl border bg-sky-950/50 p-5 shadow-sm transition md:flex-row md:items-start md:gap-6 cursor-pointer ${
        isHighlighted
          ? 'border-sky-400/80 bg-sky-900/60 shadow-sky-500/30'
          : 'border-sky-900/60 hover:border-sky-700/70 hover:bg-sky-950/70'
      }`}
    >
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-start">
        <div className="flex-shrink-0 overflow-hidden rounded-xl border border-sky-900/60 bg-sky-900/40 shadow-inner">
          <img
            src={coverImage}
            alt={`Cover art for ${podcast.title}`}
            className="h-28 w-28 object-cover md:h-32 md:w-32"
            loading="lazy"
          />
        </div>
        <div className="flex flex-1 flex-col justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-white md:text-xl">{podcast.title}</h3>
            <p className="mt-1 text-xs font-medium text-sky-300">
              {formatPublishedLabel(podcast)}
            </p>
          </div>
          <div className="text-sm text-sky-200/90 md:text-base">
            <p
              className="max-w-3xl overflow-hidden text-ellipsis"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:w-40 md:justify-items-center">
        <ActionIcon title="Play" onClick={() => onPlay?.(podcast)}>
          <FiPlay size={16} />
        </ActionIcon>
        <div
          className="relative"
          onMouseEnter={() => handleLikePopover(true)}
          onMouseLeave={() => handleLikePopover(false)}
          onFocusCapture={() => handleLikePopover(true)}
          onBlurCapture={() => handleLikePopover(false)}
        >
          <ActionIcon
            title="Like It"
            onClick={() => onLike?.(podcast)}
            isActive={isLiked}
          >
            <div className="flex items-center gap-1">
              <FiThumbsUp size={16} />
              <span className="text-[10px] font-semibold text-white">{likeCount}</span>
            </div>
          </ActionIcon>
          {isLikePopoverOpen && (
            <div className="absolute left-1/2 z-20 mt-2 w-48 -translate-x-1/2 rounded-lg border border-sky-800/60 bg-sky-950/95 p-3 text-left shadow-xl">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                Liked by
              </p>
              {isLoadingLikeUsers ? (
                <p className="text-xs text-sky-200/80">Loading…</p>
              ) : likeUsers.length === 0 ? (
                <p className="text-xs text-sky-200/80">No likes yet.</p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-sky-100">
                  {likeUsers.map((user) => (
                    <li key={user}>@{user}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <ActionIcon
          title="Add Favorites"
          onClick={() => onAddFavorite?.(podcast)}
          isActive={isFavorite}
        >
          {isFavorite ? <AiFillHeart size={16} /> : <AiOutlineHeart size={16} />}
        </ActionIcon>
        {onAddToPlaylist && (
          <ActionIcon title="Add to Playlist" onClick={() => onAddToPlaylist?.(playlistSongData)}>
            <MdPlaylistAdd size={18} />
          </ActionIcon>
        )}
        <ActionIcon
          title="Download"
          onClick={() => onDownload?.(podcast)}
        >
          <FiDownload size={16} />
        </ActionIcon>
        <ActionIcon
          title="Copy link & Share It"
          onClick={() => onCopyLink?.(podcast)}
        >
          <FiShare2 size={16} />
        </ActionIcon>
        <ActionIcon
          title="Send Tips to Publisher"
          onClick={() => onSendTips?.(podcast)}
        >
          <RiHandCoinLine size={16} />
        </ActionIcon>
        {onEdit && (
          <ActionIcon title="Edit" onClick={() => onEdit?.(podcast)}>
            <FiEdit2 />
          </ActionIcon>
        )}
      </div>
    </div>
  );
};
