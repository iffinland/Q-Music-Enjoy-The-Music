import React, { useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import GoBackButton from '../../components/GoBackButton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Audiobook, Song } from '../../types';
import { fetchAudiobookByIdentifier } from '../../services/audiobooks';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildAudiobookShareUrl } from '../../utils/qortalLinks';
import { buildDownloadFilename } from '../../utils/downloadFilename';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { FiDownload, FiPlay, FiEdit2, FiThumbsUp } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import { RiHandCoinLine } from 'react-icons/ri';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import useUploadAudiobookModal from '../../hooks/useUploadAudiobookModal';
import { resolveAudioUrl } from '../../utils/resolveAudioUrl';
import useSendTipModal from '../../hooks/useSendTipModal';
import { AddToPlaylistButton } from '../../components/AddToPlayistButton';
import LikeButton from '../../components/LikeButton';
import { fetchAudiobookLikeCount, hasUserLikedAudiobook, likeAudiobook, unlikeAudiobook } from '../../services/audiobookLikes';

const DEFAULT_COVER =
  'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"400\"%3E%3Crect width=\"100%25\" height=\"100%25\" fill=\"%230b2137\"%3E%3C/rect%3E%3Ctext x=\"50%25\" y=\"50%25\" fill=\"%2355a8ff\" font-size=\"28\" font-family=\"Arial\" text-anchor=\"middle\"%3ENo Cover%3C/text%3E%3C/svg%3E';

const formatFileSize = (size?: number): string | null => {
  if (typeof size !== 'number' || size <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const display = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${display} ${units[unitIndex]}`;
};

const AudiobookDetail: React.FC = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const uploadAudiobookModal = useUploadAudiobookModal();
  const sendTipModal = useSendTipModal();

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [audiobook, setAudiobook] = useState<Audiobook | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [audiobookLikeCount, setAudiobookLikeCount] = useState<number | null>(null);
  const [hasAudiobookLike, setHasAudiobookLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  const loadAudiobook = useCallback(async () => {
    if (!publisher || !identifier) {
      setError('Audiobook identifier is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const meta = await fetchAudiobookByIdentifier(publisher, identifier);
      if (!meta) {
        setError('Audiobook could not be found.');
        return;
      }
      setAudiobook(meta);

      const artwork = await getQdnResourceUrl('THUMBNAIL', publisher, identifier);
      if (artwork) {
        setCoverUrl(artwork);
      }
    } catch (loadError) {
      console.error('Failed to load audiobook', loadError);
      setError('Failed to load the audiobook details.');
    } finally {
      setIsLoading(false);
    }
  }, [identifier, publisher]);

  useEffect(() => {
    loadAudiobook();
  }, [loadAudiobook]);

  const handlePlayAudiobook = useCallback(async () => {
    if (!audiobook) return;

    try {
      const existingDownload = downloads[audiobook.id];
      const resolvedUrl =
        existingDownload?.url ||
        (await resolveAudioUrl(publisher, identifier));

      if (resolvedUrl) {
        const readyStatus =
          existingDownload?.status?.status === 'READY'
            ? existingDownload?.status
            : { ...(audiobook.status ?? {}), status: 'READY', percentLoaded: 100 };
        dispatch(setAddToDownloads({
          name: publisher,
          service: 'AUDIO',
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: readyStatus,
          title: audiobook.title || '',
          author: audiobook.publisher,
          mediaType: 'AUDIOBOOK',
        }));
      } else {
        console.error('[AudiobookDetail] Audio URL not found', { publisher, identifier });
        toast.error('Helifaili ei leitud. Proovi hiljem.');
        downloadVideo({
          name: publisher,
          service: 'AUDIO',
          identifier,
          title: audiobook.title || '',
          author: audiobook.publisher,
          id: identifier,
          mediaType: 'AUDIOBOOK',
        });
      }

      dispatch(setCurrentSong(identifier));
    } catch (playError) {
      console.error('Failed to play audiobook', playError);
      toast.error('Failed to start playback. Please try again.');
    }
  }, [dispatch, downloadVideo, downloads, identifier, audiobook, publisher]);

  const handleDownloadAudiobook = useCallback(async () => {
    if (!audiobook) return;

    try {
      const resolvedUrl =
        downloads[audiobook.id]?.url ||
        (await resolveAudioUrl(publisher, identifier));
      const readyStatus =
        resolvedUrl
          ? downloads[audiobook.id]?.status || audiobook.status || { status: 'READY', percentLoaded: 100 }
          : audiobook.status;

      if (!resolvedUrl) {
        console.error('[AudiobookDetail] Download URL not found', { publisher, identifier });
        toast.error('Helifaili ei leitud. Proovi hiljem.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download = buildDownloadFilename({
        preferredFilename: audiobook.audioFilename,
        title: audiobook.title,
        fallbackId: audiobook.id,
        resolvedUrl,
        mimeType: audiobook.audioMimeType,
      });
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Audiobook download started.');

      dispatch(setAddToDownloads({
        name: publisher,
        service: 'AUDIO',
        id: identifier,
        identifier,
        url: resolvedUrl,
        status: readyStatus,
        title: audiobook.title || '',
        author: audiobook.publisher,
        mediaType: 'AUDIOBOOK',
      }));
    } catch (downloadError) {
      console.error('Failed to download audiobook', downloadError);
      toast.error('Failed to download the audiobook.');
    }
  }, [downloads, identifier, audiobook, publisher]);

  const handleShareAudiobook = useCallback(async () => {
    if (!audiobook) return;

    try {
      const link = buildAudiobookShareUrl(publisher, identifier);
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
    } catch (shareError) {
      console.error('Failed to copy audiobook link', shareError);
      toast.error('Could not copy the link right now.');
    }
  }, [identifier, audiobook, publisher]);

  const handleSendTip = useCallback(() => {
    if (!username) {
      toast.error('Log in to send tips.');
      return;
    }

    if (!audiobook?.publisher) {
      toast.error('Creator information is missing.');
      return;
    }

    sendTipModal.open(audiobook.publisher);
  }, [audiobook?.publisher, sendTipModal, username]);

  const isOwner = useMemo(() => {
    if (!username || !audiobook?.publisher) return false;
    return username.toLowerCase() === audiobook.publisher.toLowerCase();
  }, [audiobook?.publisher, username]);

  const currentDownloadStatus = useMemo(
    () =>
      (identifier && downloads?.[identifier]?.status?.status) ||
      audiobook?.status?.status,
    [downloads, identifier, audiobook?.status?.status],
  );

  const publishedLabel = useMemo(() => {
    if (!audiobook) return null;
    const timestamp = audiobook.updated ?? audiobook.created;
    if (!timestamp) return null;
    return moment(timestamp).format('MMMM D, YYYY • HH:mm');
  }, [audiobook]);

  useEffect(() => {
    let cancelled = false;

    const loadLikeData = async () => {
      if (!identifier) {
        setAudiobookLikeCount(0);
        setHasAudiobookLike(false);
        return;
      }

      try {
        const count = await fetchAudiobookLikeCount(identifier);
        if (!cancelled) {
          setAudiobookLikeCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setAudiobookLikeCount(0);
        }
      }

      if (!username) {
        if (!cancelled) {
          setHasAudiobookLike(false);
        }
        return;
      }

      try {
        const liked = await hasUserLikedAudiobook(username, identifier);
        if (!cancelled) {
          setHasAudiobookLike(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasAudiobookLike(false);
        }
      }
    };

    loadLikeData();

    return () => {
      cancelled = true;
    };
  }, [identifier, username]);

  const handleToggleAudiobookLike = useCallback(async () => {
    if (!identifier || !audiobook?.publisher) return;

    if (!username) {
      toast.error('Log in to like audiobooks.');
      return;
    }

    if (isProcessingLike) return;

    try {
      setIsProcessingLike(true);
      if (hasAudiobookLike) {
        await unlikeAudiobook(username, identifier);
        setHasAudiobookLike(false);
        setAudiobookLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        toast.success(`Removed like from "${audiobook.title || 'this audiobook'}".`);
      } else {
        await likeAudiobook(username, audiobook);
        setHasAudiobookLike(true);
        setAudiobookLikeCount((prev) => (prev ?? 0) + 1);
        toast.success(`You liked "${audiobook.title || 'this audiobook'}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle audiobook like', error);
      toast.error('Could not update like. Please try again.');
    } finally {
      setIsProcessingLike(false);
    }
  }, [audiobook, hasAudiobookLike, identifier, isProcessingLike, username]);

  const favoriteAudiobookData: Song | null = useMemo(() => {
    if (!audiobook || !identifier) return null;
    return {
      id: identifier,
      title: audiobook.title,
      name: audiobook.publisher || publisher,
      author: audiobook.publisher || publisher,
      service: audiobook.service || 'AUDIO',
      status: audiobook.status,
      mediaType: 'AUDIOBOOK',
    };
  }, [audiobook, identifier, publisher]);

  const QuickActionWrapper: React.FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="group relative">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-900/50 bg-sky-950/80 px-3 py-1 text-xs font-medium text-sky-100 opacity-0 shadow-lg shadow-sky-950/50 transition group-hover:opacity-100">
        {label}
      </span>
    </div>
  );

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

  const infoEntries = useMemo(() => {
    if (!audiobook) return [];
    const entries: Array<{ key: string; value: string }> = [];

    if (audiobook.category) {
      entries.push({ key: 'Category', value: audiobook.category });
    }

    const sizeLabel = formatFileSize(audiobook.size);
    if (sizeLabel) {
      entries.push({ key: 'File Size', value: sizeLabel });
    }

    if (audiobook.audioMimeType) {
      entries.push({ key: 'Audio Type', value: audiobook.audioMimeType });
    }

    if (audiobook.audioFilename) {
      entries.push({ key: 'Audio File', value: audiobook.audioFilename });
    }

    if (audiobook.publisher) {
      entries.push({ key: 'Publisher', value: audiobook.publisher });
    }

    if (identifier) {
      entries.push({ key: 'Identifier', value: identifier });
    }

    if (audiobook.status?.status) {
      entries.push({ key: 'Status', value: audiobook.status.status });
    }

    if (audiobook.created) {
      entries.push({
        key: 'Created',
        value: moment(audiobook.created).format('MMM D, YYYY • HH:mm'),
      });
    }

    if (audiobook.updated && audiobook.updated !== audiobook.created) {
      entries.push({
        key: 'Last Updated',
        value: moment(audiobook.updated).format('MMM D, YYYY • HH:mm'),
      });
    }

    return entries;
  }, [identifier, audiobook]);

  const handleEditAudiobook = useCallback(() => {
    if (!audiobook) return;
    if (!isOwner) {
      toast.error('Only the original publisher can edit this audiobook.');
      return;
    }
    uploadAudiobookModal.openEdit(audiobook);
  }, [isOwner, audiobook, uploadAudiobookModal]);

  const canInteract = Boolean(audiobook) && !isLoading;

  const headerTitle = audiobook?.title || identifier || 'Audiobook detail';
  const headerSubtitle = audiobook?.publisher
    ? `Published by ${audiobook.publisher}${publishedLabel ? ` • ${publishedLabel}` : ''}`
    : publishedLabel
    ? `Published ${publishedLabel}`
    : 'Discover engaging audiobooks';

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{headerTitle}</h1>
            <p className="text-sky-300/80">{headerSubtitle}</p>
          </div>
          <p className="text-sm text-sky-200/70">
            Audiobooks now use the same quick actions as songs for consistency.
          </p>
        </div>
      </Header>

      <div className="mt-4 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-4 shadow-lg shadow-sky-950/30">
        <div className="flex flex-wrap items-center gap-4">
          <QuickActionButton
            icon={<FiPlay className="h-5 w-5" />}
            label={currentDownloadStatus === 'READY' ? 'Play Again' : 'Play This'}
            onClick={handlePlayAudiobook}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiThumbsUp className={`h-5 w-5 ${hasAudiobookLike ? 'text-emerald-300' : ''}`} />}
            label="Like It"
            onClick={handleToggleAudiobookLike}
            disabled={!canInteract || isProcessingLike}
            badge={typeof audiobookLikeCount === 'number' ? audiobookLikeCount : null}
          />
          <QuickActionButton
            icon={<RiHandCoinLine className="h-5 w-5" />}
            label="Send Tips To Publisher"
            onClick={handleSendTip}
            disabled={!canInteract}
          />
          {favoriteAudiobookData && (
            <QuickActionWrapper label="Add to Favorites">
              <LikeButton
                songId={favoriteAudiobookData.id}
                name={favoriteAudiobookData.name || publisher}
                service={favoriteAudiobookData.service || 'AUDIO'}
                songData={favoriteAudiobookData}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60"
                activeClassName="bg-emerald-600/10 border-emerald-400/70"
                inactiveClassName="bg-sky-950/30"
                iconSize={22}
                title="Add to Favorites"
                ariaLabel="Add to Favorites"
              />
            </QuickActionWrapper>
          )}
          {favoriteAudiobookData && (
            <QuickActionWrapper label="Add to Playlist">
              <AddToPlaylistButton
                song={favoriteAudiobookData}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60"
                iconSize={22}
              />
            </QuickActionWrapper>
          )}
          <QuickActionButton
            icon={<LuCopy className="h-5 w-5" />}
            label="Copy Link & Share It"
            onClick={handleShareAudiobook}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiDownload className="h-5 w-5" />}
            label="Download This"
            onClick={handleDownloadAudiobook}
            disabled={!canInteract}
          />
          {isOwner && audiobook && (
            <QuickActionButton
              icon={<FiEdit2 className="h-5 w-5" />}
              label="Edit"
              onClick={handleEditAudiobook}
            />
          )}
          <div className="ml-auto">
            <GoBackButton className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2 text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-500/60" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 text-sky-200/80">Loading audiobook information…</div>
      ) : error ? (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-900/30 px-4 py-6 text-center text-sm font-medium text-red-200">
          {error}
        </div>
      ) : !audiobook ? (
        <div className="mt-6 rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
          Audiobook details are unavailable.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
          <Box className="flex flex-col items-center gap-4 p-6">
            <img
              src={coverUrl}
              alt={`Cover art for ${audiobook.title}`}
              className="w-full rounded-lg border border-sky-900/60 object-cover"
            />
            <div className="w-full text-center md:text-left">
              <h2 className="text-xl font-semibold text-white">{audiobook.title}</h2>
              {audiobook.publisher && (
                <p className="mt-1 text-sm text-sky-200/80">
                  Published by{' '}
                  <span className="font-medium text-sky-100">{audiobook.publisher}</span>
                </p>
              )}
              {publishedLabel && (
                <p className="mt-1 text-xs text-sky-400/60">Updated {publishedLabel}</p>
              )}
            </div>
          </Box>

          <div className="flex flex-col gap-6">
            <Box className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Description</h3>
              {audiobook.description ? (
                <p className="whitespace-pre-line leading-relaxed text-sky-100/90">
                  {audiobook.description}
                </p>
              ) : (
                <p className="text-sm text-sky-200/70">
                  No description has been provided for this audiobook yet.
                </p>
              )}
            </Box>

            <Box className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Audiobook Details</h3>
              {infoEntries.length ? (
                <dl className="grid gap-2">
                  {infoEntries.map((entry) => (
                    <div
                      key={`${entry.key}-${entry.value}`}
                      className="grid grid-cols-[140px,1fr] gap-4"
                    >
                      <dt className="text-sm font-semibold uppercase tracking-wide text-sky-200/80">
                        {entry.key}
                      </dt>
                      <dd className="text-sm text-sky-100">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-sky-200/70">
                  No additional details are available for this audiobook.
                </p>
              )}
            </Box>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudiobookDetail;
