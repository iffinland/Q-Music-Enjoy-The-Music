import {
  MouseEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
import { fetchPodcastLikeCount, hasUserLikedPodcast, likePodcast, unlikePodcast } from '../../services/podcastLikes';
import { setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import useSendTipModal from '../../hooks/useSendTipModal';
import { RiHandCoinLine } from 'react-icons/ri';
import { formatDateTime } from '../../utils/metadata';

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

  const coverImage = podcast.coverImage && podcast.coverImage.trim().length > 0 ? podcast.coverImage : radioImg;

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
          author: podcast.publisher,
        }));
      } else {
        downloadVideo({
          name: podcast.publisher,
          service: 'AUDIO',
          identifier: podcast.id,
          title: podcast.title || '',
          author: podcast.publisher,
          id: podcast.id,
        });
      }

      dispatch(setCurrentSong(podcast.id));
    } catch (error) {
      toast.error('Podcasti esitamine ebaõnnestus.');
    }
  }, [dispatch, downloadVideo, downloads, podcast]);

  const handleDownload = useCallback(async () => {
    try {
      const directUrl = await getQdnResourceUrl('AUDIO', podcast.publisher, podcast.id);
      if (!directUrl) {
        toast.error('Fail pole veel saadaval.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = directUrl;
      anchor.download = `${podcast.title?.replace(/\s+/g, '_') || podcast.id}.audio`;
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
        author: podcast.publisher,
      }));
    } catch (error) {
      toast.error('Podcasti allalaadimine ebaõnnestus.');
    }
  }, [dispatch, podcast]);

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
        await unlikePodcast(username, podcast.id);
        setHasLiked(false);
        setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
      } else {
        await likePodcast(username, podcast);
        setHasLiked(true);
        setLikeCount((prev) => (prev ?? 0) + 1);
      }
    } catch (error) {
      toast.error('Meeldimise uuendamine ebaõnnestus.');
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
      toast.error('Lemmiku uuendamine ebaõnnestus.');
    } finally {
      setFavBusy(false);
    }
  }, [isFavorited, podcast.id, favBusy]);

  const handleShare = useCallback(async () => {
    if (!podcast.publisher) {
      toast.error('Avaldaja puudu.');
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
      toast.success('Podcasti link kopeeritud!');
    } catch (error) {
      toast.error('Linki ei saanud kopeerida.');
    }
  }, [podcast]);

  const handleTip = useCallback(() => {
    if (!username) {
      toast.error('Logi sisse, et tippida.');
      return;
    }
    if (!podcast.publisher) {
      toast.error('Autor puudub.');
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
      label: 'Publisher',
      value: podcast.publisher || 'Unknown',
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
  }, [podcast.category, podcast.created, podcast.description, podcast.publisher, podcast.updated]);

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
            {podcast.publisher || 'Avaldaja teadmata'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 place-items-center">
        {(() => {
          const actionNodes: ReactNode[] = [
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handlePlay(); }} title="Esita" aria-label="Play podcast">
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
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleShare(); }} title="Jaga" aria-label="Share podcast">
                <FiShare2 size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleDownload(); }} title="Lae alla" aria-label="Download podcast">
                <FiDownload size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleTip(); }} title="Jäta tippi" aria-label="Send tip">
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
