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
import { FaPlay } from 'react-icons/fa';
import { FiDownload, FiEdit2, FiThumbsUp } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import { RiHandCoinLine } from 'react-icons/ri';
import { Song } from '../../types';
import { SongMeta, setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import { RootState } from '../../state/store';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { AddToPlaylistButton } from '../AddToPlayistButton';
import LikeButton from '../LikeButton';
import { fetchSongLikeCount, hasUserLikedSong, likeSong, unlikeSong } from '../../services/songLikes';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildSongShareUrl } from '../../utils/qortalLinks';
import useSendTipModal from '../../hooks/useSendTipModal';
import { toast } from 'react-hot-toast';
import HomeActionButton from './HomeActionButton';
import HomeCardHoverDetails from './HomeCardHoverDetails';
import radioImg from '../../assets/img/enjoy-music.jpg';
import { buildMetadataEntries, formatDateTime, parseKeyValueMetadata } from '../../utils/metadata';
import useUploadModal from '../../hooks/useUploadModal';
import useCoverImage from '../../hooks/useCoverImage';
import { buildDownloadFilename } from '../../utils/downloadFilename';

interface HomeSongCardProps {
  song: SongMeta;
}

export const HomeSongCard: React.FC<HomeSongCardProps> = ({ song }) => {
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const sendTipModal = useSendTipModal();
  const navigate = useNavigate();
  const uploadModal = useUploadModal();

  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [hasLike, setHasLike] = useState<boolean>(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const { url: coverUrl } = useCoverImage({
    identifier: song?.id,
    publisher: song?.name,
    enabled: Boolean(song?.id && song?.name),
  });
  const coverImage = coverUrl || radioImg;
  const publisher = song.name || '—';
  const encodedPublisher = song.name ? encodeURIComponent(song.name) : '';
  const encodedIdentifier = song.id ? encodeURIComponent(song.id) : '';
  const isOwner = useMemo(() => {
    if (!username || !song?.name) return false;
    return username.toLowerCase() === song.name.toLowerCase();
  }, [song?.name, username]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const count = await fetchSongLikeCount(song.id);
        if (!cancelled) setLikeCount(count);
      } catch (error) {
        if (!cancelled) setLikeCount(0);
      }

      if (!username) {
        if (!cancelled) setHasLike(false);
        return;
      }

      try {
        const liked = await hasUserLikedSong(username, song.id);
        if (!cancelled) setHasLike(liked);
      } catch (error) {
        if (!cancelled) setHasLike(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [song.id, username]);

  const favoriteSongData: Song = useMemo(() => ({
    id: song.id,
    title: song.title,
    name: song.name,
    author: song.author,
    service: song.service,
    status: song.status,
  }), [song]);

  const handlePlay = useCallback(async () => {
    if (!song.name) {
      toast.error('Song publisher missing.');
      return;
    }

    const downloadEntry = downloads[song.id];
    const isReady = downloadEntry?.status?.status === 'READY' || song.status?.status === 'READY';

    if (isReady) {
      const resolvedUrl = downloadEntry?.url || (await getQdnResourceUrl('AUDIO', song.name, song.id));
      dispatch(setAddToDownloads({
        name: song.name,
        service: 'AUDIO',
        id: song.id,
        identifier: song.id,
        url: resolvedUrl ?? undefined,
        status: song.status,
        title: song.title || '',
        author: song.author || '',
      }));
    } else {
      downloadVideo({
        name: song.name,
        service: 'AUDIO',
        identifier: song.id,
        title: song.title || '',
        author: song.author || '',
        id: song.id,
      });
    }

    dispatch(setCurrentSong(song.id));
  }, [dispatch, downloadVideo, downloads, song]);

  const handleDownload = useCallback(async () => {
    if (!song.name) return;

    try {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', song.name, song.id);
      if (!resolvedUrl) {
        toast.error('Song download not available yet.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download = buildDownloadFilename({
        title: song.title,
        fallbackId: song.id,
        resolvedUrl,
      });
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      dispatch(setAddToDownloads({
        name: song.name,
        service: 'AUDIO',
        id: song.id,
        identifier: song.id,
        url: resolvedUrl,
        status: song.status,
        title: song.title || '',
        author: song.author || '',
      }));
    } catch (error) {
      console.error('Failed to download song', error);
      toast.error('Failed to download the song.');
    }
  }, [dispatch, song]);

  const handleShare = useCallback(async () => {
    if (!song.name) {
      toast.error('Publisher missing.');
      return;
    }

    try {
      const link = buildSongShareUrl(song.name, song.id);
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
      toast.success('Link copied!');
    } catch (error) {
      toast.error('Failed to copy the link.');
    }
  }, [song.id, song.name]);

  const handleLike = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!username) {
      toast.error('Sign in to add likes.');
      return;
    }

    if (likeBusy) return;

    try {
      setLikeBusy(true);
      if (hasLike) {
        await unlikeSong(username, song.id);
        setHasLike(false);
        setLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
      } else {
        await likeSong(username, { id: song.id, name: song.name, title: song.title });
        setHasLike(true);
        setLikeCount((prev) => (prev ?? 0) + 1);
      }
    } catch (error) {
      toast.error('Failed to update like.');
    } finally {
      setLikeBusy(false);
    }
  }, [username, likeBusy, hasLike, song]);

  const handleTip = useCallback(() => {
    if (!username) {
      toast.error('Sign in to send tips.');
      return;
    }
    if (!song.name) {
      toast.error('Creator information is missing.');
      return;
    }
    sendTipModal.open(song.name);
  }, [sendTipModal, song.name, username]);

  const handleEdit = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!isOwner) {
      toast.error('Only the original publisher can edit this song.');
      return;
    }

    uploadModal.openSingleEdit(song);
  }, [isOwner, song, uploadModal]);

  const metadataMap = useMemo(
    () => parseKeyValueMetadata(song.description),
    [song.description],
  );

  const hoverEntries = useMemo(() => {
    const entries = buildMetadataEntries(metadataMap, [
      'title',
      'author',
      'genre',
      'mood',
      'language',
      'notes',
    ]);

    if (!metadataMap.author && song.author) {
      entries.push({
        label: 'Performer',
        value: song.author,
      });
    }

    if (song.name) {
      entries.push({
        label: 'Publisher',
        value: song.name,
      });
    }

    const published = formatDateTime(song.created);
    if (published) {
      entries.push({
        label: 'Published',
        value: published,
      });
    }

    return entries;
  }, [metadataMap, song.author, song.created, song.name]);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (encodedPublisher && encodedIdentifier) {
            navigate(`/songs/${encodedPublisher}/${encodedIdentifier}`);
          }
        }
      }}
      onClick={() => {
        if (encodedPublisher && encodedIdentifier) {
          navigate(`/songs/${encodedPublisher}/${encodedIdentifier}`);
        }
      }}
      className="group relative flex min-w-[200px] max-w-[200px] items-stretch gap-3 rounded-xl border border-sky-900/60 bg-sky-950/70 p-3 shadow hover:border-sky-700/70 hover:bg-sky-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sky-950/80"
    >
      <div className="flex flex-1 flex-col">
        <div className="relative h-28 w-full group/card">
          <div className="h-full w-full overflow-hidden rounded-lg border border-sky-900/60 bg-sky-900/40">
            <img src={coverImage} alt={song.title || 'Song cover'} className="h-full w-full object-cover" loading="lazy" />
          </div>
          <HomeCardHoverDetails title="Song details" entries={hoverEntries} />
        </div>
        <div className="mt-3 space-y-1 text-left">
          <p className="text-sm font-semibold text-white" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {song.title || 'Untitled song'}
          </p>
          <p className="text-xs font-medium text-sky-300" title={song.author || undefined}>
            {song.author || 'Author unknown'}
          </p>
          <p className="text-[11px] text-sky-400/80" title={publisher}>
            {publisher}
          </p>
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
                title="Play"
                aria-label="Play"
              >
                <FaPlay size={14} />
              </HomeActionButton>
            ),
            (
              <div onClick={(event) => event.stopPropagation()}>
                <AddToPlaylistButton
                  song={favoriteSongData}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-900/50 text-sky-200/80 hover:bg-sky-800/70"
                  iconSize={14}
                />
              </div>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handleLike(event);
                }}
                title="Like It"
                aria-label="Like It"
                active={hasLike}
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
              <div onClick={(event) => event.stopPropagation()}>
                <LikeButton
                  songId={song.id}
                  name={song.name}
                  service={song.service || 'AUDIO'}
                  songData={favoriteSongData}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-900/50 text-sky-200/80 hover:bg-sky-800/70"
                  activeClassName="bg-sky-800/80 text-white hover:bg-sky-700/80"
                  inactiveClassName="bg-sky-900/50 text-sky-200/80 hover:bg-sky-800/70"
                  iconSize={14}
                  title="Add Favorites"
                  ariaLabel="Add Favorites"
                />
              </div>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handleDownload();
                }}
                title="Download"
                aria-label="Download"
              >
                <FiDownload size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handleShare();
                }}
                title="Copy link & Share It"
                aria-label="Copy link & Share It"
              >
                <LuCopy size={14} />
              </HomeActionButton>
            ),
            (
              <HomeActionButton
                onClick={(event) => {
                  event.stopPropagation();
                  handleTip();
                }}
                title="Send Tips to Publisher"
                aria-label="Send Tips to Publisher"
              >
                <RiHandCoinLine size={14} />
              </HomeActionButton>
            ),
            isOwner ? (
              <HomeActionButton
                onClick={handleEdit}
                title="Edit"
                aria-label="Edit"
              >
                <FiEdit2 size={14} />
              </HomeActionButton>
            ) : null,
          ];

          while (actionNodes.length < 8) {
            actionNodes.push(null);
          }

          return actionNodes.map((node, index) => (
            <div key={`song-action-${song.id}-${index}`} className="flex h-8 w-8 items-center justify-center">
              {node}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default HomeSongCard;
