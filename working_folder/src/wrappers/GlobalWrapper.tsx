import React, { useCallback, useContext, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import PageLoader from "../components/common/PageLoader";
import { RootState } from "../state/store";
import { Favorites, PlayList, setAddToDownloads, setCurrentSong, setFavoritesFromStorage, setFavoritesFromStoragePlaylists, setStatistics, setStatisticsLoading } from "../state/features/globalSlice";
import localforage from "localforage";
const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites'
})

import { RequestQueue } from "../utils/queue";
import { fetchStatisticsSnapshot } from "../services/statistics";
import { getNamesByAddress, getQdnResourceUrl } from "../utils/qortalApi";
import { resolveAudioUrl } from "../utils/resolveAudioUrl";
import { MyContext } from "./DownloadWrapper";
import { fetchSongByIdentifier } from "../services/songs";
import { fetchPodcastByIdentifier } from "../services/podcasts";
import { fetchAudiobookByIdentifier } from "../services/audiobooks";
import { useNavigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

export const queueFetchAvatars = new RequestQueue();

const GlobalWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { downloadVideo } = useContext(MyContext);
  const autoPlayHandledRef = useRef(false);

 
  const {
    isLoadingGlobal,
  } = useSelector((state: RootState) => state.global);

  async function getNameInfo(address: string) {
    const nameData = await getNamesByAddress(address);
    if (nameData?.length > 0) {
      return nameData[0];
    }
    return "";
  }




  const askForAccountInformation = useCallback(async () => {
    try {
      const account = await qortalRequest({
        action: "GET_USER_ACCOUNT"
      });

      const name = await getNameInfo(account.address);
      dispatch(addUser({ ...account, name }));
    } catch (error) {
      console.error(error);
    }
  }, [dispatch]);


  const getFavouritesFromStorage = useCallback(async () => {
    try {
      const favorites = await favoritesStorage.getItem<Favorites>('favorites');
      if (favorites) {
        dispatch(setFavoritesFromStorage(favorites));
      } else {
        dispatch(setFavoritesFromStorage({
          songs: {},
          playlists: {},
        }));
      }
    } catch (error) {
      console.error('Failed to restore song favorites', error);
    }
  }, [dispatch]);

  const getFavouritesFromStoragePlaylists = useCallback(async () => {
    try {
      const favorites = await favoritesStorage.getItem<PlayList[]>('favoritesPlaylist');
      if (favorites) {
        dispatch(setFavoritesFromStoragePlaylists(favorites));
      } else {
        dispatch(setFavoritesFromStoragePlaylists([]));
      }
    } catch (error) {
      console.error('Failed to restore playlist favorites', error);
    }
  }, [dispatch]);

  useEffect(() => {
    askForAccountInformation();
    getFavouritesFromStorage();
    getFavouritesFromStoragePlaylists();
  }, [askForAccountInformation, getFavouritesFromStorage, getFavouritesFromStoragePlaylists]);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadStatistics = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = options;
      if (showSpinner) {
        dispatch(setStatisticsLoading(true));
      }
      try {
        const snapshot = await fetchStatisticsSnapshot();
        if (isMountedRef.current) {
          dispatch(setStatistics(snapshot));
        }
      } catch (error) {
        console.error('Failed to load statistics', error);
      } finally {
        if (isMountedRef.current && showSpinner) {
          dispatch(setStatisticsLoading(false));
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStatistics({ showSpinner: false });
    }, 500);
    return () => clearTimeout(timer);
  }, [loadStatistics]);

  useEffect(() => {
    const handleRefresh = () => {
      loadStatistics({ showSpinner: false });
    };

    window.addEventListener('statistics:refresh', handleRefresh);
    return () => {
      window.removeEventListener('statistics:refresh', handleRefresh);
    };
  }, [loadStatistics]);

  const handleSharedNavigation = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (autoPlayHandledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.toString().length === 0) return;

    const cleanupParams = (keys: string[]) => {
      const url = new URL(window.location.href);
      keys.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', url.toString());
    };

    const threadId = params.get('thread');
    if (threadId) {
      autoPlayHandledRef.current = true;
      const replyId = params.get('reply');
      const search = new URLSearchParams();
      search.set('thread', threadId);
      if (replyId) {
        search.set('reply', replyId);
      }
      navigate(`/discussions?${search.toString()}`, { replace: true });
      cleanupParams(['type']);
      return;
    }

    const playlistId = params.get('playlist');
    const playlistPublisher = params.get('playlistPublisher');
    if (playlistId && playlistPublisher) {
      autoPlayHandledRef.current = true;
      cleanupParams(['playlist', 'playlistPublisher', 'type', 'autoplay']);
      navigate(`/playlists/${encodeURIComponent(playlistPublisher)}/${encodeURIComponent(playlistId)}`, {
        replace: true,
      });
      return;
    }

    const podcastId = params.get('podcast');
    const podcastPublisher = params.get('podcastPublisher');
    if (podcastId && podcastPublisher) {
      autoPlayHandledRef.current = true;
      try {
        const podcastMeta = await fetchPodcastByIdentifier(podcastPublisher, podcastId);
        if (podcastMeta) {
          const resolvedUrl = await resolveAudioUrl(podcastPublisher, podcastId);
          const readyStatus =
            resolvedUrl && podcastMeta.status?.status === 'READY'
              ? podcastMeta.status
              : resolvedUrl
              ? { ...(podcastMeta.status ?? {}), status: 'READY', percentLoaded: 100 }
              : podcastMeta.status;

          if (resolvedUrl) {
            dispatch(setAddToDownloads({
              name: podcastPublisher,
              service: 'AUDIO',
              id: podcastId,
              identifier: podcastId,
              url: resolvedUrl,
              status: readyStatus,
              title: podcastMeta.title || '',
              author: podcastPublisher,
              mediaType: 'PODCAST',
            }));
          } else {
            downloadVideo({
              name: podcastPublisher,
              service: 'AUDIO',
              identifier: podcastId,
              title: podcastMeta.title || '',
              author: podcastPublisher,
              id: podcastId,
              mediaType: 'PODCAST',
            });
          }

          dispatch(setCurrentSong(podcastId));
        }
      } catch (error) {
        console.error('Failed to autoplay podcast from shared link', error);
      } finally {
        cleanupParams(['podcast', 'podcastPublisher', 'type', 'autoplay']);
        navigate(`/podcasts/${encodeURIComponent(podcastPublisher)}/${encodeURIComponent(podcastId)}`, {
          replace: true,
        });
      }
      return;
    }

    const audiobookId = params.get('audiobook');
    const audiobookPublisher = params.get('audiobookPublisher');
    if (audiobookId && audiobookPublisher) {
      autoPlayHandledRef.current = true;
      try {
        const audiobookMeta = await fetchAudiobookByIdentifier(audiobookPublisher, audiobookId);
        if (audiobookMeta) {
          const resolvedUrl = await resolveAudioUrl(audiobookPublisher, audiobookId);
          const readyStatus =
            resolvedUrl && audiobookMeta.status?.status === 'READY'
              ? audiobookMeta.status
              : resolvedUrl
              ? { ...(audiobookMeta.status ?? {}), status: 'READY', percentLoaded: 100 }
              : audiobookMeta.status;

          if (resolvedUrl) {
            dispatch(setAddToDownloads({
              name: audiobookPublisher,
              service: 'AUDIO',
              id: audiobookId,
              identifier: audiobookId,
              url: resolvedUrl,
              status: readyStatus,
              title: audiobookMeta.title || '',
              author: audiobookPublisher,
              mediaType: 'AUDIOBOOK',
            }));
          } else {
            downloadVideo({
              name: audiobookPublisher,
              service: 'AUDIO',
              identifier: audiobookId,
              title: audiobookMeta.title || '',
              author: audiobookPublisher,
              id: audiobookId,
              mediaType: 'AUDIOBOOK',
            });
          }

          dispatch(setCurrentSong(audiobookId));
        }
      } catch (error) {
        console.error('Failed to autoplay audiobook from shared link', error);
      } finally {
        cleanupParams(['audiobook', 'audiobookPublisher', 'type', 'autoplay']);
        navigate(`/audiobooks/${encodeURIComponent(audiobookPublisher)}/${encodeURIComponent(audiobookId)}`, {
          replace: true,
        });
      }
      return;
    }

    const identifier = params.get('play');
    const publisher = params.get('publisher');
    if (!identifier || !publisher) {
      return;
    }

    autoPlayHandledRef.current = true;

    try {
      const songMeta = await fetchSongByIdentifier(publisher, identifier);
      if (!songMeta) {
        console.warn('Song metadata not found for shared link', { publisher, identifier });
        return;
      }

      const resolvedUrl = await getQdnResourceUrl('AUDIO', publisher, identifier);

      if (resolvedUrl) {
        dispatch(setAddToDownloads({
          name: publisher,
          service: 'AUDIO',
          id: identifier,
          identifier,
          url: resolvedUrl,
          status: songMeta.status,
          title: songMeta.title || "",
          author: songMeta.author || "",
          mediaType: 'SONG',
        }));
      } else {
        downloadVideo({
          name: publisher,
          service: 'AUDIO',
          identifier,
          title: songMeta.title || "",
          author: songMeta.author || "",
          id: identifier,
          mediaType: 'SONG',
        });
      }

      dispatch(setCurrentSong(identifier));

      navigate(`/songs/${encodeURIComponent(publisher)}/${encodeURIComponent(identifier)}`, {
        replace: true,
      });
    } catch (error) {
      console.error('Failed to autoplay song from shared link', error);
    } finally {
      cleanupParams(['play', 'publisher', 'type', 'autoplay']);
    }
  }, [dispatch, downloadVideo, navigate]);

  useEffect(() => {
    handleSharedNavigation();
  }, [handleSharedNavigation]);

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      {children}
    </>
  );
};

export default GlobalWrapper;
