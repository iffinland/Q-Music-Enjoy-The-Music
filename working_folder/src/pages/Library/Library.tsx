import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import Header from '../../components/Header';
import Box from '../../components/Box';
import LibrarySongList from '../../components/library/LibrarySongList';
import LibraryPodcastCard from '../../components/library/LibraryPodcastCard';
import LibraryVideoCard from '../../components/library/LibraryVideoCard';
import VideoPlayerOverlay from '../../components/videos/VideoPlayerOverlay';
import LazyLoad from '../../components/common/LazyLoad';
import { useFetchSongs } from '../../hooks/fetchSongs';
import { RootState } from '../../state/store';
import { MyPlaylists } from '../Playlists/MyPlaylists';
import { FavPlaylists } from '../Playlists/FavPlaylists';
import { IoMdCloudUpload } from 'react-icons/io';
import { toast } from 'react-hot-toast';
import { setAddToDownloads, setCurrentPlaylist, setCurrentSong } from '../../state/features/globalSlice';
import { MyContext } from '../../wrappers/DownloadWrapper';
import { getQdnResourceUrl } from '../../utils/qortalApi';
import likeImg from '../../assets/img/like-button.png';
import { Podcast, Video } from '../../types';
import { fetchPodcastsByPublisher, fetchPodcastByGlobalIdentifier } from '../../services/podcasts';
import { fetchVideosByPublisher, fetchVideoByGlobalIdentifier } from '../../services/videos';
import { SongRequest } from '../../state/features/requestsSlice';
import { fetchRequestsByPublisher } from '../../services/qdnRequests';

const podcastFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-podcast-favorites',
});

const videoFavoritesStorage = localforage.createInstance({
  name: 'ear-bump-video-favorites',
});

type LibraryView =
  | 'library-songs'
  | 'library-playlists'
  | 'library-podcasts'
  | 'library-videos'
  | 'library-requests'
  | 'favorite-songs'
  | 'favorite-podcasts'
  | 'favorite-videos'
  | 'favorite-playlists';

const formatTimestamp = (value?: number): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return '—';
  }
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-lg border border-sky-900/50 bg-sky-950/50 p-6 text-center text-sm text-sky-200/80">
    {message}
  </div>
);

const LoadingState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-lg border border-sky-900/60 bg-sky-950/50 p-6 text-center text-sm text-sky-200/80">
    {label}
  </div>
);

export const Library: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);

  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const songListLibrary = useSelector((state: RootState) => state?.global.songListLibrary);
  const favoriteList = useSelector((state: RootState) => state.global.favoriteList);
  const favorites = useSelector((state: RootState) => state.global.favorites);
  const downloads = useSelector((state: RootState) => state.global.downloads);

  const initialSongFetch = useRef(false);

  const [mode, setMode] = useState<LibraryView>('library-songs');

  const [userPodcasts, setUserPodcasts] = useState<Podcast[]>([]);
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [userRequests, setUserRequests] = useState<SongRequest[]>([]);
  const [favoritePodcasts, setFavoritePodcasts] = useState<Podcast[]>([]);
  const [favoriteVideos, setFavoriteVideos] = useState<Video[]>([]);

  const [isLoadingPodcasts, setIsLoadingPodcasts] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingFavPodcasts, setIsLoadingFavPodcasts] = useState(false);
  const [isLoadingFavVideos, setIsLoadingFavVideos] = useState(false);

  const [hasLoadedUserPodcasts, setHasLoadedUserPodcasts] = useState(false);
  const [hasLoadedUserVideos, setHasLoadedUserVideos] = useState(false);
  const [hasLoadedUserRequests, setHasLoadedUserRequests] = useState(false);
  const [hasLoadedFavPodcasts, setHasLoadedFavPodcasts] = useState(false);
  const [hasLoadedFavVideos, setHasLoadedFavVideos] = useState(false);

  const [playerVideo, setPlayerVideo] = useState<Video | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const videoFetchToastId = useRef<string | null>(null);

  const dismissVideoFetchToast = useCallback(() => {
    if (videoFetchToastId.current) {
      toast.dismiss(videoFetchToastId.current);
      videoFetchToastId.current = null;
    }
  }, []);

  const { getYourLibrary, getLikedSongs } = useFetchSongs();

  const fetchMyLibrary = useCallback(async () => {
    try {
      if (!username) return;
      await getYourLibrary(username);
      initialSongFetch.current = true;
    } catch (error) {
      toast.error('Failed to load your songs. Please try again.');
    }
  }, [username, getYourLibrary]);

  useEffect(() => {
    if (username && !initialSongFetch.current) {
      fetchMyLibrary();
    }
  }, [username, fetchMyLibrary]);

  useEffect(() => {
    setUserPodcasts([]);
    setUserVideos([]);
    setUserRequests([]);
    setHasLoadedUserPodcasts(false);
    setHasLoadedUserVideos(false);
    setHasLoadedUserRequests(false);
  }, [username]);

  const loadUserPodcasts = useCallback(async () => {
    if (!username || isLoadingPodcasts) return;
    setIsLoadingPodcasts(true);
    try {
      const data = await fetchPodcastsByPublisher(username);
      setUserPodcasts(data);
      setHasLoadedUserPodcasts(true);
    } catch (error) {
      toast.error('Failed to load your podcasts.');
    } finally {
      setIsLoadingPodcasts(false);
    }
  }, [username, isLoadingPodcasts]);

  const loadUserVideos = useCallback(async () => {
    if (!username || isLoadingVideos) return;
    setIsLoadingVideos(true);
    try {
      const data = await fetchVideosByPublisher(username);
      setUserVideos(data);
      setHasLoadedUserVideos(true);
    } catch (error) {
      toast.error('Failed to load your videos.');
    } finally {
      setIsLoadingVideos(false);
    }
  }, [username, isLoadingVideos]);

  const loadUserRequests = useCallback(async () => {
    if (!username || isLoadingRequests) return;
    setIsLoadingRequests(true);
    try {
      const data = await fetchRequestsByPublisher(username);
      setUserRequests(data);
      setHasLoadedUserRequests(true);
    } catch (error) {
      toast.error('Failed to load your requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [username, isLoadingRequests]);

  const loadFavoritePodcasts = useCallback(async () => {
    if (isLoadingFavPodcasts) return;
    setIsLoadingFavPodcasts(true);
    try {
      const ids = (await podcastFavoritesStorage.getItem<string[]>('favorites')) || [];
      if (ids.length === 0) {
        setFavoritePodcasts([]);
        setHasLoadedFavPodcasts(true);
        return;
      }
      const results = await Promise.all(ids.map((id) => fetchPodcastByGlobalIdentifier(id)));
      setFavoritePodcasts(results.filter((podcast): podcast is Podcast => Boolean(podcast)));
      setHasLoadedFavPodcasts(true);
    } catch (error) {
      toast.error('Failed to load favorite podcasts.');
    } finally {
      setIsLoadingFavPodcasts(false);
    }
  }, [isLoadingFavPodcasts]);

  const loadFavoriteVideos = useCallback(async () => {
    if (isLoadingFavVideos) return;
    setIsLoadingFavVideos(true);
    try {
      const ids = (await videoFavoritesStorage.getItem<string[]>('favorites')) || [];
      if (ids.length === 0) {
        setFavoriteVideos([]);
        setHasLoadedFavVideos(true);
        return;
      }
      const results = await Promise.all(ids.map((id) => fetchVideoByGlobalIdentifier(id)));
      setFavoriteVideos(results.filter((video): video is Video => Boolean(video)));
      setHasLoadedFavVideos(true);
    } catch (error) {
      toast.error('Failed to load favorite videos.');
    } finally {
      setIsLoadingFavVideos(false);
    }
  }, [isLoadingFavVideos]);

  useEffect(() => {
    if (mode === 'library-podcasts' && username && !hasLoadedUserPodcasts) {
      loadUserPodcasts();
    }
  }, [mode, username, hasLoadedUserPodcasts, loadUserPodcasts]);

  useEffect(() => {
    if (mode === 'library-videos' && username && !hasLoadedUserVideos) {
      loadUserVideos();
    }
  }, [mode, username, hasLoadedUserVideos, loadUserVideos]);

  useEffect(() => {
    if (mode === 'library-requests' && username && !hasLoadedUserRequests) {
      loadUserRequests();
    }
  }, [mode, username, hasLoadedUserRequests, loadUserRequests]);

  useEffect(() => {
    if (mode === 'favorite-podcasts' && !hasLoadedFavPodcasts) {
      loadFavoritePodcasts();
    }
  }, [mode, hasLoadedFavPodcasts, loadFavoritePodcasts]);

  useEffect(() => {
    if (mode === 'favorite-videos' && !hasLoadedFavVideos) {
      loadFavoriteVideos();
    }
  }, [mode, hasLoadedFavVideos, loadFavoriteVideos]);

  useEffect(() => {
    const handlePodcastRefresh = () => {
      setHasLoadedUserPodcasts(false);
      setHasLoadedFavPodcasts(false);
      if (mode === 'library-podcasts') {
        loadUserPodcasts();
      }
      if (mode === 'favorite-podcasts') {
        loadFavoritePodcasts();
      }
    };

    const handleVideoRefresh = () => {
      setHasLoadedUserVideos(false);
      setHasLoadedFavVideos(false);
      if (mode === 'library-videos') {
        loadUserVideos();
      }
      if (mode === 'favorite-videos') {
        loadFavoriteVideos();
      }
    };

    window.addEventListener('podcasts:refresh', handlePodcastRefresh);
    window.addEventListener('videos:refresh', handleVideoRefresh);
    return () => {
      window.removeEventListener('podcasts:refresh', handlePodcastRefresh);
      window.removeEventListener('videos:refresh', handleVideoRefresh);
    };
  }, [mode, loadUserPodcasts, loadFavoritePodcasts, loadUserVideos, loadFavoriteVideos]);

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

  const playFavoriteCollection = useCallback(async () => {
    if (!favoriteList || favoriteList.length === 0) return;

    const firstLikedSong = favoriteList[0];
    dispatch(setCurrentPlaylist('likedPlaylist'));

    try {
      if (
        firstLikedSong?.status?.status === 'READY' ||
        downloads[firstLikedSong.id]?.status?.status === 'READY'
      ) {
        const resolvedUrl = await getQdnResourceUrl('AUDIO', firstLikedSong.name, firstLikedSong.id);
        dispatch(
          setAddToDownloads({
            name: firstLikedSong.name,
            service: 'AUDIO',
            id: firstLikedSong.id,
            identifier: firstLikedSong.id,
            url: resolvedUrl ?? undefined,
            status: firstLikedSong?.status,
            title: firstLikedSong?.title || '',
            author: firstLikedSong?.author || '',
          }),
        );
      } else {
        downloadVideo({
          name: firstLikedSong.name,
          service: 'AUDIO',
          identifier: firstLikedSong.id,
          title: firstLikedSong?.title || '',
          author: firstLikedSong?.author || '',
          id: firstLikedSong.id,
        });
      }

      dispatch(setCurrentSong(firstLikedSong.id));
    } catch (error) {
      toast.error('Unable to start playback right now.');
    }
  }, [dispatch, downloadVideo, downloads, favoriteList]);

  const favoritesAvailable = Boolean(favorites);

  const renderPodcastList = (collection: Podcast[], options?: { onFavoriteChange?: () => void }) => (
    <div className="space-y-3">
      {collection.map((podcast) => (
        <LibraryPodcastCard
          key={podcast.id}
          podcast={podcast}
          onFavoriteChange={options?.onFavoriteChange}
        />
      ))}
    </div>
  );

  const renderVideoList = (collection: Video[], options?: { onFavoriteChange?: () => void }) => (
    <div className="space-y-3">
      {collection.map((video) => (
        <LibraryVideoCard
          key={video.id}
          video={video}
          onPlay={handlePlayVideo}
          onFavoriteChange={options?.onFavoriteChange}
        />
      ))}
    </div>
  );

  const renderRequestsList = (collection: SongRequest[]) => (
    <div className="space-y-3">
      {collection.map((request) => (
        <div
          key={request.id}
          className="rounded-xl border border-sky-900/60 bg-sky-950/60 px-4 py-4 text-left"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-white">
              {request.artist} — {request.title}
            </h3>
            <span className="text-xs uppercase tracking-wide text-sky-300/80">
              {request.status === 'filled' ? 'Filled request' : 'Open request'}
            </span>
          </div>
          <p className="text-xs text-sky-400/80">
            Requested {formatTimestamp(request.created)} {request.publisher ? `by ${request.publisher}` : ''}
          </p>
          {request.info && (
            <p className="mt-2 text-sm text-sky-200/85 whitespace-pre-line">{request.info}</p>
          )}
          {request.status === 'filled' && (
            <div className="mt-3 rounded-lg border border-emerald-800/60 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-200/90">
              Filled by {request.filledBy || 'unknown'} — {request.filledSongArtist} · {request.filledSongTitle}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <div className="mt-5 mb-5 flex flex-wrap gap-3">
          <button
            className={`${
              mode === 'library-songs'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('library-songs')}
          >
            My Songs
          </button>
          <button
            className={`${
              mode === 'library-playlists'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('library-playlists')}
          >
            My Playlists
          </button>
          <button
            className={`${
              mode === 'library-podcasts'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('library-podcasts')}
          >
            My Podcasts
          </button>
          <button
            className={`${
              mode === 'library-videos'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('library-videos')}
          >
            My Videos
          </button>
          <button
            className={`${
              mode === 'library-requests'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('library-requests')}
          >
            My Requests
          </button>

          <div className="w-full" />

          <button
            className={`${
              mode === 'favorite-songs'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('favorite-songs')}
          >
            Favorite Songs
          </button>
          <button
            className={`${
              mode === 'favorite-podcasts'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('favorite-podcasts')}
          >
            Favorite Podcasts
          </button>
          <button
            className={`${
              mode === 'favorite-videos'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('favorite-videos')}
          >
            Favorite Videos
          </button>
          <button
            className={`${
              mode === 'favorite-playlists'
                ? 'bg-sky-900/70 border border-sky-500/40'
                : 'border border-sky-900/40 bg-transparent hover:bg-sky-900/40'
            } text-sky-100 px-4 py-2 rounded transition`}
            onClick={() => setMode('favorite-playlists')}
          >
            Favorite Playlists
          </button>
        </div>

        {mode === 'library-playlists' && <MyPlaylists />}

        {mode === 'library-songs' && (
          <>
            <div className="mt-5">
              <div className="flex flex-col items-center gap-x-5 md:flex-row">
                <div className="relative h-10 w-10">
                  <IoMdCloudUpload style={{ height: '35px', width: 'auto' }} />
                </div>
                <div className="mt-4 flex flex-col gap-y-2 md:mt-0">
                  <h2 className="text-xl font-semibold text-white">My Songs</h2>
                  <p className="text-sm text-sky-200/80">
                    Keep track of every track you have published to the Q-Music community.
                  </p>
                </div>
              </div>
            </div>

            <LibrarySongList songs={songListLibrary ?? []} />
            <LazyLoad onLoadMore={fetchMyLibrary} />
          </>
        )}

        {mode === 'library-podcasts' && (
          <>
            <div className="mt-5 mb-4">
              <h2 className="text-xl font-semibold text-white">My Podcasts</h2>
            </div>
            {!username ? (
              <EmptyState message="Log in to see the podcasts you have published." />
            ) : isLoadingPodcasts && !userPodcasts.length ? (
              <LoadingState label="Loading your podcasts…" />
            ) : userPodcasts.length === 0 ? (
              <EmptyState message="You have not published any podcasts yet." />
            ) : (
              renderPodcastList(userPodcasts, { onFavoriteChange: loadFavoritePodcasts })
            )}
          </>
        )}

        {mode === 'library-videos' && (
          <>
            <div className="mt-5 mb-4">
              <h2 className="text-xl font-semibold text-white">My Videos</h2>
            </div>
            {!username ? (
              <EmptyState message="Log in to see the videos you have published." />
            ) : isLoadingVideos && !userVideos.length ? (
              <LoadingState label="Loading your videos…" />
            ) : userVideos.length === 0 ? (
              <EmptyState message="You have not published any videos yet." />
            ) : (
              renderVideoList(userVideos)
            )}
          </>
        )}

        {mode === 'library-requests' && (
          <>
            <div className="mt-5 mb-4">
              <h2 className="text-xl font-semibold text-white">My Requests</h2>
            </div>
            {!username ? (
              <EmptyState message="Log in to see the requests you have created." />
            ) : isLoadingRequests && !userRequests.length ? (
              <LoadingState label="Loading your requests…" />
            ) : userRequests.length === 0 ? (
              <EmptyState message="You have not submitted any requests yet." />
            ) : (
              renderRequestsList(userRequests)
            )}
          </>
        )}

        {mode === 'favorite-songs' && (
          <>
            {!favoritesAvailable ? (
              <EmptyState message="Log in to see your favorite songs." />
            ) : (
              <>
                <div className="mt-5 mb-4">
                  <h2 className="text-xl font-semibold text-white">Favorite Songs</h2>
                </div>
                <LibrarySongList songs={favoriteList ?? []} />
                <LazyLoad onLoadMore={getLikedSongs} />
              </>
            )}
          </>
        )}

        {mode === 'favorite-podcasts' && (
          <>
            <div className="mt-5 mb-4">
              <h2 className="text-xl font-semibold text-white">Favorite Podcasts</h2>
            </div>
            {isLoadingFavPodcasts && !favoritePodcasts.length ? (
              <LoadingState label="Loading favorite podcasts…" />
            ) : favoritePodcasts.length === 0 ? (
              <EmptyState message="You have not saved any podcasts as favorites yet." />
            ) : (
              renderPodcastList(favoritePodcasts, { onFavoriteChange: loadFavoritePodcasts })
            )}
          </>
        )}

        {mode === 'favorite-videos' && (
          <>
            <div className="mt-5 mb-4">
              <h2 className="text-xl font-semibold text-white">Favorite Videos</h2>
            </div>
            {isLoadingFavVideos && !favoriteVideos.length ? (
              <LoadingState label="Loading favorite videos…" />
            ) : favoriteVideos.length === 0 ? (
              <EmptyState message="You have not saved any videos as favorites yet." />
            ) : (
              renderVideoList(favoriteVideos, { onFavoriteChange: loadFavoriteVideos })
            )}
          </>
        )}

        {mode === 'favorite-playlists' && (
          <>
            <div className="mt-5 mb-4">
              <h2 className="text-xl font-semibold text-white">Favorite Playlists</h2>
            </div>
            {!favoritesAvailable ? (
              <EmptyState message="Log in to see your favorite playlists." />
            ) : (
              <FavPlaylists />
            )}
          </>
        )}
      </Header>
      <VideoPlayerOverlay
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
        video={playerVideo}
        videoUrl={playerUrl}
        isLoading={isPlayerLoading}
        error={playerError}
      />
    </Box>
  );
};
