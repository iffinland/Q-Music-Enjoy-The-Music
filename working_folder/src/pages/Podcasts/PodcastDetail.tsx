import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import Button from '../../components/Button';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Podcast } from '../../types';
import { fetchPodcastByIdentifier } from '../../services/podcasts';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildPodcastShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { FiDownload, FiPlay, FiShare2, FiArrowLeft } from 'react-icons/fi';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { setAddToDownloads, setCurrentSong } from '../../state/features/globalSlice';

const DEFAULT_COVER =
  'data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"400\"%3E%3Crect width=\"100%25\" height=\"100%25\" fill=\"%230b2137\"%3E%3C/rect%3E%3Ctext x=\"50%25\" y=\"50%25\" fill=\"%2355a8ff\" font-size=\"28\" font-family=\"Arial\" text-anchor=\"middle\"%3ENo Cover%3C/text%3E%3C/svg%3E';

const PodcastDetail: React.FC = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        (await getQdnResourceUrl('AUDIO', publisher, identifier));

      if (resolvedUrl) {
        dispatch(setAddToDownloads({
          name: publisher,
          service: 'AUDIO',
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: podcast.status,
          title: podcast.title || '',
          author: podcast.publisher,
        }));
      } else {
        downloadVideo({
          name: publisher,
          service: 'AUDIO',
          identifier,
          title: podcast.title || '',
          author: podcast.publisher,
          id: identifier,
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
        (await getQdnResourceUrl('AUDIO', publisher, identifier));

      if (!resolvedUrl) {
        toast.error('Unable to locate the podcast file right now.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download =
        podcast.audioFilename ||
        `${podcast.title?.replace(/\s+/g, '_') || podcast.id}.audio`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Podcast download started.');
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

  const handleGoBack = useCallback(() => {
    navigate('/podcasts');
  }, [navigate]);

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleGoBack}
            className="flex items-center gap-2 bg-sky-900/60 text-sky-100 hover:bg-sky-800/80"
          >
            <FiArrowLeft />
            Back to podcasts
          </Button>
          <h1 className="text-3xl font-bold text-white">Podcast detail</h1>
        </div>
      </Header>

      <div className="mt-6 flex flex-col gap-6">
        <Box className="p-6">
          {isLoading ? (
            <p className="text-sky-200/80">Loading podcast information…</p>
          ) : error ? (
            <div className="rounded-md border border-red-500/40 bg-red-900/30 px-4 py-6 text-center text-sm font-medium text-red-200">
              {error}
            </div>
          ) : !podcast ? (
            <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
              Podcast details are unavailable.
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="w-full max-w-[320px] overflow-hidden rounded-xl border border-sky-900/60 shadow-inner">
                <img
                  src={coverUrl}
                  alt={`Cover art for ${podcast.title}`}
                  className="w-full object-cover"
                />
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">{podcast.title}</h2>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-sky-400">
                    Published {moment(podcast.updated ?? podcast.created).format('MMM D, YYYY • HH:mm')} by {podcast.publisher}
                  </p>
                </div>

                {podcast.description && (
                  <p className="text-sky-100/90 leading-relaxed whitespace-pre-line">
                    {podcast.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={handlePlayPodcast}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400"
                  >
                    <FiPlay />
                    Play podcast
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDownloadPodcast}
                    className="flex items-center gap-2 border border-sky-700 bg-sky-900/40 text-white hover:bg-sky-800/60"
                  >
                    <FiDownload />
                    Download
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSharePodcast}
                    className="flex items-center gap-2 border border-sky-700 bg-sky-900/40 text-white hover:bg-sky-800/60"
                  >
                    <FiShare2 />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Box>
      </div>
    </div>
  );
};

export default PodcastDetail;
