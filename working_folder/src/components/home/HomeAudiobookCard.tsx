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
import { Audiobook } from '../../types';
import { RootState } from '../../state/store';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildAudiobookShareUrl } from '../../utils/qortalLinks';
import { fetchAudiobookLikeCount, fetchAudiobookLikeUsers, hasUserLikedAudiobook, likeAudiobook, unlikeAudiobook } from '../../services/audiobookLikes';
import { setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import useSendTipModal from '../../hooks/useSendTipModal';
import { RiHandCoinLine } from 'react-icons/ri';
import { formatDateTime } from '../../utils/metadata';
import useCoverImage from '../../hooks/useCoverImage';

const audiobookFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-audiobook-favorites',
});

const truncate = (value: string, max = 200) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

interface HomeAudiobookCardProps {
  audiobook: Audiobook;
}

export const HomeAudiobookCard: React.FC<HomeAudiobookCardProps> = ({ audiobook }) => {
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

  const { url: coverUrl } = useCoverImage({
    identifier: audiobook?.id ?? null,
    publisher: audiobook?.publisher ?? null,
    enabled: Boolean(audiobook?.id && audiobook?.publisher),
  });
  const coverImage = audiobook.coverImage && audiobook.coverImage.trim().length > 0 ? audiobook.coverImage : coverUrl || radioImg;
  const creatorDisplay = audiobook.author?.trim() || audiobook.publisher || 'Unknown narrator';

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchAudiobookLikeCount(audiobook.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (username) {
        try {
          const liked = await hasUserLikedAudiobook(username, audiobook.id);
          if (!cancelled) setHasLiked(liked);
        } catch (error) {
          if (!cancelled) setHasLiked(false);
        }
      }

      try {
        const existing = (await audiobookFavoritesStorage.getItem<string[]>('favorites')) || [];
        if (!cancelled) setIsFavorited(existing.includes(audiobook.id));
      } catch (error) {
        if (!cancelled) setIsFavorited(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [audiobook.id, username]);

  const handlePlay = useCallback(async () => {
    try {
      const downloadEntry = downloads[audiobook.id];
      const isReady = downloadEntry?.status?.status === 'READY' || audiobook.status?.status === 'READY';

      if (isReady) {
        const resolvedUrl = downloadEntry?.url || (await getQdnResourceUrl('AUDIO', audiobook.publisher, audiobook.id));
        dispatch(setAddToDownloads({
          name: audiobook.publisher,
          service: 'AUDIO',
          id: audiobook.id,
          identifier: audiobook.id,
          url: resolvedUrl ?? undefined,
          status: audiobook.status,
          title: audiobook.title || '',
          author: creatorDisplay,
        }));
      } else {
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
      toast.error('Audiobooki esitamine ebaõnnestus.');
    }
  }, [creatorDisplay, dispatch, downloadVideo, downloads, audiobook]);

  const handleDownload = useCallback(async () => {
    try {
      const directUrl = await getQdnResourceUrl('AUDIO', audiobook.publisher, audiobook.id);
      if (!directUrl) {
        toast.error('Fail pole veel saadaval.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = directUrl;
      anchor.download = `${audiobook.title?.replace(/\s+/g, '_') || audiobook.id}.audio`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      dispatch(setAddToDownloads({
        name: audiobook.publisher,
        service: 'AUDIO',
        id: audiobook.id,
        identifier: audiobook.id,
        url: directUrl,
        status: audiobook.status,
        title: audiobook.title || '',
        author: creatorDisplay,
      }));
    } catch (error) {
      toast.error('Audiobooki allalaadimine ebaõnnestus.');
    }
  }, [creatorDisplay, dispatch, audiobook]);

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
        await unlikeAudiobook(username, audiobook.id);
        setHasLiked(false);
        setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
      } else {
        await likeAudiobook(username, audiobook);
        setHasLiked(true);
        setLikeCount((prev) => (prev ?? 0) + 1);
      }
    } catch (error) {
      toast.error('Meeldimise uuendamine ebaõnnestus.');
    } finally {
      setLikeBusy(false);
    }
  }, [username, likeBusy, hasLiked, audiobook]);

  const handleFavorite = useCallback(async () => {
    if (favBusy) return;

    try {
      setFavBusy(true);
      const existing = (await audiobookFavoritesStorage.getItem<string[]>('favorites')) || [];
      if (isFavorited) {
        const updated = existing.filter((id) => id !== audiobook.id);
        await audiobookFavoritesStorage.setItem('favorites', updated);
        setIsFavorited(false);
      } else {
        const updated = [audiobook.id, ...existing.filter((id) => id !== audiobook.id)];
        await audiobookFavoritesStorage.setItem('favorites', updated);
        setIsFavorited(true);
      }
    } catch (error) {
      toast.error('Lemmiku uuendamine ebaõnnestus.');
    } finally {
      setFavBusy(false);
    }
  }, [isFavorited, audiobook.id, favBusy]);

  const handleShare = useCallback(async () => {
    if (!audiobook.publisher) {
      toast.error('Avaldaja puudu.');
      return;
    }

    try {
      const link = buildAudiobookShareUrl(audiobook.publisher, audiobook.id);
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
      toast.success('Audiobooki link kopeeritud!');
    } catch (error) {
      toast.error('Linki ei saanud kopeerida.');
    }
  }, [audiobook]);

  const handleTip = useCallback(() => {
    if (!username) {
      toast.error('Logi sisse, et tippida.');
      return;
    }
    if (!audiobook.publisher) {
      toast.error('Autor puudub.');
      return;
    }
    sendTipModal.open(audiobook.publisher);
  }, [audiobook.publisher, sendTipModal, username]);

  const FavoriteIcon = isFavorited ? AiFillHeart : AiOutlineHeart;

  const encodedPublisher = audiobook.publisher ? encodeURIComponent(audiobook.publisher) : '';
  const encodedIdentifier = encodeURIComponent(audiobook.id);

  const hoverEntries = useMemo(() => {
    const entries: { label: string; value: string }[] = [];

    entries.push({
      label: 'Narrator / Author',
      value: creatorDisplay,
    });

    if (audiobook.category) {
      entries.push({
        label: 'Category',
        value: audiobook.category,
      });
    }

    if (audiobook.description) {
      entries.push({
        label: 'Summary',
        value: truncate(audiobook.description, 240),
      });
    }

    const published = formatDateTime(audiobook.updated || audiobook.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    return entries;
  }, [audiobook.category, audiobook.created, audiobook.description, audiobook.updated, creatorDisplay]);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && audiobook.publisher) {
          event.preventDefault();
          navigate(`/audiobooks/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      onClick={() => {
        if (audiobook.publisher) {
          navigate(`/audiobooks/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      className="group relative flex min-w-[200px] max-w-[200px] items-stretch gap-3 rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="flex flex-1 flex-col">
        <div className="relative h-28 w-full group/card">
          <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
            <img src={coverImage} alt={audiobook.title || 'Audiobook cover'} className="h-full w-full object-cover" loading="lazy" />
          </div>
          <HomeCardHoverDetails title="Audiobook details" entries={hoverEntries} />
        </div>
        <div className="mt-3 space-y-1 text-left">
          <p className="text-sm font-semibold text-white" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {audiobook.title || 'Untitled audiobook'}
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
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handlePlay(); }} title="Esita" aria-label="Play audiobook">
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
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleFavorite(); }} title={isFavorited ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse'} aria-label="Toggle favorite" active={isFavorited} disabled={favBusy}>
                <FavoriteIcon size={16} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleShare(); }} title="Jaga" aria-label="Share audiobook">
                <FiShare2 size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton onClick={(event) => { event.stopPropagation(); handleDownload(); }} title="Lae alla" aria-label="Download audiobook">
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
            <div key={`audiobook-action-${audiobook.id}-${index}`} className="flex h-8 w-8 items-center justify-center">
              {node}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default HomeAudiobookCard;
