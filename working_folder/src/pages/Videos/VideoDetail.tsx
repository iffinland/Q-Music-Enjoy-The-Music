import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Box from '../../components/Box';
import Button from '../../components/Button';
import GoBackButton from '../../components/GoBackButton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Video } from '../../types';
import { fetchVideoByIdentifier } from '../../services/videos';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import { buildVideoShareUrl } from '../../utils/qortalLinks';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { FiDownload, FiPlay, FiShare2 } from 'react-icons/fi';
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
      const isFavorite = Boolean(favorites.songs?.[video.id]);
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
  }, [dispatch, favorites, video]);

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

  return (
    <div className="px-4 py-6">
      <Header>
        <div className="flex items-center gap-3">
          <GoBackButton className="bg-sky-900/60 text-sky-100 hover:bg-sky-800/80 md:w-auto" label="Go Back" />
          <h1 className="text-3xl font-bold text-white">Video detail</h1>
        </div>
      </Header>

      <div className="mt-6 flex flex-col gap-6">
        <Box className="p-6">
          {isLoadingVideo ? (
            <p className="text-sky-200/80">Loading video information…</p>
          ) : videoError ? (
            <div className="rounded-md border border-red-500/40 bg-red-900/30 px-4 py-6 text-center text-sm font-medium text-red-200">
              {videoError}
            </div>
          ) : !video ? (
            <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
              Video details are unavailable.
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="w-full max-w-[360px] overflow-hidden rounded-xl border border-sky-900/60 shadow-inner">
                <div className="relative w-full bg-black">
                  {isLoadingUrl ? (
                    <div className="flex h-52 items-center justify-center text-sm font-semibold text-sky-200/80">
                      Preparing video stream…
                    </div>
                  ) : videoUrl ? (
                    <video
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

              <div className="flex flex-1 flex-col gap-4">
                <div className="space-y-2">
                  {artistOrBand && (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                        Artist / Band
                      </p>
                      <p className="text-xl font-semibold text-white">
                        {artistOrBand}
                      </p>
                    </>
                  )}
                  <h2 className="text-2xl font-semibold text-sky-100">
                    {video.title}
                  </h2>
                  <p className="text-sm font-medium uppercase tracking-wide text-sky-400">
                    Published {moment(video.updated ?? video.created).format('MMM D, YYYY • HH:mm')} by {video.publisher}
                  </p>
                </div>

                {video.description && (
                  <p className="text-sky-100/90 leading-relaxed whitespace-pre-line">
                    {video.description}
                  </p>
                )}

                {(video.author || video.genre || video.mood || video.language || video.notes) && (
                  <div className="rounded-lg border border-sky-900/60 bg-sky-950/50 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300/80">
                      Additional details
                    </h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => videoUrl ? undefined : toast('Video preview unavailable, try downloading instead.', { icon: 'ℹ️' })}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 md:w-auto"
                  >
                    <FiPlay />
                    {videoUrl ? 'Play inline' : 'Play'}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDownloadVideo}
                    className="flex items-center gap-2 border border-sky-700 bg-sky-900/40 text-white hover:bg-sky-800/60 md:w-auto"
                  >
                    <FiDownload />
                    Download
                  </Button>
                  <Button
                    type="button"
                    onClick={handleShareVideo}
                    className="flex items-center gap-2 border border-sky-700 bg-sky-900/40 text-white hover:bg-sky-800/60 md:w-auto"
                  >
                    <FiShare2 />
                    Share
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFavoriteVideo}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      favorites?.songs?.[video.id]
                        ? 'border-sky-400 bg-sky-800/70 text-white'
                        : 'border-sky-800/80 bg-sky-950/60 text-sky-200 hover:border-sky-500 hover:text-white'
                    }`}
                  >
                    {favorites?.songs?.[video.id] ? 'Remove from favorites' : 'Add to favorites'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLikeVideo}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isLiked
                        ? 'border-sky-400 bg-sky-800/70 text-white'
                        : 'border-sky-800/80 bg-sky-950/60 text-sky-200 hover:border-sky-500 hover:text-white'
                    }`}
                  >
                    {isLiked ? 'Unlike' : 'Like'} ({likeCount})
                  </button>
                </div>
              </div>
            </div>
          )}
        </Box>
      </div>
    </div>
  );
};

export default VideoDetail;
