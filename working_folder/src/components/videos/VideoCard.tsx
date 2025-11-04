import React, { useCallback, useMemo } from 'react';
import moment from 'moment';
import {
  FiDownload,
  FiEdit2,
  FiPlay,
  FiShare2,
  FiThumbsUp,
} from 'react-icons/fi';
import { RiHandCoinLine } from 'react-icons/ri';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { Song, Video } from '../../types';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { useNavigate } from 'react-router-dom';
import { MdPlaylistAdd } from 'react-icons/md';

interface VideoCardProps {
  video: Video;
  onPlay?: (video: Video) => void;
  onLike?: (video: Video) => void;
  onAddFavorite?: (video: Video) => void;
  onAddToPlaylist?: (songData: Song) => void;
  onDownload?: (video: Video) => void;
  onCopyLink?: (video: Video) => void;
  onSendTips?: (video: Video) => void;
  onEdit?: (video: Video) => void;
  isFavorite?: boolean;
  isLiked?: boolean;
  likeCount?: number;
}

const formatPublishedLabel = (video: Video): string => {
  if (!video.created && !video.updated) {
    return `Published by ${video.publisher}`;
  }

  const baseTimestamp = video.updated ?? video.created;
  if (!baseTimestamp) {
    return `Published by ${video.publisher}`;
  }

  return `Published ${moment(baseTimestamp).format('MMM D, YYYY • HH:mm')} by ${video.publisher}`;
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

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onPlay,
  onLike,
  onAddFavorite,
  onAddToPlaylist,
  onDownload,
  onCopyLink,
  onSendTips,
  onEdit,
  isFavorite = false,
  isLiked = false,
  likeCount = 0,
}) => {
  const navigate = useNavigate();
  const coverImage =
    video.coverImage && video.coverImage.trim().length > 0
      ? video.coverImage
      : radioImg;
  const handleNavigate = useCallback(() => {
    if (!video.publisher || !video.id) return;
    navigate(`/videos/${encodeURIComponent(video.publisher)}/${encodeURIComponent(video.id)}`);
  }, [navigate, video.publisher, video.id]);
  const playlistSongData = useMemo<Song>(() => ({
    id: video.id,
    title: video.title,
    name: video.publisher,
    author: video.author,
    service: video.service || 'VIDEO',
    status: video.status,
  }), [video.author, video.id, video.publisher, video.service, video.status, video.title]);
  const artistOrBand = useMemo(() => {
    const trimmedAuthor = typeof video.author === 'string' ? video.author.trim() : '';
    return trimmedAuthor.length > 0 ? trimmedAuthor : null;
  }, [video.author]);

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
      className="flex flex-col gap-4 rounded-xl border border-sky-900/60 bg-sky-950/60 p-5 shadow-sm transition hover:border-sky-700/80 hover:bg-sky-950/80 cursor-pointer"
    >
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative w-full overflow-hidden rounded-xl border border-sky-900/60 bg-sky-900/40 shadow-inner md:w-52">
          <img
            src={coverImage}
            alt={`Preview for ${video.title}`}
            className="h-40 w-full object-cover md:h-32"
            loading="lazy"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPlay?.(video);
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition hover:opacity-100"
            aria-label={`Play ${video.title}`}
          >
            <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-sky-900">
              Play
            </span>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div className="space-y-1">
            {artistOrBand && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">
                  Artist / Band
                </p>
                <p
                  className="text-base font-semibold text-white"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {artistOrBand}
                </p>
              </>
            )}
            <h3
              className="text-lg font-semibold text-sky-100"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {video.title}
            </h3>
            <p className="text-[11px] font-medium uppercase tracking-wide text-sky-400">
              {formatPublishedLabel(video)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionIcon title="Play" onClick={() => onPlay?.(video)}>
          <FiPlay size={16} />
        </ActionIcon>
        <ActionIcon
          title="Like It"
          onClick={() => onLike?.(video)}
          isActive={isLiked}
        >
          <div className="flex items-center gap-1">
            <FiThumbsUp size={16} />
            <span className="text-[10px] font-semibold text-white">{likeCount}</span>
          </div>
        </ActionIcon>
        <ActionIcon
          title="Add Favorites"
          onClick={() => onAddFavorite?.(video)}
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
          onClick={() => onDownload?.(video)}
        >
          <FiDownload size={16} />
        </ActionIcon>
        <ActionIcon
          title="Copy link & Share It"
          onClick={() => onCopyLink?.(video)}
        >
          <FiShare2 size={16} />
        </ActionIcon>
        <ActionIcon
          title="Send Tips to Publisher"
          onClick={() => onSendTips?.(video)}
        >
          <RiHandCoinLine size={16} />
        </ActionIcon>
        {onEdit && (
          <ActionIcon title="Edit" onClick={() => onEdit?.(video)}>
            <FiEdit2 size={16} />
          </ActionIcon>
        )}
      </div>
    </div>
  );
};

export default VideoCard;
