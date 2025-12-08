import React, { useCallback, useEffect, useMemo, useState, useContext, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import GoBackButton from '../../components/GoBackButton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { setAddToDownloads, setCurrentSong, SongMeta } from '../../state/features/globalSlice';
import { fetchSongByIdentifier } from '../../services/songs';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { FiPlay, FiEdit2, FiThumbsUp, FiDownload } from 'react-icons/fi';
import { buildSongShareUrl } from '../../utils/qortalLinks';
import moment from 'moment';
import { toast } from 'react-hot-toast';
import useUploadModal from '../../hooks/useUploadModal';
import { LuCopy } from 'react-icons/lu';
import { RiHandCoinLine } from 'react-icons/ri';
import { AddToPlaylistButton } from '../../components/AddToPlayistButton';
import LikeButton from '../../components/LikeButton';
import { Song } from '../../types';
import useSendTipModal from '../../hooks/useSendTipModal';
import { fetchSongLikeCount, hasUserLikedSong, likeSong, unlikeSong } from '../../services/songLikes';
import { buildDownloadFilename } from '../../utils/downloadFilename';

const DEFAULT_COVER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="100%25" height="100%25" fill="%230b2137"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" fill="%2355a8ff" font-size="28" font-family="Arial" text-anchor="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';

const SongDetail: React.FC = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const uploadModal = useUploadModal();
  const sendTipModal = useSendTipModal();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const downloads = useSelector((state: RootState) => state.global.downloads);

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [isLoadingSong, setIsLoadingSong] = useState(true);
  const [songError, setSongError] = useState<string | null>(null);
  const [song, setSong] = useState<SongMeta | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);

  const [songLikeCount, setSongLikeCount] = useState<number | null>(null);
  const [hasSongLike, setHasSongLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  const loadSong = useCallback(async () => {
    if (!publisher || !identifier) {
      setSongError('Song identifier is missing.');
      setIsLoadingSong(false);
      return;
    }

    setIsLoadingSong(true);
    setSongError(null);

    try {
      const meta = await fetchSongByIdentifier(publisher, identifier);
      if (!meta) {
        setSongError('Song could not be found.');
        return;
      }
      setSong(meta);

      const artwork = await getQdnResourceUrl('THUMBNAIL', publisher, identifier);
      if (artwork) {
        setCoverUrl(artwork);
      }
    } catch (error) {
      console.error('Failed to load song details', error);
      setSongError('Failed to load the song details.');
    } finally {
      setIsLoadingSong(false);
    }
  }, [identifier, publisher]);

  useEffect(() => {
    loadSong();
  }, [loadSong]);

  const handlePlaySong = useCallback(async () => {
    if (!song) return;

    try {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', publisher, identifier);

      if (resolvedUrl) {
        dispatch(setAddToDownloads({
          name: publisher,
          service: 'AUDIO',
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: song.status,
          title: song.title || '',
          author: song.author || '',
        }));
      } else {
        downloadVideo({
          name: publisher,
          service: 'AUDIO',
          identifier,
          title: song.title || '',
          author: song.author || '',
          id: identifier,
        });
      }

      dispatch(setCurrentSong(identifier));
    } catch (error) {
      console.error('Failed to play song', error);
      toast.error('Failed to start playback. Please try again.');
    }
  }, [dispatch, downloadVideo, identifier, publisher, song]);

  const handleCopyLink = useCallback(async () => {
    try {
      const link = buildSongShareUrl(publisher, identifier);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Link copied! Happy sharing!');
    } catch (error) {
      console.error('Failed to copy link', error);
      toast.error('Could not copy the link right now.');
    }
  }, [identifier, publisher]);

  const isOwner = useMemo(() => {
    if (!username || !song?.name) return false;
    return username.toLowerCase() === song.name.toLowerCase();
  }, [song?.name, username]);

  const handleEditSong = useCallback(() => {
    if (!song) return;
    if (!isOwner) {
      toast.error('Only the original publisher can edit this song.');
      return;
    }
    uploadModal.openSingleEdit(song);
  }, [isOwner, song, uploadModal]);

  const handleSendTip = useCallback(() => {
    if (!username) {
      toast.error('Log in to send tips.');
      return;
    }
    if (!song?.name) {
      toast.error('Creator information is missing.');
      return;
    }
    sendTipModal.open(song.name);
  }, [sendTipModal, song?.name, username]);

  const handleDownloadSong = useCallback(async () => {
    if (!song?.name) {
      toast.error('Song publisher information is missing.');
      return;
    }

    try {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', song.name, identifier);
      if (!resolvedUrl) {
        toast.error('Song download is not available yet.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download = buildDownloadFilename({
        title: song.title,
        fallbackId: identifier,
        resolvedUrl,
      });
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      dispatch(setAddToDownloads({
        name: song.name,
        service: 'AUDIO',
        id: identifier,
        identifier,
        url: resolvedUrl,
        status: song?.status,
        title: song?.title || '',
        author: song?.author || '',
      }));
      toast.success('Song download started.');
    } catch (error) {
      console.error('Failed to download song', error);
      toast.error('Song could not be downloaded. Please try again later.');
    }
  }, [dispatch, identifier, song]);

  useEffect(() => {
    let cancelled = false;
    const loadLikeData = async () => {
      if (!identifier) {
        setSongLikeCount(0);
        setHasSongLike(false);
        return;
      }
      try {
        const count = await fetchSongLikeCount(identifier);
        if (!cancelled) {
          setSongLikeCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setSongLikeCount(0);
        }
      }

      if (!username) {
        if (!cancelled) {
          setHasSongLike(false);
        }
        return;
      }

      try {
        const liked = await hasUserLikedSong(username, identifier);
        if (!cancelled) {
          setHasSongLike(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasSongLike(false);
        }
      }
    };
    loadLikeData();
    return () => {
      cancelled = true;
    };
  }, [identifier, username]);

  const handleToggleSongLike = useCallback(async () => {
    if (!identifier || !song?.name) return;

    if (!username) {
      toast.error('Log in to like songs.');
      return;
    }

    if (isProcessingLike) return;

    try {
      setIsProcessingLike(true);
      if (hasSongLike) {
        await unlikeSong(username, identifier);
        setHasSongLike(false);
        setSongLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        toast.success(`Removed like from "${song.title || 'this song'}".`);
      } else {
        await likeSong(username, {
          id: identifier,
          name: song.name,
          title: song.title,
        });
        setHasSongLike(true);
        setSongLikeCount((prev) => (prev ?? 0) + 1);
        toast.success(`You liked "${song.title || 'this song'}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle song like', error);
      toast.error('Could not update like. Please try again.');
    } finally {
      setIsProcessingLike(false);
    }
  }, [hasSongLike, identifier, isProcessingLike, song?.name, song?.title, username]);

  const favoriteSongData: Song | null = useMemo(() => {
    if (!song || !identifier) return null;
    return {
      id: identifier,
      title: song.title,
      name: song.name || publisher,
      author: song.author || publisher,
      service: song.service || 'AUDIO',
      status: song.status,
    };
  }, [identifier, publisher, song]);

  const QuickActionWrapper: React.FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="group relative">
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-900/50 bg-sky-950/80 px-3 py-1 text-xs font-medium text-sky-100 opacity-0 shadow-lg shadow-sky-950/50 transition group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  );

  const formattedDetails = useMemo(() => {
    if (!song?.description) return null;

    const pairs = song.description.split(';');
    const entries: Array<{ key: string; value: string }> = [];

    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey || !rawValue) continue;
      entries.push({
        key: rawKey.trim(),
        value: rawValue.trim(),
      });
    }

    return entries.length > 0 ? entries : null;
  }, [song]);

  const publishedLabel = useMemo(() => {
    if (!song?.created) return null;
    return moment(song.created).format('MMMM D, YYYY • HH:mm');
  }, [song]);

  const currentDownloadStatus = downloads[identifier]?.status?.status || song?.status?.status;

  const QuickActionButton: React.FC<{
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    badge?: ReactNode;
  }> = ({ icon, label, onClick, disabled, badge }) => (
    <QuickActionWrapper label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-gradient-to-br from-sky-900/70 to-slate-900/80 text-sky-100 shadow-lg shadow-sky-950/50 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:from-sky-800/80 hover:to-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon}
        {badge && (
          <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500/80 px-1.5 text-[10px] font-semibold text-black">
            {badge}
          </span>
        )}
      </button>
    </QuickActionWrapper>
  );

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {song?.title || identifier}
            </h1>
            <p className="text-sky-300/80">
              {song?.author ? `By ${song.author}` : 'Enjoy the music'}
            </p>
          </div>
        </div>
      </Header>
      <div className="mt-4 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-4 shadow-lg shadow-sky-950/30">
        <div className="flex flex-wrap items-center gap-4">
          <QuickActionButton
            icon={<FiPlay className="h-5 w-5" />}
            label={currentDownloadStatus === 'READY' ? 'Play Again' : 'Play This'}
            onClick={handlePlaySong}
            disabled={!song}
          />
          <QuickActionButton
            icon={<FiThumbsUp className={`h-5 w-5 ${hasSongLike ? 'text-emerald-300' : ''}`} />}
            label="Like It"
            onClick={handleToggleSongLike}
            disabled={!song || isProcessingLike}
            badge={typeof songLikeCount === 'number' ? songLikeCount : null}
          />
          <QuickActionButton
            icon={<RiHandCoinLine className="h-5 w-5" />}
            label="Send Tips To Publisher"
            onClick={handleSendTip}
            disabled={!song}
          />
          {favoriteSongData && (
            <QuickActionWrapper label="Add to Favorites">
              <LikeButton
                songId={favoriteSongData.id}
                name={favoriteSongData.name || publisher}
                service={favoriteSongData.service || 'AUDIO'}
                songData={favoriteSongData}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60"
                activeClassName="bg-emerald-600/10 border-emerald-400/70"
                inactiveClassName="bg-sky-950/30"
                iconSize={22}
                title="Add to Favorites"
                ariaLabel="Add to Favorites"
              />
            </QuickActionWrapper>
          )}
          {favoriteSongData && (
            <QuickActionWrapper label="Add to Playlist">
              <AddToPlaylistButton
                song={favoriteSongData}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60"
                iconSize={22}
              />
            </QuickActionWrapper>
          )}
          <QuickActionButton
            icon={<LuCopy className="h-5 w-5" />}
            label="Copy Link & Share It"
            onClick={handleCopyLink}
            disabled={!song}
          />
          <QuickActionButton
            icon={<FiDownload className="h-5 w-5" />}
            label="Download This"
            onClick={handleDownloadSong}
            disabled={!song}
          />
          {isOwner && song && (
            <QuickActionButton
              icon={<FiEdit2 className="h-5 w-5" />}
              label="Edit"
              onClick={handleEditSong}
            />
          )}
          <div className="ml-auto">
            <GoBackButton className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2 text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-500/60" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
        <Box className="p-6 flex flex-col items-center gap-4">
          <img
            src={coverUrl}
            alt={song?.title || 'Song artwork'}
            className="w-full rounded-lg border border-sky-900/60 object-cover"
          />

          <div className="w-full text-center md:text-left">
            <h2 className="text-xl font-semibold text-white">{song?.title || identifier}</h2>
            {song?.author && (
              <p className="text-sky-200/80 text-sm mt-1">Performed by {song.author}</p>
            )}
            <p className="text-sky-400/70 text-xs mt-2">
              Published by <span className="font-medium text-sky-200">{publisher}</span>
            </p>
            {publishedLabel && (
              <p className="text-sky-400/60 text-xs mt-1">Published on {publishedLabel}</p>
            )}
          </div>
        </Box>

        <div className="flex flex-col gap-6">
          <Box className="p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Additional Information</h3>
            {formattedDetails ? (
              <dl className="grid gap-2">
                {formattedDetails.map((entry) => (
                  <div key={`${entry.key}-${entry.value}`} className="grid grid-cols-[140px,1fr] gap-4">
                    <dt className="text-sm font-semibold text-sky-200/80 uppercase tracking-wide">
                      {entry.key}
                    </dt>
                    <dd className="text-sm text-sky-100">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-sky-200/70">
                No extra information has been provided yet. Stay tuned!
              </p>
            )}
          </Box>

        </div>
      </div>

      {isLoadingSong && (
        <div className="mt-6 text-center text-sky-200/70">Loading song details…</div>
      )}
      {songError && (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-200 text-center">
          {songError}
        </div>
      )}
    </div>
  );
};

export default SongDetail;
