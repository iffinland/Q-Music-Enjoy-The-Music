import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import GoBackButton from '../../components/GoBackButton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Video } from '../../types';
import { fetchVideoByIdentifier } from '../../services/videos';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildVideoShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';
import { FiDownload, FiPlay, FiThumbsUp } from 'react-icons/fi';
import { LuCopy } from 'react-icons/lu';
import {
  Favorites,
  removeFavSong,
  setFavSong,
} from '../../state/features/globalSlice';
import {
  fetchVideoLikeCount,
  hasUserLikedVideo,
  likeVideo,
  unlikeVideo,
} from '../../services/videoLikes';
import localforage from 'localforage';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites',
});

const DEFAULT_COVER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="100%25" height="100%25" fill="%230b2137"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" fill="%2355a8ff" font-size="28" font-family="Arial" text-anchor="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';

const VideoDetail: React.FC = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const favorites = useSelector((state: RootState) => state.global.favorites);

  const publisher = useMemo(() => decodeURIComponent(params.publisher || ''), [params.publisher]);
  const identifier = useMemo(() => decodeURIComponent(params.identifier || ''), [params.identifier]);

  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const artistOrBand = useMemo(() => {
    if (!video) return null;
    const fromAuthor = typeof video.author === 'string' ? video.author.trim() : '';
    return fromAuthor.length > 0 ? fromAuthor : null;
  }, [video]);

  useEffect(() => {
    const loadVideo = async () => {
      if (!publisher || !identifier) {
        setVideoError('Video identifier is missing.');
        setIsLoadingVideo(false);
        return;
      }

      setIsLoadingVideo(true);
      setVideoError(null);

      try {
        const meta = await fetchVideoByIdentifier(publisher, identifier);
        if (!meta) {
          setVideoError('Video could not be found.');
          return;
        }
        setVideo(meta);

        if (meta.coverImage) {
          setCoverUrl(meta.coverImage);
        } else {
          const artwork = await getQdnResourceUrl('THUMBNAIL', publisher, identifier);
          if (artwork) {
            setCoverUrl(artwork);
          }
        }
      } catch (error) {
        console.error('Failed to load video details', error);
        setVideoError('Failed to load the video details.');
      } finally {
        setIsLoadingVideo(false);
      }
    };

    loadVideo();
  }, [identifier, publisher]);

  useEffect(() => {
    const loadVideoUrl = async () => {
      if (!video) return;

      setIsLoadingUrl(true);
      try {
        const resolvedUrl = await getQdnResourceUrl('VIDEO', publisher, identifier);
        if (resolvedUrl) {
          setVideoUrl(resolvedUrl);
        } else {
          setVideoUrl(null);
        }
      } catch (error) {
        console.error('Failed to resolve video URL', error);
        setVideoUrl(null);
      } finally {
        setIsLoadingUrl(false);
      }
    };

    loadVideoUrl();
  }, [identifier, publisher, video]);

  useEffect(() => {
    const loadLikeInfo = async () => {
      if (!video) return;
      try {
        const [count, liked] = await Promise.all([
          fetchVideoLikeCount(video.id),
          username ? hasUserLikedVideo(username, video.id) : Promise.resolve(false),
        ]);
        setLikeCount(count);
        setIsLiked(liked);
      } catch (error) {
        console.error('Failed to load video like info', error);
      }
    };

    loadLikeInfo();
  }, [video, username]);

  const isFavorite = useMemo(() => Boolean(video && favorites?.songs?.[video.id]), [favorites?.songs, video]);

  const handlePlayVideo = useCallback(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.play();
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    toast.error('Video stream is not ready yet. Please try downloading instead.');
  }, [videoUrl]);

  const publishedLabel = useMemo(() => {
    if (!video) return null;
    return moment(video.updated ?? video.created).format('MMM D, YYYY • HH:mm');
  }, [video]);

  const QuickActionWrapper: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="group relative">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-900/50 bg-sky-950/80 px-3 py-1 text-xs font-medium text-sky-100 opacity-0 shadow-lg shadow-sky-950/50 transition group-hover:opacity-100">
        {label}
      </span>
    </div>
  );

  const QuickActionButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    badge?: React.ReactNode;
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

  const handleShareVideo = useCallback(async () => {
    if (!video) return;

    try {
      const link = buildVideoShareUrl(publisher, identifier);
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
      console.error('Failed to copy video link', error);
      toast.error('Could not copy the link right now.');
    }
  }, [identifier, publisher, video]);

  const handleDownloadVideo = useCallback(async () => {
    if (!video) return;

    try {
      const resolvedUrl = await getQdnResourceUrl('VIDEO', publisher, identifier);

      if (!resolvedUrl) {
        toast.error('Unable to locate the video file right now.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download =
        video.videoFilename ||
        `${video.title?.replace(/\s+/g, '_') || video.id}.mp4`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Video download started.');
    } catch (error) {
      console.error('Failed to download video', error);
      toast.error('Failed to download the video.');
    }
  }, [identifier, publisher, video]);

  const handleFavoriteVideo = useCallback(async () => {
    if (!video) return;
    if (!favorites) {
      toast.error('Favorites are not ready yet. Please try again in a moment.');
      return;
    }

    try {
      const songData = {
        id: video.id,
        title: video.title,
        name: video.publisher,
        service: 'VIDEO',
        author: video.author || video.publisher,
      };

      const storedFavorites = (await favoritesStorage.getItem<Favorites>('favorites')) || {
        songs: {},
        playlists: {},
      };

      if (isFavorite) {
        dispatch(removeFavSong({
          identifier: video.id,
          name: video.publisher,
          service: 'VIDEO',
        }));
        if (storedFavorites.songs?.[video.id]) {
          delete storedFavorites.songs[video.id];
        }
        await favoritesStorage.setItem('favorites', storedFavorites);
        toast.success('Video removed from favorites.');
      } else {
        dispatch(setFavSong({
          identifier: video.id,
          name: video.publisher,
          service: 'VIDEO',
          songData,
        }));
        storedFavorites.songs = storedFavorites.songs || {};
        storedFavorites.songs[video.id] = {
          identifier: video.id,
          name: video.publisher,
          service: 'VIDEO',
        };
        await favoritesStorage.setItem('favorites', storedFavorites);
        toast.success('Video added to favorites!');
      }
    } catch (error) {
      console.error('Failed to toggle video favorite', error);
      toast.error('Could not update favorites. Please try again.');
    }
  }, [dispatch, favorites, isFavorite, video]);

  const handleLikeVideo = useCallback(async () => {
    if (!video) return;
    if (!username) {
      toast.error('Log in to like videos.');
      return;
    }

    try {
      if (isLiked) {
        await unlikeVideo(username, video.id);
        setIsLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
        toast.success(`Removed like from "${video.title}".`);
      } else {
        await likeVideo(username, video);
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
        toast.success(`You liked "${video.title}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle video like', error);
      toast.error('Could not update like. Please try again.');
    }
  }, [isLiked, username, video]);

  const headerTitle = video?.title || identifier || 'Video detail';
  const headerSubtitle = video?.publisher
    ? `Published by ${video.publisher}${publishedLabel ? ` • ${publishedLabel}` : ''}`
    : publishedLabel
    ? `Published ${publishedLabel}`
    : 'Discover videos on Q-Music';
  const canInteract = Boolean(video) && !isLoadingVideo;

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{headerTitle}</h1>
            <p className="text-sky-300/80">{headerSubtitle}</p>
          </div>
        </div>
      </Header>

      <div className="mt-4 rounded-2xl border border-sky-900/50 bg-sky-950/40 p-4 shadow-lg shadow-sky-950/30">
        <div className="flex flex-wrap items-center gap-4">
          <QuickActionButton
            icon={<FiPlay className="h-5 w-5" />}
            label={videoUrl ? 'Play This' : 'Prepare Stream'}
            onClick={handlePlayVideo}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiThumbsUp className={`h-5 w-5 ${isLiked ? 'text-emerald-300' : ''}`} />}
            label="Like It"
            onClick={handleLikeVideo}
            disabled={!canInteract}
            badge={likeCount}
          />
          <QuickActionButton
            icon={
              isFavorite ? (
                <AiFillHeart className="h-5 w-5 text-emerald-300" />
              ) : (
                <AiOutlineHeart className="h-5 w-5" />
              )
            }
            label={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            onClick={handleFavoriteVideo}
            disabled={!canInteract || !favorites}
          />
          <QuickActionButton
            icon={<LuCopy className="h-5 w-5" />}
            label="Copy Link & Share It"
            onClick={handleShareVideo}
            disabled={!canInteract}
          />
          <QuickActionButton
            icon={<FiDownload className="h-5 w-5" />}
            label="Download This"
            onClick={handleDownloadVideo}
            disabled={!canInteract}
          />
          <div className="ml-auto">
            <GoBackButton className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2 text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-500/60" />
          </div>
        </div>
      </div>

      {isLoadingVideo ? (
        <div className="mt-6 text-sky-200/80">Loading video information…</div>
      ) : videoError ? (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-900/30 px-4 py-6 text-center text-sm font-medium text-red-200">
          {videoError}
        </div>
      ) : !video ? (
        <div className="mt-6 rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
          Video details are unavailable.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[360px,1fr]">
          <Box className="flex flex-col gap-4 p-4">
            <div className="overflow-hidden rounded-lg border border-sky-900/60 shadow-inner">
              <div className="relative w-full bg-black">
                {isLoadingUrl ? (
                  <div className="flex h-52 items-center justify-center text-sm font-semibold text-sky-200/80">
                    Preparing video stream…
                  </div>
                ) : videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="h-full w-full bg-black"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={coverUrl}
                    alt={`Cover for ${video.title}`}
                    className="h-52 w-full object-cover"
                  />
                )}
              </div>
            </div>
            <div className="w-full text-center md:text-left">
              {artistOrBand && (
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                  Artist / Band
                </p>
              )}
              <h2 className="text-xl font-semibold text-white">
                {artistOrBand || video.title}
              </h2>
              <p className="text-sm font-medium uppercase tracking-wide text-sky-400">
                {publishedLabel ? `Published ${publishedLabel}` : 'Published'} by {video.publisher}
              </p>
            </div>
          </Box>

          <div className="flex flex-col gap-6">
            <Box className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Description</h3>
              {video.description ? (
                <p className="text-sky-100/90 leading-relaxed whitespace-pre-line">
                  {video.description}
                </p>
              ) : (
                <p className="text-sm text-sky-200/70">
                  No description has been provided for this video yet.
                </p>
              )}
            </Box>

            {(video.author || video.genre || video.mood || video.language || video.notes) && (
              <Box className="p-6">
                <h3 className="mb-3 text-lg font-semibold text-white">Additional details</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {video.author && (
                    <div>
                      <p className="text-xs font-medium uppercase text-sky-400">Artist or band</p>
                      <p className="text-sm text-sky-100/90">{video.author}</p>
                    </div>
                  )}
                  {video.genre && (
                    <div>
                      <p className="text-xs font-medium uppercase text-sky-400">Genre</p>
                      <p className="text-sm text-sky-100/90">{video.genre}</p>
                    </div>
                  )}
                  {video.mood && (
                    <div>
                      <p className="text-xs font-medium uppercase text-sky-400">Mood</p>
                      <p className="text-sm text-sky-100/90">{video.mood}</p>
                    </div>
                  )}
                  {video.language && (
                    <div>
                      <p className="text-xs font-medium uppercase text-sky-400">Language</p>
                      <p className="text-sm text-sky-100/90">{video.language}</p>
                    </div>
                  )}
                  {video.notes && (
                    <div className="md:col-span-2">
                      <p className="text-xs font-medium uppercase text-sky-400">Notes</p>
                      <p className="text-sm text-sky-100/90 whitespace-pre-line">{video.notes}</p>
                    </div>
                  )}
                </div>
              </Box>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDetail;
