import React, { useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import GoBackButton from '../../components/GoBackButton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Podcast, Song } from '../../types';
import { fetchPodcastByIdentifier } from '../../services/podcasts';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPodcastShareUrl } from '../../utils/qortalLinks';
import { buildDownloadFilename } from '../../utils/downloadFilename';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { FiDownload, FiPlay, FiEdit2, FiThumbsUp } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import { RiHandCoinLine } from 'react-icons/ri';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';
import useUploadPodcastModal from '../../hooks/useUploadPodcastModal';
import { resolveAudioUrl } from '../../utils/resolveAudioUrl';
import useSendTipModal from '../../hooks/useSendTipModal';
import { AddToPlaylistButton } from '../../components/AddToPlayistButton';
import LikeButton from '../../components/LikeButton';
import { fetchPodcastLikeCount, hasUserLikedPodcast, likePodcast, unlikePodcast } from '../../services/podcastLikes';

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

const PodcastDetail: React.FC = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const uploadPodcastModal = useUploadPodcastModal();
  const sendTipModal = useSendTipModal();

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [podcastLikeCount, setPodcastLikeCount] = useState<number | null>(null);
  const [hasPodcastLike, setHasPodcastLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  const loadPodcast = useCallback(async () => {
    if (!publisher || !identifier) {
      setError('Podcast identifier is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const meta = await fetchPodcastByIdentifier(publisher, identifier);
      if (!meta) {
        setError('Podcast could not be found.');
        return;
      }
      setPodcast(meta);

      const artwork = await getQdnResourceUrl('THUMBNAIL', publisher, identifier);
      if (artwork) {
        setCoverUrl(artwork);
      }
    } catch (loadError) {
      console.error('Failed to load podcast', loadError);
      setError('Failed to load the podcast details.');
    } finally {
      setIsLoading(false);
    }
  }, [identifier, publisher]);

  useEffect(() => {
    loadPodcast();
  }, [loadPodcast]);

  const handlePlayPodcast = useCallback(async () => {
    if (!podcast) return;

    try {
      const existingDownload = downloads[podcast.id];
      const resolvedUrl =
        existingDownload?.url ||
        (await resolveAudioUrl(publisher, identifier));

      if (resolvedUrl) {
        const readyStatus =
          existingDownload?.status?.status === 'READY'
            ? existingDownload?.status
            : { ...(podcast.status ?? {}), status: 'READY', percentLoaded: 100 };
        dispatch(setAddToDownloads({
          name: publisher,
          service: 'AUDIO',
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: readyStatus,
          title: podcast.title || '',
          author: podcast.publisher,
          mediaType: 'PODCAST',
        }));
      } else {
        console.error('[PodcastDetail] Audio URL not found', { publisher, identifier });
        toast.error('Helifaili ei leitud. Proovi hiljem.');
        downloadVideo({
          name: publisher,
          service: 'AUDIO',
          identifier,
          title: podcast.title || '',
          author: podcast.publisher,
          id: identifier,
          mediaType: 'PODCAST',
        });
      }

      dispatch(setCurrentSong(identifier));
    } catch (playError) {
      console.error('Failed to play podcast', playError);
      toast.error('Failed to start playback. Please try again.');
    }
  }, [dispatch, downloadVideo, downloads, identifier, podcast, publisher]);

  const handleDownloadPodcast = useCallback(async () => {
    if (!podcast) return;

    try {
      const resolvedUrl =
        downloads[podcast.id]?.url ||
        (await resolveAudioUrl(publisher, identifier));
      const readyStatus =
        resolvedUrl
          ? downloads[podcast.id]?.status || podcast.status || { status: 'READY', percentLoaded: 100 }
          : podcast.status;

      if (!resolvedUrl) {
        console.error('[PodcastDetail] Download URL not found', { publisher, identifier });
        toast.error('Helifaili ei leitud. Proovi hiljem.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download = buildDownloadFilename({
        preferredFilename: podcast.audioFilename,
        title: podcast.title,
        fallbackId: podcast.id,
        resolvedUrl,
        mimeType: podcast.audioMimeType,
      });
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Podcast download started.');

      dispatch(setAddToDownloads({
        name: publisher,
        service: 'AUDIO',
        id: identifier,
        identifier,
        url: resolvedUrl,
        status: readyStatus,
        title: podcast.title || '',
        author: podcast.publisher,
        mediaType: 'PODCAST',
      }));
    } catch (downloadError) {
      console.error('Failed to download podcast', downloadError);
      toast.error('Failed to download the podcast.');
    }
  }, [downloads, identifier, podcast, publisher]);

  const handleSharePodcast = useCallback(async () => {
    if (!podcast) return;

    try {
      const link = buildPodcastShareUrl(publisher, identifier);
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
      console.error('Failed to copy podcast link', shareError);
      toast.error('Could not copy the link right now.');
    }
  }, [identifier, podcast, publisher]);

  const handleSendTip = useCallback(() => {
    if (!username) {
      toast.error('Log in to send tips.');
      return;
    }

    if (!podcast?.publisher) {
      toast.error('Creator information is missing.');
      return;
    }

    sendTipModal.open(podcast.publisher);
  }, [podcast?.publisher, sendTipModal, username]);

  const isOwner = useMemo(() => {
    if (!username || !podcast?.publisher) return false;
    return username.toLowerCase() === podcast.publisher.toLowerCase();
  }, [podcast?.publisher, username]);

  const currentDownloadStatus = useMemo(
    () =>
      (identifier && downloads?.[identifier]?.status?.status) ||
      podcast?.status?.status,
    [downloads, identifier, podcast?.status?.status],
  );

  const publishedLabel = useMemo(() => {
    if (!podcast) return null;
    const timestamp = podcast.updated ?? podcast.created;
    if (!timestamp) return null;
    return moment(timestamp).format('MMMM D, YYYY • HH:mm');
  }, [podcast]);

  useEffect(() => {
    let cancelled = false;

    const loadLikeData = async () => {
      if (!identifier) {
        setPodcastLikeCount(0);
        setHasPodcastLike(false);
        return;
      }

      try {
        const count = await fetchPodcastLikeCount(identifier);
        if (!cancelled) {
          setPodcastLikeCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setPodcastLikeCount(0);
        }
      }

      if (!username) {
        if (!cancelled) {
          setHasPodcastLike(false);
        }
        return;
      }

      try {
        const liked = await hasUserLikedPodcast(username, identifier);
        if (!cancelled) {
          setHasPodcastLike(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasPodcastLike(false);
        }
      }
    };

    loadLikeData();

    return () => {
      cancelled = true;
    };
  }, [identifier, username]);

  const handleTogglePodcastLike = useCallback(async () => {
    if (!identifier || !podcast?.publisher) return;

    if (!username) {
      toast.error('Log in to like podcasts.');
      return;
    }

    if (isProcessingLike) return;

    try {
      setIsProcessingLike(true);
      if (hasPodcastLike) {
        await unlikePodcast(username, identifier);
        setHasPodcastLike(false);
        setPodcastLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        toast.success(`Removed like from "${podcast.title || 'this podcast'}".`);
      } else {
        await likePodcast(username, podcast);
        setHasPodcastLike(true);
        setPodcastLikeCount((prev) => (prev ?? 0) + 1);
        toast.success(`You liked "${podcast.title || 'this podcast'}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle podcast like', error);
      toast.error('Could not update like. Please try again.');
    } finally {
      setIsProcessingLike(false);
    }
  }, [hasPodcastLike, identifier, isProcessingLike, podcast, username]);

  const favoritePodcastData: Song | null = useMemo(() => {
    if (!podcast || !identifier) return null;
    return {
      id: identifier,
      title: podcast.title,
      name: podcast.publisher || publisher,
      author: podcast.publisher || publisher,
      service: podcast.service || 'AUDIO',
      status: podcast.status,
      mediaType: 'PODCAST',
    };
  }, [identifier, podcast, publisher]);

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
    if (!podcast) return [];
    const entries: Array<{ key: string; value: string }> = [];

    if (podcast.category) {
      entries.push({ key: 'Category', value: podcast.category });
    }

    const sizeLabel = formatFileSize(podcast.size);
    if (sizeLabel) {
      entries.push({ key: 'File Size', value: sizeLabel });
    }

    if (podcast.audioMimeType) {
      entries.push({ key: 'Audio Type', value: podcast.audioMimeType });
    }

    if (podcast.audioFilename) {
      entries.push({ key: 'Audio File', value: podcast.audioFilename });
    }

    if (podcast.publisher) {
      entries.push({ key: 'Publisher', value: podcast.publisher });
    }

    if (identifier) {
      entries.push({ key: 'Identifier', value: identifier });
    }

    if (podcast.status?.status) {
      entries.push({ key: 'Status', value: podcast.status.status });
    }

    if (podcast.created) {
      entries.push({
        key: 'Created',
        value: moment(podcast.created).format('MMM D, YYYY • HH:mm'),
      });
    }

    if (podcast.updated && podcast.updated !== podcast.created) {
      entries.push({
        key: 'Last Updated',
        value: moment(podcast.updated).format('MMM D, YYYY • HH:mm'),
      });
    }

    return entries;
  }, [identifier, podcast]);

  const handleEditPodcast = useCallback(() => {
    if (!podcast) return;
    if (!isOwner) {
      toast.error('Only the original publisher can edit this podcast.');
      return;
    }
    uploadPodcastModal.openEdit(podcast);
  }, [isOwner, podcast, uploadPodcastModal]);

  const canInteract = Boolean(podcast) && !isLoading;

  const headerTitle = podcast?.title || identifier || 'Podcast detail';
  const headerSubtitle = podcast?.publisher
    ? `Published by ${podcast.publisher}${publishedLabel ? ` • ${publishedLabel}` : ''}`
    : publishedLabel
    ? `Published ${publishedLabel}`
    : 'Discover engaging podcasts';

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{headerTitle}</h1>
            <p className="text-sky-300/80">{headerSubtitle}</p>
          </div>
          <p className="text-sm text-sky-200/70">
            Podcasts are hosted via QDN. Enjoy the same controls as songs.
          </p>
        </div>
      </Header>

      <div className="mt-4 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-4 shadow-lg shadow-sky-950/30">
        <div className="flex flex-wrap items-center gap-4">
          <QuickActionButton
            icon={<FiPlay className="h-5 w-5" />}
            label={currentDownloadStatus === 'READY' ? 'Play Again' : 'Play This'}
            onClick={handlePlayPodcast}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiThumbsUp className={`h-5 w-5 ${hasPodcastLike ? 'text-emerald-300' : ''}`} />}
            label="Like It"
            onClick={handleTogglePodcastLike}
            disabled={!canInteract || isProcessingLike}
            badge={typeof podcastLikeCount === 'number' ? podcastLikeCount : null}
          />
          <QuickActionButton
            icon={<RiHandCoinLine className="h-5 w-5" />}
            label="Send Tips To Publisher"
            onClick={handleSendTip}
            disabled={!canInteract}
          />
          {favoritePodcastData && (
            <QuickActionWrapper label="Add to Favorites">
              <LikeButton
                songId={favoritePodcastData.id}
                name={favoritePodcastData.name || publisher}
                service={favoritePodcastData.service || 'AUDIO'}
                songData={favoritePodcastData}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60"
                activeClassName="bg-emerald-600/10 border-emerald-400/70"
                inactiveClassName="bg-sky-950/30"
                iconSize={22}
                title="Add to Favorites"
                ariaLabel="Add to Favorites"
              />
            </QuickActionWrapper>
          )}
          {favoritePodcastData && (
            <QuickActionWrapper label="Add to Playlist">
              <AddToPlaylistButton
                song={favoritePodcastData}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-900/60 bg-sky-950/30 text-white transition hover:-translate-y-0.5 hover:border-sky-500/60"
                iconSize={22}
              />
            </QuickActionWrapper>
          )}
          <QuickActionButton
            icon={<LuCopy className="h-5 w-5" />}
            label="Copy Link & Share It"
            onClick={handleSharePodcast}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiDownload className="h-5 w-5" />}
            label="Download This"
            onClick={handleDownloadPodcast}
            disabled={!canInteract}
          />
          {isOwner && podcast && (
            <QuickActionButton
              icon={<FiEdit2 className="h-5 w-5" />}
              label="Edit"
              onClick={handleEditPodcast}
            />
          )}
          <div className="ml-auto">
            <GoBackButton className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2 text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-500/60" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 text-sky-200/80">Loading podcast information…</div>
      ) : error ? (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-900/30 px-4 py-6 text-center text-sm font-medium text-red-200">
          {error}
        </div>
      ) : !podcast ? (
        <div className="mt-6 rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
          Podcast details are unavailable.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
          <Box className="flex flex-col items-center gap-4 p-6">
            <img
              src={coverUrl}
              alt={`Cover art for ${podcast.title}`}
              className="w-full rounded-lg border border-sky-900/60 object-cover"
            />
            <div className="w-full text-center md:text-left">
              <h2 className="text-xl font-semibold text-white">{podcast.title}</h2>
              {podcast.publisher && (
                <p className="mt-1 text-sm text-sky-200/80">
                  Published by{' '}
                  <span className="font-medium text-sky-100">{podcast.publisher}</span>
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
              {podcast.description ? (
                <p className="whitespace-pre-line leading-relaxed text-sky-100/90">
                  {podcast.description}
                </p>
              ) : (
                <p className="text-sm text-sky-200/70">
                  No description has been provided for this podcast yet.
                </p>
              )}
            </Box>

            <Box className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Podcast Details</h3>
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
                  No additional details are available for this podcast.
                </p>
              )}
            </Box>
          </div>
        </div>
      )}
    </div>
  );
};

export default PodcastDetail;
