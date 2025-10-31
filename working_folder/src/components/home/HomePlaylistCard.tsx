import {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import { FiPlay, FiShare2, FiThumbsUp } from 'react-icons/fi';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { PlayList, removeFavPlaylist, setAddToDownloads, setCurrentPlaylist, setCurrentSong, setFavPlaylist } from '../../state/features/globalSlice';
import { RootState } from '../../state/store';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { useContext } from 'react';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPlaylistShareUrl } from '../../utils/qortalLinks';
import { fetchPlaylistLikeCount, hasUserLikedPlaylist, likePlaylist, unlikePlaylist } from '../../services/playlistLikes';
import HomeActionButton from './HomeActionButton';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { formatDateTime } from '../../utils/metadata';

const playlistFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites',
});

interface HomePlaylistCardProps {
  playlist: PlayList;
}

const truncate = (value: string, max = 160) => {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
};

export const HomePlaylistCard: React.FC<HomePlaylistCardProps> = ({ playlist }) => {
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const favoritesPlaylist = useSelector((state: RootState) => state.global.favoritesPlaylist);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const navigate = useNavigate();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [playBusy, setPlayBusy] = useState(false);

  const coverImage = playlist.image || radioImg;

  const isFavorited = useMemo(
    () => favoritesPlaylist?.some((item) => item.id === playlist.id) ?? false,
    [favoritesPlaylist, playlist.id],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchPlaylistLikeCount(playlist.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLiked(false);
        return;
      }

      try {
        const liked = await hasUserLikedPlaylist(username, playlist.id);
        if (!cancelled) setHasLiked(liked);
      } catch (error) {
        if (!cancelled) setHasLiked(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [playlist.id, username]);

  const handlePlay = useCallback(async () => {
    if (!playlist.songs || playlist.songs.length === 0) {
      toast.error('Playlist on tühi.');
      return;
    }

    const head = playlist.songs[0];
    if (!head?.identifier || !head?.name) {
      toast.error('Loo info puudulik.');
      return;
    }

    if (playBusy) return;

    try {
      setPlayBusy(true);
      dispatch(setCurrentPlaylist(playlist.id));

      const downloadEntry = downloads[head.identifier];
      const isReady = downloadEntry?.status?.status === 'READY';

      if (isReady) {
        const resolvedUrl = downloadEntry?.url || (await getQdnResourceUrl(head.service || 'AUDIO', head.name, head.identifier));
        dispatch(setAddToDownloads({
          name: head.name,
          service: head.service || 'AUDIO',
          id: head.identifier,
          identifier: head.identifier,
          url: resolvedUrl ?? undefined,
          status: downloadEntry?.status,
          title: head.title || '',
          author: head.author || '',
        }));
      } else {
        downloadVideo({
          name: head.name,
          service: head.service || 'AUDIO',
          identifier: head.identifier,
          title: head.title || '',
          author: head.author || head.name,
          id: head.identifier,
        });
      }

      dispatch(setCurrentSong(head.identifier));
    } catch (error) {
      toast.error('Playlisti esitamine ebaõnnestus.');
    } finally {
      setPlayBusy(false);
    }
  }, [dispatch, downloadVideo, downloads, playBusy, playlist]);

  const handleToggleFavorite = useCallback(async () => {
    if (!username) {
      toast.error('Logi sisse, et lemmikuid hallata.');
      return;
    }

    if (favBusy) return;

    try {
      setFavBusy(true);
      const existing = (await playlistFavoritesStorage.getItem<PlayList[]>('favoritesPlaylist')) || [];

      if (isFavorited) {
        const updated = existing.filter((item) => item.id !== playlist.id);
        await playlistFavoritesStorage.setItem('favoritesPlaylist', updated);
        dispatch(removeFavPlaylist(playlist));
      } else {
        const filtered = existing.filter((item) => item.id !== playlist.id);
        const updated = [playlist, ...filtered];
        await playlistFavoritesStorage.setItem('favoritesPlaylist', updated);
        dispatch(setFavPlaylist(playlist));
      }
    } catch (error) {
      toast.error('Lemmiku uuendamine ebaõnnestus.');
    } finally {
      setFavBusy(false);
    }
  }, [dispatch, isFavorited, playlist, username, favBusy]);

  const handleToggleLike = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!username) {
      toast.error('Logi sisse, et meeldimisi lisada.');
      return;
    }

    if (likeBusy) return;

    try {
      setLikeBusy(true);
      if (hasLiked) {
        await unlikePlaylist(username, playlist.id);
        setHasLiked(false);
        setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
      } else {
        await likePlaylist(username, playlist);
        setHasLiked(true);
        setLikeCount((prev) => (prev ?? 0) + 1);
      }
    } catch (error) {
      toast.error('Meeldimise uuendamine ebaõnnestus.');
    } finally {
      setLikeBusy(false);
    }
  }, [username, likeBusy, hasLiked, playlist]);

  const handleShare = useCallback(async () => {
    if (!playlist.user) {
      toast.error('Koostaja puudub.');
      return;
    }

    try {
      const link = buildPlaylistShareUrl(playlist.user, playlist.id);
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
      toast.success('Playlisti link kopeeritud!');
    } catch (error) {
      toast.error('Linki ei õnnestunud kopeerida.');
    }
  }, [playlist.id, playlist.user]);

  const FavoriteIcon = isFavorited ? AiFillHeart : AiOutlineHeart;

  const encodedPublisher = playlist.user ? encodeURIComponent(playlist.user) : '';
  const encodedIdentifier = encodeURIComponent(playlist.id);

  const hoverEntries = useMemo(() => {
    const entries: { label: string; value: string }[] = [];

    if (playlist.description) {
      entries.push({
        label: 'Description',
        value: truncate(playlist.description, 220),
      });
    }

    if (playlist.songs?.length) {
      entries.push({
        label: 'Tracks',
        value: `${playlist.songs.length}`,
      });
    }

    if (playlist.user) {
      entries.push({
        label: 'Creator',
        value: playlist.user,
      });
    }

    if (playlist.categoryName) {
      entries.push({
        label: 'Category',
        value: playlist.categoryName,
      });
    }

    const published = formatDateTime(playlist.updated || playlist.created);
    if (published) {
      entries.push({
        label: 'Updated',
        value: published,
      });
    }

    return entries;
  }, [playlist.categoryName, playlist.created, playlist.description, playlist.songs, playlist.updated, playlist.user]);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && playlist.user) {
          event.preventDefault();
          navigate(`/playlists/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      onClick={() => {
        if (playlist.user) {
          navigate(`/playlists/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      className="group relative flex min-w-[200px] max-w-[200px] items-stretch gap-3 rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="flex flex-1 flex-col">
        <div className="relative h-28 w-full group/card">
          <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
            <img src={coverImage} alt={playlist.title || 'Playlist cover'} className="h-full w-full object-cover" loading="lazy" />
          </div>
          <HomeCardHoverDetails title="Playlist details" entries={hoverEntries} />
        </div>
        <div className="mt-3 space-y-1 text-left">
          <p className="text-sm font-semibold text-white" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {playlist.title || 'Untitled playlist'}
          </p>
          {playlist.description && (
            <p className="text-xs text-sky-200/80" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {playlist.description}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 place-items-center">
        {(() => {
          const actionNodes: ReactNode[] = [
            (
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handlePlay();
                }}
                title="Esita"
                aria-label="Play playlist"
                disabled={playBusy}
              >
                <FiPlay size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  handleToggleLike(event);
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
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleFavorite();
                }}
                title={isFavorited ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse'}
                aria-label="Toggle favorite"
                active={isFavorited}
                disabled={favBusy}
              >
                <FavoriteIcon size={16} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handleShare();
                }}
                title="Jaga"
                aria-label="Share playlist"
              >
                <FiShare2 size={14} />
              </HomeActionButton>
            ),
          ];

          while (actionNodes.length < 8) {
            actionNodes.push(null);
          }

          return actionNodes.map((node, index) => (
            <div key={`playlist-action-${playlist.id}-${index}`} className="flex h-8 w-8 items-center justify-center">
              {node}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default HomePlaylistCard;
