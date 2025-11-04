import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Header from '../../components/Header';
import Box from '../../components/Box';
import { VideoToolbar, VideoSortOrder } from '../../components/videos/VideoToolbar';
import VideoAlphabetFilter from '../../components/videos/VideoAlphabetFilter';
import VideoCard from '../../components/videos/VideoCard';
import VideoPlayerOverlay from '../../components/videos/VideoPlayerOverlay';
import { enrichVideosWithDocuments, fetchVideos } from '../../services/videos';
import { Song, Video } from '../../types';
import { CircularProgress } from '@mui/material';
import useUploadVideoModal from '../../hooks/useUploadVideoModal';
import useSendTipModal from '../../hooks/useSendTipModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import { toast } from 'react-hot-toast';
import { buildVideoShareUrl } from '../../utils/qortalLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Favorites, removeFavSong, setFavSong } from '../../state/features/globalSlice';
import { deleteHostedData, deleteQdnResource, getQdnResourceUrl } from '../../utils/qortalApi';
import { MyContext } from '../../wrappers/DownloadWrapper';
import localforage from 'localforage';
import {
  fetchVideoLikeCount,
  fetchVideoLikeCounts,
  haveUsersLikedVideos,
  hasUserLikedVideo,
  likeVideo as publishVideoLike,
  unlikeVideo,
} from '../../services/videoLikes';
import { MUSIC_CATEGORIES } from '../../constants/categories';
import SortControls from '../../components/common/SortControls';

const PAGE_SIZE = 24;
const SLOGAN = 'Discover community-created videos and share new stories.';
const VIDEO_UNCATEGORIZED = 'Uncategorized';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites',
});

const Videos: React.FC = () => {
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const { downloadVideo } = useContext(MyContext);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<VideoSortOrder>('newest');
  const [activeLetter, setActiveLetter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [highlightedVideoId, setHighlightedVideoId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const uploadVideoModal = useUploadVideoModal();
  const location = useLocation();
  const navigate = useNavigate();
  const [sharedVideoId, setSharedVideoId] = useState<string | null>(null);
  const sharedHandledRef = useRef<boolean>(false);
  const favorites = useSelector((state: RootState) => state.global.favorites);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByUser, setLikedByUser] = useState<Record<string, boolean>>({});
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerVideo, setPlayerVideo] = useState<Video | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const videoFetchToastId = useRef<string | null>(null);
  const sendTipModal = useSendTipModal();
  const addSongToPlaylistModal = useAddSongToPlaylistModal();

  const dismissVideoFetchToast = useCallback(() => {
    if (videoFetchToastId.current) {
      toast.dismiss(videoFetchToastId.current);
      videoFetchToastId.current = null;
    }
  }, []);

  const hydrationRunRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const runId = hydrationRunRef.current + 1;
    hydrationRunRef.current = runId;

    try {
      const data = await fetchVideos({ hydrate: false });

      if (!isMountedRef.current || hydrationRunRef.current !== runId) {
        return;
      }

      setVideos(data);
      setIsLoading(false);

      enrichVideosWithDocuments(data, 6, 48)
        .then(() => {
          if (!isMountedRef.current || hydrationRunRef.current !== runId) {
            return;
          }
          setVideos((prev) => [...prev]);
        })
        .catch((error) => {
          console.error('Failed to hydrate videos', error);
        });
    } catch (err) {
      console.error(err);
      if (!isMountedRef.current || hydrationRunRef.current !== runId) {
        return;
      }
      setError('Failed to load videos. Please try again in a moment.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    return () => {
      dismissVideoFetchToast();
    };
  }, [dismissVideoFetchToast]);

  useEffect(() => {
    const handleRefresh = () => {
      loadVideos();
    };

    window.addEventListener('videos:refresh', handleRefresh);
    return () => {
      window.removeEventListener('videos:refresh', handleRefresh);
    };
  }, [loadVideos]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetVideo = params.get('video');
    if (targetVideo) {
      setSharedVideoId(targetVideo);
    }
  }, [location.search]);

  useEffect(() => {
    if (!sharedVideoId || sharedHandledRef.current) return;
    if (videos.length === 0) return;

    sharedHandledRef.current = true;
    setActiveLetter('ALL');

    const index = videos.findIndex((video) => video.id === sharedVideoId);
    if (index !== -1) {
      const page = Math.floor(index / PAGE_SIZE) + 1;
      setCurrentPage(page);
      setHighlightedVideoId(sharedVideoId);

      requestAnimationFrame(() => {
        const element = document.getElementById(`video-${sharedVideoId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const params = new URLSearchParams(location.search);
    params.delete('video');
    params.delete('videoPublisher');
    params.delete('type');
    const search = params.toString();
    navigate(`/videos${search ? `?${search}` : ''}`, { replace: true });
  }, [sharedVideoId, videos, location.search, navigate]);

  useEffect(() => {
    if (!highlightedVideoId) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightedVideoId(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedVideoId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeLetter, sortOrder, selectedCategory]);

  useEffect(() => {
    setActiveLetter('ALL');
  }, [selectedCategory]);

  const getVideoCategory = useCallback((video: Video): string | null => {
    const candidate =
      video.genre ||
      (video as any)?.category ||
      (video as any)?.categoryName ||
      video.mood ||
      null;
    if (!candidate || typeof candidate !== 'string') return null;
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const sortedVideos = useMemo(() => {
    const collection = [...videos];

    collection.sort((a, b) => {
      const aTimestamp = a.updated ?? a.created ?? 0;
      const bTimestamp = b.updated ?? b.created ?? 0;

      if (sortOrder === 'newest') {
        return bTimestamp - aTimestamp;
      }

      return aTimestamp - bTimestamp;
    });

    return collection;
  }, [videos, sortOrder]);

  const categoryFilteredVideos = useMemo(() => {
    if (selectedCategory === 'ALL') return sortedVideos;
    return sortedVideos.filter((video) => {
      const category = getVideoCategory(video) ?? VIDEO_UNCATEGORIZED;
      return category.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [sortedVideos, selectedCategory, getVideoCategory]);

  const filteredVideos = useMemo(() => {
    if (activeLetter === 'ALL') {
      return categoryFilteredVideos;
    }

    return categoryFilteredVideos.filter((video) =>
      (video.title || '')
        .trim()
        .toUpperCase()
        .startsWith(activeLetter.toUpperCase())
    );
  }, [categoryFilteredVideos, activeLetter]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedVideos = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return filteredVideos.slice(startIndex, endIndex);
  }, [filteredVideos, currentPage]);

  const lastVideoIdsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (videos.length === 0) {
      lastVideoIdsKeyRef.current = null;
      setLikeCounts({});
      setLikedByUser({});
      return;
    }

    const videoIds = videos.map((video) => video.id);
    const videoIdsKey = `${videoIds.join('|')}::${username ?? ''}`;
    if (lastVideoIdsKeyRef.current === videoIdsKey) {
      return;
    }

    lastVideoIdsKeyRef.current = videoIdsKey;

    const loadLikes = async () => {
      try {
        const [counts, userLikes] = await Promise.all([
          fetchVideoLikeCounts(videoIds),
          username ? haveUsersLikedVideos(username, videoIds) : Promise.resolve({}),
        ]);
        setLikeCounts(counts);
        setLikedByUser(userLikes);
      } catch (error) {
        console.error('Failed to load video likes', error);
      }
    };

    loadLikes();
  }, [videos, username]);

  const handleSelectLetter = useCallback((letter: string) => {
    setActiveLetter(letter);
  }, []);

  const handleChangePage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }, [totalPages]);

  const handleShareVideo = useCallback(async (video: Video) => {
    try {
      const shareLink = buildVideoShareUrl(video.publisher, video.id);

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareLink;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      toast.success('Video link copied! Happy sharing!');
    } catch (error) {
      console.error('Failed to copy video link', error);
      toast.error('Failed to copy the link. Please try again.');
    }
  }, []);

  const handlePlayVideo = useCallback(async (video: Video) => {
    dismissVideoFetchToast();
    setPlayerVideo(video);
    setPlayerUrl(null);
    setPlayerError(null);
    setIsPlayerOpen(true);
    setIsPlayerLoading(true);

    try {
      const resolvedUrl = await getQdnResourceUrl('VIDEO', video.publisher, video.id);

      if (resolvedUrl) {
        dismissVideoFetchToast();
        setPlayerUrl(resolvedUrl);
        setIsPlayerLoading(false);
      } else {
        const toastId = `video-fetch-${video.id}`;
        videoFetchToastId.current = toastId;
        toast.loading('Preparing the video stream. Please try again shortly.', { id: toastId });
        downloadVideo({
          name: video.publisher,
          service: 'VIDEO',
          identifier: video.id,
          title: video.title || '',
          author: video.author || video.publisher,
          id: video.id,
        });
        setPlayerError('Video is being fetched. Please close and reopen the player in a moment.');
        setIsPlayerLoading(false);
      }
    } catch (error) {
      console.error('Failed to play video', error);
      setPlayerError('Could not start the video. Please try again.');
      setIsPlayerLoading(false);
      dismissVideoFetchToast();
    }
  }, [dismissVideoFetchToast, downloadVideo]);

  const handleClosePlayer = useCallback(() => {
    dismissVideoFetchToast();
    setIsPlayerOpen(false);
    setPlayerVideo(null);
    setPlayerUrl(null);
    setPlayerError(null);
  }, [dismissVideoFetchToast]);

  const handleDownloadVideo = useCallback(async (video: Video) => {
    try {
      const directUrl = await getQdnResourceUrl('VIDEO', video.publisher, video.id);

      if (directUrl) {
        const anchor = document.createElement('a');
        anchor.href = directUrl;
        anchor.download =
          video.videoFilename ||
          `${video.title?.replace(/\s+/g, '_') || video.id}.mp4`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success('Video download started.');
        return;
      }

      const toastId = `download-video-${video.id}`;
      toast.loading('Preparing download… This may take a moment.', { id: toastId });
      downloadVideo({
        name: video.publisher,
        service: 'VIDEO',
        identifier: video.id,
        title: video.title || '',
        author: video.author || video.publisher,
        id: video.id,
      });

      window.setTimeout(async () => {
        const refreshedUrl = await getQdnResourceUrl('VIDEO', video.publisher, video.id);
        toast.dismiss(toastId);
        if (refreshedUrl) {
          const anchor = document.createElement('a');
          anchor.href = refreshedUrl;
          anchor.download =
            video.videoFilename ||
            `${video.title?.replace(/\s+/g, '_') || video.id}.mp4`;
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          toast.success('Video download started.');
        } else {
          toast.error('Unable to fetch the video file right now. Please try again shortly.');
        }
      }, 8000);
    } catch (error) {
      console.error('Failed to download video', error);
      toast.error('Could not download the video.');
    }
  }, [downloadVideo]);

  const handleDeleteVideo = useCallback(async (video: Video) => {
    if (!username) {
      toast.error('Log in to manage videos.');
      return;
    }
    if (username !== video.publisher) {
      toast.error('Only the original publisher can delete this video.');
      return;
    }

    const confirmed = window.confirm('Delete this video permanently?');
    if (!confirmed) return;

    try {
      const resources = [
        {
          name: video.publisher,
          service: 'VIDEO',
          identifier: video.id,
        },
        {
          name: video.publisher,
          service: 'DOCUMENT',
          identifier: video.id,
        },
        {
          name: video.publisher,
          service: 'THUMBNAIL',
          identifier: video.id,
        },
      ];

      try {
        await deleteHostedData(resources);
      } catch (error) {
        console.warn('Failed to delete hosted data via batch operation', error);
      }

      for (const resource of resources) {
        await deleteQdnResource(resource);
      }

      toast.success('Video deleted.');
      loadVideos();
    } catch (error) {
      console.error('Failed to delete video', error);
      toast.error('Could not delete the video.');
    }
  }, [loadVideos, username]);

  const handleEditVideo = useCallback((video: Video) => {
    if (!username) {
      toast.error('Log in to manage videos.');
      return;
    }

    if (username !== video.publisher) {
      toast.error('Only the original publisher can edit this video.');
      return;
    }

    uploadVideoModal.openEdit(video);
  }, [uploadVideoModal, username]);

  const handleFavoriteVideo = useCallback(async (video: Video) => {
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
  }, [dispatch, favorites]);

  const handleLikeVideo = useCallback(async (video: Video) => {
    if (!username) {
      toast.error('Log in to like videos.');
      return;
    }

    const alreadyLiked = likedByUser[video.id];

    try {
      if (alreadyLiked) {
        await unlikeVideo(username, video.id);
        setLikedByUser((prev) => ({
          ...prev,
          [video.id]: false,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [video.id]: Math.max(0, (prev[video.id] ?? 1) - 1),
        }));
        toast.success(`Removed like from "${video.title}".`);
      } else {
        await publishVideoLike(username, video);
        setLikedByUser((prev) => ({
          ...prev,
          [video.id]: true,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [video.id]: (prev[video.id] ?? 0) + 1,
        }));
        toast.success(`You liked "${video.title}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle video like', error);
      toast.error('Could not update like. Please try again.');
    }
  }, [likedByUser, username]);

  const handleSendTips = useCallback(
    (video: Video) => {
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }

      if (!video.publisher) {
        toast.error('Creator information is missing.');
        return;
      }

      sendTipModal.open(video.publisher);
    },
    [sendTipModal, username],
  );

  const handleAddVideoToPlaylist = useCallback((songData: Song) => {
    if (!username) {
      toast.error('Log in to manage playlists.');
      return;
    }
    addSongToPlaylistModal.onOpen(songData);
  }, [addSongToPlaylistModal, username]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 10) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const firstSegment = [1, 2, 3, 4, 5];
    const lastSegment = [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];

    return [...firstSegment, '...', ...lastSegment];
  }, [totalPages]);

  return (
    <div className="px-4 py-6">
      <Header>
        <VideoToolbar
          slogan={SLOGAN}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onPublishClick={uploadVideoModal.openCreate}
        />
      </Header>

      <Box className="mt-6 border border-amber-600/40 bg-amber-900/30 p-4 text-sm text-amber-100 shadow-lg shadow-amber-900/20">
        <p className="font-semibold uppercase tracking-wide text-amber-200">
          Please publish only MUSIC VIDEOS here — use the{' '}
          <a
            href="qortal://APP/Q-Tube"
            className="font-bold text-amber-50 underline decoration-amber-200 underline-offset-4 hover:text-white"
          >
            Q-Tube
          </a>{' '}
          app for other videos.
        </p>
      </Box>

      <div className="mt-6 flex flex-col gap-6">
        <Box className="p-6">
          <VideoAlphabetFilter
            activeLetter={activeLetter}
            onLetterSelect={handleSelectLetter}
          />
        </Box>

        <Box className="p-4">
          <SortControls
            sortOrder={sortOrder === 'newest' ? 'desc' : 'asc'}
            onSortOrderChange={(order) => setSortOrder(order === 'desc' ? 'newest' : 'oldest')}
            categories={(() => {
              const normalized = new Set<string>();
              sortedVideos.forEach((video) => {
                const category = getVideoCategory(video);
                if (!category) {
                  normalized.add(VIDEO_UNCATEGORIZED);
                } else {
                  normalized.add(category);
                }
              });
              const base: string[] = [...MUSIC_CATEGORIES];
              normalized.forEach((category) => {
                if (!base.includes(category)) {
                  base.push(category);
                }
              });
              return base;
            })()}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            showOrderButtons={false}
          />
        </Box>

        <Box className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <CircularProgress size={32} />
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-500/40 bg-red-900/30 px-4 py-6 text-center text-sm font-medium text-red-200">
              {error}
            </div>
          ) : paginatedVideos.length === 0 ? (
            <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
              No videos match the selected filter yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedVideos.map((video) => (
                <div
                  key={video.id}
                  id={`video-${video.id}`}
                  className={video.id === highlightedVideoId ? 'animate-pulse' : ''}
                >
                  <VideoCard
                    video={video}
                    onPlay={handlePlayVideo}
                    onLike={handleLikeVideo}
                    onAddFavorite={handleFavoriteVideo}
                    onAddToPlaylist={handleAddVideoToPlaylist}
                    onDownload={handleDownloadVideo}
                    onCopyLink={handleShareVideo}
                    onSendTips={handleSendTips}
                    onEdit={username === video.publisher ? handleEditVideo : undefined}
                    isFavorite={Boolean(favorites?.songs?.[video.id])}
                    isLiked={Boolean(likedByUser[video.id])}
                    likeCount={likeCounts[video.id] ?? 0}
                  />
                </div>
              ))}
            </div>
          )}
        </Box>

        {totalPages > 1 && (
          <Box className="p-4">
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-sky-300">
              {paginationItems.map((item, index) =>
                typeof item === 'number' ? (
                  <button
                    key={`page-${item}-${index}`}
                    type="button"
                    onClick={() => handleChangePage(item)}
                    className={`min-w-[2.5rem] rounded-md border px-3 py-2 transition ${
                      currentPage === item
                        ? 'border-sky-400 bg-sky-700 text-white'
                        : 'border-sky-900/70 bg-sky-950/40 hover:border-sky-600 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={`separator-${index}`} className="px-2 text-sky-500">
                    ...
                  </span>
                )
              )}
            </div>
          </Box>
        )}
      </div>

      <VideoPlayerOverlay
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
        video={playerVideo}
        videoUrl={playerUrl}
        isLoading={isPlayerLoading}
        error={playerError}
      />
    </div>
  );
};

export default Videos;
