import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import Button from '../../components/Button';
import GoBackButton from '../../components/GoBackButton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Audiobook } from '../../types';
import { fetchAudiobookByIdentifier } from '../../services/audiobooks';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildAudiobookShareUrl } from '../../utils/qortalLinks';
import { buildDownloadFilename } from '../../utils/downloadFilename';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { FiDownload, FiPlay, FiShare2, FiEdit2 } from 'react-icons/fi';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { setAddToDownloads, setCurrentPlaylist, setCurrentSong, setNowPlayingPlaylist } from '../../state/features/globalSlice';
import useUploadAudiobookModal from '../../hooks/useUploadAudiobookModal';

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

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [audiobook, setAudiobook] = useState<Audiobook | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      const service = 'AUDIO';
      const existingDownload = downloads[audiobook.id];
      const resolvedUrl =
        existingDownload?.url ||
        (await getQdnResourceUrl(service, publisher, identifier));

      if (resolvedUrl) {
        dispatch(setAddToDownloads({
          name: publisher,
          service,
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: audiobook.status,
          title: audiobook.title || '',
          author: audiobook.publisher,
        }));
      } else {
        downloadVideo({
          name: publisher,
          service,
          identifier,
          title: audiobook.title || '',
          author: audiobook.publisher,
          id: identifier,
        });
      }

      dispatch(setCurrentSong(identifier));
      dispatch(setCurrentPlaylist('nowPlayingPlaylist'));
      dispatch(setNowPlayingPlaylist([{
        id: audiobook.id,
        title: audiobook.title,
        name: audiobook.publisher,
        author: audiobook.publisher,
        service,
      }]));
    } catch (playError) {
      console.error('Failed to play audiobook', playError);
      toast.error('Failed to start playback. Please try again.');
    }
  }, [dispatch, downloadVideo, downloads, identifier, audiobook, publisher]);

  const handleDownloadAudiobook = useCallback(async () => {
    if (!audiobook) return;

    try {
      const service = 'AUDIO';
      const resolvedUrl =
        downloads[audiobook.id]?.url ||
        (await getQdnResourceUrl(service, publisher, identifier));

      if (!resolvedUrl) {
        toast.error('Unable to locate the audiobook file right now.');
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
        <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{headerTitle}</h1>
            <p className="text-sky-300/80">{headerSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handlePlayAudiobook}
              disabled={!canInteract}
              className="flex items-center justify-center gap-2 rounded-md bg-emerald-500/90 px-5 py-2 text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlay />
              {currentDownloadStatus === 'READY' ? 'Play again' : 'Play audiobook'}
            </Button>
            <Button
              type="button"
              onClick={handleDownloadAudiobook}
              disabled={!canInteract}
              className="flex items-center justify-center gap-2 rounded-md border border-sky-700/60 bg-sky-900/40 px-5 py-2 text-white transition hover:bg-sky-800/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiDownload />
              Download
            </Button>
            <Button
              type="button"
              onClick={handleShareAudiobook}
              disabled={!canInteract}
              className="flex items-center justify-center gap-2 rounded-md bg-sky-700/80 px-5 py-2 text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiShare2 />
              Share
            </Button>
            {isOwner && audiobook && (
              <Button
                type="button"
                onClick={handleEditAudiobook}
                className="flex items-center justify-center gap-2 rounded-md border border-sky-700/60 bg-sky-900/60 px-5 py-2 text-sky-100 transition hover:bg-sky-800/60"
              >
                <FiEdit2 />
                Edit
              </Button>
            )}
            <GoBackButton className="bg-slate-900/50 border border-sky-900/60 px-5 py-2 text-sky-200/80 hover:bg-slate-900/40" />
          </div>
        </div>
      </Header>

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
