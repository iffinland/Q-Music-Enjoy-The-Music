import React, { useCallback } from 'react';
import moment from 'moment';
import { FiDownload, FiEdit2, FiPlay, FiShare2, FiStar, FiThumbsUp, FiTrash2 } from 'react-icons/fi';
import { RiHandCoinLine } from 'react-icons/ri';
import { Podcast } from '../../types';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { useNavigate } from 'react-router-dom';

interface PodcastCardProps {
  podcast: Podcast;
  onPlay?: (podcast: Podcast) => void;
  onLike?: (podcast: Podcast) => void;
  onAddFavorite?: (podcast: Podcast) => void;
  onDownload?: (podcast: Podcast) => void;
  onCopyLink?: (podcast: Podcast) => void;
  onSendTips?: (podcast: Podcast) => void;
  isHighlighted?: boolean;
  onDelete?: (podcast: Podcast) => void;
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
  const publisherSegment = podcast.publisher
    ? ` | by ${podcast.publisher}`
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
  onDownload,
  onCopyLink,
  onSendTips,
  isHighlighted = false,
  onDelete,
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
  const handleNavigate = useCallback(() => {
    if (!podcast.publisher || !podcast.id) return;
    navigate(`/podcasts/${encodeURIComponent(podcast.publisher)}/${encodeURIComponent(podcast.id)}`);
  }, [navigate, podcast.publisher, podcast.id]);

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
        <ActionIcon title="Play this podcast" onClick={() => onPlay?.(podcast)}>
          <FiPlay size={16} />
        </ActionIcon>
        <ActionIcon
          title="Like this podcast"
          onClick={() => onLike?.(podcast)}
          isActive={isLiked}
        >
          <div className="flex items-center gap-1">
            <FiThumbsUp size={16} />
            <span className="text-[10px] font-semibold text-white">{likeCount}</span>
          </div>
        </ActionIcon>
        <ActionIcon
          title="Add to favorites"
          onClick={() => onAddFavorite?.(podcast)}
          isActive={isFavorite}
        >
          <FiStar size={16} />
        </ActionIcon>
        <ActionIcon
          title="Download this podcast"
          onClick={() => onDownload?.(podcast)}
        >
          <FiDownload size={16} />
        </ActionIcon>
        <ActionIcon
          title="Share this podcast"
          onClick={() => onCopyLink?.(podcast)}
        >
          <FiShare2 size={16} />
        </ActionIcon>
        <ActionIcon
          title="Send tips to the creator"
          onClick={() => onSendTips?.(podcast)}
        >
          <RiHandCoinLine size={16} />
        </ActionIcon>
        {onEdit && (
          <ActionIcon title="Edit podcast" onClick={() => onEdit?.(podcast)}>
            <FiEdit2 />
          </ActionIcon>
        )}
        {onDelete && (
          <ActionIcon title="Delete podcast" onClick={() => onDelete?.(podcast)}>
            <FiTrash2 />
          </ActionIcon>
        )}
      </div>
    </div>
  );
};
