import {
  MouseEvent,
  ReactNode,
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
import { toast } from 'react-hot-toast';
import { FiDownload, FiPlay, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import HomeActionButton from './HomeActionButton';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { Podcast } from '../../types';
import { RootState } from '../../state/store';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPodcastShareUrl } from '../../utils/qortalLinks';
import { fetchPodcastLikeCount, fetchPodcastLikeUsers, hasUserLikedPodcast, likePodcast, unlikePodcast } from '../../services/podcastLikes';
import { setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import useSendTipModal from '../../hooks/useSendTipModal';
import { RiHandCoinLine } from 'react-icons/ri';
import { formatDateTime } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';
import { buildDownloadFilename } from '../../utils/downloadFilename';

const podcastFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-podcast-favorites',
});

const truncate = (value: string, max = 200) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

interface HomePodcastCardProps {
  podcast: Podcast;
}

export const HomePodcastCard: React.FC<HomePodcastCardProps> = ({ podcast }) => {
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const sendTipModal = useSendTipModal();
  const navigate = useNavigate();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [likeUsers, setLikeUsers] = useState<string[]>([]);
  const [likeUsersLoading, setLikeUsersLoading] = useState(false);
  const [isLikePopoverOpen, setIsLikePopoverOpen] = useState(false);
  const likeUsersLoadedRef = useRef(false);

  const { url: coverUrl } = useCoverImage({
    identifier: podcast?.id ?? null,
    publisher: podcast?.publisher ?? null,
    enabled: Boolean(podcast?.id && podcast?.publisher),
    service: 'THUMBNAIL',
  });
  const coverImage = podcast.coverImage && podcast.coverImage.trim().length > 0 ? podcast.coverImage : coverUrl || radioImg;
  const creatorDisplay = podcast.author?.trim() || podcast.publisher || 'Unknown host';

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchPodcastLikeCount(podcast.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (username) {
        try {
          const liked = await hasUserLikedPodcast(username, podcast.id);
          if (!cancelled) setHasLiked(liked);
        } catch (error) {
          if (!cancelled) setHasLiked(false);
        }
      }

      try {
        const existing = (await podcastFavoritesStorage.getItem<string[]>('favorites')) || [];
        if (!cancelled) setIsFavorited(existing.includes(podcast.id));
      } catch (error) {
        if (!cancelled) setIsFavorited(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [podcast.id, username]);

  const handlePlay = useCallback(async () => {
    try {
      const downloadEntry = downloads[podcast.id];
      const isReady = downloadEntry?.status?.status === 'READY' || podcast.status?.status === 'READY';

      if (isReady) {
        const resolvedUrl = downloadEntry?.url || (await getQdnResourceUrl('AUDIO', podcast.publisher, podcast.id));
        dispatch(setAddToDownloads({
          name: podcast.publisher,
          service: 'AUDIO',
          id: podcast.id,
          identifier: podcast.id,
          url: resolvedUrl ?? undefined,
          status: podcast.status,
          title: podcast.title || '',
          author: creatorDisplay,
        }));
      } else {
        downloadVideo({
          name: podcast.publisher,
          service: 'AUDIO',
          identifier: podcast.id,
          title: podcast.title || '',
          author: creatorDisplay,
          id: podcast.id,
        });
      }

      dispatch(setCurrentSong(podcast.id));
    } catch (error) {
      toast.error('Failed to start podcast playback.');
    }
  }, [creatorDisplay, dispatch, downloadVideo, downloads, podcast]);

  const handleDownload = useCallback(async () => {
    try {
      const directUrl = await getQdnResourceUrl('AUDIO', podcast.publisher, podcast.id);
      if (!directUrl) {
        toast.error('File is not available yet.');
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

      dispatch(setAddToDownloads({
        name: podcast.publisher,
        service: 'AUDIO',
        id: podcast.id,
        identifier: podcast.id,
        url: directUrl,
        status: podcast.status,
        title: podcast.title || '',
        author: creatorDisplay,
      }));
    } catch (error) {
      toast.error('Failed to download the podcast.');
    }
  }, [creatorDisplay, dispatch, podcast]);

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

  const handleLike = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!username) {
      toast.error('Sign in to add likes.');
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
        await likePodcast(username, podcast);
        setHasLiked(true);
        setLikeCount((prev) => (prev ?? 0) + 1);
      }
    } catch (error) {
      toast.error('Failed to update like.');
    } finally {
      setLikeBusy(false);
    }
  }, [username, likeBusy, hasLiked, podcast]);

  const handleFavorite = useCallback(async () => {
    if (favBusy) return;

    try {
      setFavBusy(true);
      const existing = (await podcastFavoritesStorage.getItem<string[]>('favorites')) || [];
      if (isFavorited) {
        const updated = existing.filter((id) => id !== podcast.id);
        await podcastFavoritesStorage.setItem('favorites', updated);
        setIsFavorited(false);
      } else {
        const updated = [podcast.id, ...existing.filter((id) => id !== podcast.id)];
        await podcastFavoritesStorage.setItem('favorites', updated);
        setIsFavorited(true);
      }
    } catch (error) {
      toast.error('Failed to update favorite.');
    } finally {
      setFavBusy(false);
    }
  }, [isFavorited, podcast.id, favBusy]);

  const handleShare = useCallback(async () => {
    if (!podcast.publisher) {
      toast.error('Publisher information is missing.');
      return;
    }

    try {
      const link = buildPodcastShareUrl(podcast.publisher, podcast.id);
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
      toast.success('Podcast link copied!');
    } catch (error) {
      toast.error('Failed to copy the link.');
    }
  }, [podcast]);

  const handleTip = useCallback(() => {
    if (!username) {
      toast.error('Sign in to send tips.');
      return;
    }
    if (!podcast.publisher) {
      toast.error('Creator information is missing.');
      return;
    }
    sendTipModal.open(podcast.publisher);
  }, [podcast.publisher, sendTipModal, username]);

  const FavoriteIcon = isFavorited ? AiFillHeart : AiOutlineHeart;

  const encodedPublisher = podcast.publisher ? encodeURIComponent(podcast.publisher) : '';
  const encodedIdentifier = encodeURIComponent(podcast.id);

  const hoverEntries = useMemo(() => {
    const entries: { label: string; value: string }[] = [];

    entries.push({
      label: 'Creator',
      value: creatorDisplay,
    });

    if (podcast.category) {
      entries.push({
        label: 'Category',
        value: podcast.category,
      });
    }

    if (podcast.description) {
      entries.push({
        label: 'Summary',
        value: truncate(podcast.description, 240),
      });
    }

    const published = formatDateTime(podcast.updated || podcast.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    return entries;
  }, [creatorDisplay, podcast.category, podcast.created, podcast.description, podcast.updated]);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && podcast.publisher) {
          event.preventDefault();
          navigate(`/podcasts/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      onClick={() => {
        if (podcast.publisher) {
          navigate(`/podcasts/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      className="group relative flex min-w-[200px] max-w-[200px] items-stretch gap-3 rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="flex flex-1 flex-col">
        <div className="relative h-28 w-full group/card">
          <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
            <img src={coverImage} alt={podcast.title || 'Podcast cover'} className="h-full w-full object-cover" loading="lazy" />
          </div>
          <HomeCardHoverDetails title="Podcast details" entries={hoverEntries} />
        </div>
        <div className="mt-3 space-y-1 text-left">
          <p className="text-sm font-semibold text-white" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {podcast.title || 'Untitled podcast'}
          </p>
          <p className="text-xs font-medium text-sky-300" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {creatorDisplay}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 place-items-center">
        {(() => {
          const actionNodes: ReactNode[] = [
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handlePlay(); }} title="Play" aria-label="Play podcast">
                <FiPlay size={14} />
              </HomeActionButton>
            ),
            (
              <div
                className="relative"
                onMouseEnter={() => handleLikePopover(true)}
                onMouseLeave={() => handleLikePopover(false)}
                onFocusCapture={() => handleLikePopover(true)}
                onBlurCapture={() => handleLikePopover(false)}
              >
                <HomeActionButton
                  onClick={(event) => {
                    handleLike(event);
                  }}
                  title={hasLiked ? 'Remove like' : 'Like'}
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
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleFavorite(); }} title={isFavorited ? 'Remove from favorites' : 'Add to favorites'} aria-label="Toggle favorite" active={isFavorited} disabled={favBusy}>
                <FavoriteIcon size={16} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleShare(); }} title="Share" aria-label="Share podcast">
                <FiShare2 size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleDownload(); }} title="Download" aria-label="Download podcast">
                <FiDownload size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleTip(); }} title="Send tip" aria-label="Send tip">
                <RiHandCoinLine size={14} />
              </HomeActionButton>
            ),
          ];

          while (actionNodes.length < 8) {
            actionNodes.push(null);
          }

          return actionNodes.map((node, index) => (
            <div key={`podcast-action-${podcast.id}-${index}`} className="flex h-8 w-8 items-center justify-center">
              {node}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default HomePodcastCard;
