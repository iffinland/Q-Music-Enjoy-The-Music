import {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiPlay, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import HomeActionButton from './HomeActionButton';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { Video } from '../../types';
import { RootState } from '../../state/store';
import { buildVideoShareUrl } from '../../utils/qortalLinks';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { fetchVideoLikeCount, hasUserLikedVideo, likeVideo, unlikeVideo } from '../../services/videoLikes';
import { buildMetadataEntries, formatDateTime, parseKeyValueMetadata } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';

const videoFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-video-favorites',
});

const truncate = (value: string, max = 220) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return null;
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m ${remaining}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remaining}s`;
  }
  return `${remaining}s`;
};

interface HomeVideoCardProps {
  video: Video;
}

export const HomeVideoCard: React.FC<HomeVideoCardProps> = ({ video }) => {
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const navigate = useNavigate();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const { url: coverUrl } = useCoverImage({
    identifier: video?.id ?? null,
    publisher: video?.publisher ?? null,
    enabled: Boolean(video?.id && video?.publisher),
    service: 'THUMBNAIL',
  });
  const coverImage = video.coverImage && video.coverImage.trim().length > 0 ? video.coverImage : coverUrl || radioImg;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchVideoLikeCount(video.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (username) {
        try {
          const liked = await hasUserLikedVideo(username, video.id);
          if (!cancelled) setHasLiked(liked);
        } catch (error) {
          if (!cancelled) setHasLiked(false);
        }
      }

      try {
        const favorites = (await videoFavoritesStorage.getItem<string[]>('favorites')) || [];
        if (!cancelled) setIsFavorited(favorites.includes(video.id));
      } catch (error) {
        if (!cancelled) setIsFavorited(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [video.id, username]);

  const destination = useMemo(() => {
    if (!video.publisher) return '#';
    return `/videos/${encodeURIComponent(video.publisher)}/${encodeURIComponent(video.id)}`;
  }, [video.id, video.publisher]);

  const handlePlay = useCallback(() => {
    if (!video.publisher) {
      toast.error('Video avaldaja puudub.');
      return;
    }
    navigate(destination);
  }, [destination, navigate, video.publisher]);

  const handleLike = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!username) {
      toast.error('Logi sisse, et meeldimisi lisada.');
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
      toast.error('Meeldimise uuendamine ebaõnnestus.');
    } finally {
      setLikeBusy(false);
    }
  }, [username, likeBusy, hasLiked, video]);

  const handleFavorite = useCallback(async () => {
    if (favBusy) return;

    try {
      setFavBusy(true);
      const favorites = (await videoFavoritesStorage.getItem<string[]>('favorites')) || [];
      if (isFavorited) {
        const updated = favorites.filter((id) => id !== video.id);
        await videoFavoritesStorage.setItem('favorites', updated);
        setIsFavorited(false);
      } else {
        const updated = [video.id, ...favorites.filter((id) => id !== video.id)];
        await videoFavoritesStorage.setItem('favorites', updated);
        setIsFavorited(true);
      }
    } catch (error) {
      toast.error('Lemmiku uuendamine ebaõnnestus.');
    } finally {
      setFavBusy(false);
    }
  }, [isFavorited, video.id, favBusy]);

  const handleShare = useCallback(async () => {
    if (!video.publisher) {
      toast.error('Avaldaja puudu.');
      return;
    }

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
      toast.success('Video link kopeeritud!');
    } catch (error) {
      toast.error('Linki ei saanud kopeerida.');
    }
  }, [video]);

  const handleDownload = useCallback(async () => {
    if (!video.publisher) {
      toast.error('Avaldaja puudu.');
      return;
    }

    try {
      const downloadUrl = await getQdnResourceUrl('VIDEO', video.publisher, video.id);
      if (!downloadUrl) {
        toast.error('Video fail pole hetkel saadaval.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${video.title?.replace(/\s+/g, '_') || video.id}.mp4`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Video laadimine käivitatud.');
    } catch (error) {
      toast.error('Video allalaadimine ebaõnnestus.');
    }
  }, [video]);

  const FavoriteIcon = isFavorited ? AiFillHeart : AiOutlineHeart;

  const metadataMap = useMemo(
    () => parseKeyValueMetadata(video.description),
    [video.description],
  );

  const hoverEntries = useMemo(() => {
    const entries = buildMetadataEntries(metadataMap, [
      'author',
      'genre',
      'mood',
      'language',
      'notes',
      'category',
    ]);

    if (!metadataMap.author && video.author) {
      entries.push({ label: 'Creator', value: video.author });
    }

    if (video.publisher) {
      entries.push({ label: 'Publisher', value: video.publisher });
    }

    if (video.description) {
      entries.push({ label: 'Summary', value: truncate(video.description, 260) });
    }

    const duration = formatDuration(video.durationSeconds);
    if (duration) {
      entries.push({ label: 'Duration', value: duration });
    }

    const published = formatDateTime(video.updated || video.created);
    if (published) {
      entries.push({ label: 'Updated', value: published });
    }

    return entries;
  }, [
    metadataMap,
    video.author,
    video.created,
    video.description,
    video.durationSeconds,
    video.publisher,
    video.updated,
  ]);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && video.publisher) {
          event.preventDefault();
          navigate(destination);
        }
      }}
      onClick={() => {
        if (video.publisher) {
          navigate(destination);
        }
      }}
      className="group relative flex min-w-[200px] max-w-[200px] items-stretch gap-3 rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="flex flex-1 flex-col">
        <div className="relative h-28 w-full group/card">
          <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
            <img src={coverImage} alt={video.title || 'Video cover'} className="h-full w-full object-cover" loading="lazy" />
          </div>
          <HomeCardHoverDetails title="Video details" entries={hoverEntries} />
        </div>
        <div className="mt-3 space-y-1 text-left">
          {(video.author || video.publisher) && (
            <p
              className="text-sm font-semibold text-white"
              style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {video.author || video.publisher}
            </p>
          )}
          <p
            className="text-sm font-medium text-sky-200"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {video.title || 'Untitled video'}
          </p>
          {video.publisher && (
            <p
              className="text-xs font-medium text-sky-400"
              style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {video.publisher}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 place-items-center">
        {(() => {
          const actionNodes: ReactNode[] = [
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handlePlay(); }} title="Vaata" aria-label="Play video">
                <FiPlay size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  handleLike(event);
                }}
                title={hasLiked ? 'Eemalda meeldimine' : 'Meeldib'}
                aria-label="Toggle like"
                active={hasLiked}
                disabled={likeBusy}
                className="px-2"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  <FiThumbsUp size={14} />
                  <span>{likeCount ?? '—'}</span>
                </div>
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleFavorite(); }} title={isFavorited ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse'} aria-label="Toggle favorite" active={isFavorited} disabled={favBusy}>
                <FavoriteIcon size={16} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleShare(); }} title="Jaga" aria-label="Share video">
                <FiShare2 size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleDownload(); }} title="Lae alla" aria-label="Download video">
                <FiDownload size={14} />
              </HomeActionButton>
            ),
          ];

          while (actionNodes.length < 8) {
            actionNodes.push(null);
          }

          return actionNodes.map((node, index) => (
            <div key={`video-action-${video.id}-${index}`} className="flex h-8 w-8 items-center justify-center">
              {node}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default HomeVideoCard;
