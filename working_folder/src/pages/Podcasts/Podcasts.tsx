import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import Box from '../../components/Box';
import {
  PodcastToolbar,
  PodcastSortOrder,
} from '../../components/podcasts/PodcastToolbar';
import { PodcastAlphabetFilter } from '../../components/podcasts/PodcastAlphabetFilter';
import { PodcastCard } from '../../components/podcasts/PodcastCard';
import { fetchPodcasts } from '../../services/podcasts';
import { Podcast, Song } from '../../types';
import { CircularProgress } from '@mui/material';
import useUploadPodcastModal from '../../hooks/useUploadPodcastModal';
import useSendTipModal from '../../hooks/useSendTipModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import { toast } from 'react-hot-toast';
import { buildPodcastShareUrl } from '../../utils/qortalLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Favorites, removeFavSong, setAddToDownloads, setCurrentSong, setFavSong } from '../../state/features/globalSlice';
import { deleteHostedData, deleteQdnResource, getQdnResourceUrl } from '../../utils/qortalApi';
import { MyContext } from '../../wrappers/DownloadWrapper';
import localforage from 'localforage';
import {
  fetchPodcastLikeCount,
  hasUserLikedPodcast,
  likePodcast as publishPodcastLike,
  unlikePodcast,
} from '../../services/podcastLikes';
import { objectToBase64 } from '../../utils/toBase64';
import { PODCAST_CATEGORIES } from '../../constants/categories';
import SortControls from '../../components/common/SortControls';

const PAGE_SIZE = 15;
const SLOGAN = 'Catch the latest community shows and rediscover timeless episodes.';
const PODCAST_UNCATEGORIZED = 'Uncategorized';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-favorites',
});

const Podcasts: React.FC = () => {
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const favorites = useSelector((state: RootState) => state.global.favorites);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<PodcastSortOrder>('newest');
  const [activeLetter, setActiveLetter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const mountedRef = useRef(true);
  const uploadPodcastModal = useUploadPodcastModal();
  const sendTipModal = useSendTipModal();
  const addSongToPlaylistModal = useAddSongToPlaylistModal();
  const location = useLocation();
  const navigate = useNavigate();
  const [sharedPodcastId, setSharedPodcastId] = useState<string | null>(null);
  const [highlightedPodcastId, setHighlightedPodcastId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const sharedHandledRef = useRef<boolean>(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByUser, setLikedByUser] = useState<Record<string, boolean>>({});
  const pendingOptimisticRef = useRef<Map<string, Podcast>>(new Map());

  const loadPodcasts = useCallback(async (options: { showSpinner?: boolean } = {}) => {
    const { showSpinner = true } = options;
    if (showSpinner) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchPodcasts({ limit: PAGE_SIZE, detailBatchSize: PAGE_SIZE });
      if (!mountedRef.current) return;
      setPodcasts((prev) => {
        const merged = [...data];
        pendingOptimisticRef.current.forEach((optimisticPodcast, id) => {
          const exists = merged.some((item) => item.id === id);
          if (!exists) {
            const fallback = prev.find((item) => item.id === id) || optimisticPodcast;
            merged.unshift(fallback);
          } else {
            pendingOptimisticRef.current.delete(id);
          }
        });
        return merged;
      });
    } catch (err) {
      console.error(err);
      if (!mountedRef.current) return;
      setError('Failed to load podcasts. Please try again in a moment.');
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPodcasts();
  }, [loadPodcasts]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetPodcast = params.get('podcast');
    if (targetPodcast) {
      setSharedPodcastId(targetPodcast);
    }
  }, [location.search]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{
        podcast?: Podcast;
        podcastId?: string;
        mode?: 'create' | 'edit' | 'delete';
      }>;
      const optimisticPodcast = customEvent.detail?.podcast;
      const targetId = optimisticPodcast?.id ?? customEvent.detail?.podcastId;
      const mode = customEvent.detail?.mode ?? 'create';

      if (mode === 'delete' && targetId) {
        pendingOptimisticRef.current.delete(targetId);
        setPodcasts((prev) => prev.filter((item) => item.id !== targetId));
        setLikeCounts((prev) => {
          if (prev[targetId] === undefined) return prev;
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setLikedByUser((prev) => {
          if (prev[targetId] === undefined) return prev;
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }

      if (optimisticPodcast) {
        pendingOptimisticRef.current.set(optimisticPodcast.id, optimisticPodcast);
        setPodcasts((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === optimisticPodcast.id);
          if (existingIndex !== -1) {
            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...optimisticPodcast };
            return next;
          }
          return [optimisticPodcast, ...prev];
        });

        setLikeCounts((prev) => {
          if (prev[optimisticPodcast.id] !== undefined) return prev;
          return {
            ...prev,
            [optimisticPodcast.id]: 0,
          };
        });

        setLikedByUser((prev) => {
          if (prev[optimisticPodcast.id] !== undefined) return prev;
          return {
            ...prev,
            [optimisticPodcast.id]: false,
          };
        });

        if (mode === 'create') {
          setActiveLetter('ALL');
          setCurrentPage(1);
          setHighlightedPodcastId(optimisticPodcast.id);
        }
      }

      loadPodcasts({ showSpinner: false });
    };

    window.addEventListener('podcasts:refresh', handleRefresh);
    return () => {
      window.removeEventListener('podcasts:refresh', handleRefresh);
    };
  }, [loadPodcasts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeLetter, sortOrder, selectedCategory]);

  useEffect(() => {
    setActiveLetter('ALL');
  }, [selectedCategory]);

  const getPodcastCategory = useCallback((podcast: Podcast): string | null => {
    const category = podcast.category;
    if (!category || typeof category !== 'string') return null;
    const trimmed = category.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const sortedPodcasts = useMemo(() => {
    const collection = [...podcasts];

    collection.sort((a, b) => {
      const aTimestamp = a.updated ?? a.created ?? 0;
      const bTimestamp = b.updated ?? b.created ?? 0;

      if (sortOrder === 'newest') {
        return bTimestamp - aTimestamp;
      }

      return aTimestamp - bTimestamp;
    });

    return collection;
  }, [podcasts, sortOrder]);

  const categoryFilteredPodcasts = useMemo(() => {
    if (selectedCategory === 'ALL') return sortedPodcasts;
    return sortedPodcasts.filter((podcast) => {
      const category = getPodcastCategory(podcast) ?? PODCAST_UNCATEGORIZED;
      return category.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [sortedPodcasts, selectedCategory, getPodcastCategory]);

  const filteredPodcasts = useMemo(() => {
    if (activeLetter === 'ALL') {
      return categoryFilteredPodcasts;
    }

    return categoryFilteredPodcasts.filter((podcast) =>
      (podcast.title || '')
        .trim()
        .toUpperCase()
        .startsWith(activeLetter.toUpperCase())
    );
  }, [categoryFilteredPodcasts, activeLetter]);

  const totalPages = Math.max(1, Math.ceil(filteredPodcasts.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedPodcasts = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return filteredPodcasts.slice(startIndex, endIndex);
  }, [filteredPodcasts, currentPage]);

  useEffect(() => {
    let cancelled = false;
    if (paginatedPodcasts.length === 0) return;

    const missing = paginatedPodcasts.filter((podcast) => likeCounts[podcast.id] === undefined);
    if (missing.length === 0) return;

    const loadLikeCounts = async () => {
      try {
        const results = await Promise.all(
          missing.map(async (podcast) => {
            const count = await fetchPodcastLikeCount(podcast.id);
            return { id: podcast.id, count };
          }),
        );

        if (cancelled) return;

        setLikeCounts((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.id] = item.count;
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to load podcast like counts', error);
      }
    };

    loadLikeCounts();

    return () => {
      cancelled = true;
    };
  }, [paginatedPodcasts, likeCounts]);

  useEffect(() => {
    let cancelled = false;

    if (!username) {
      setLikedByUser({});
      return;
    }

    if (paginatedPodcasts.length === 0) {
      return;
    }

    const missing = paginatedPodcasts.filter((podcast) => likedByUser[podcast.id] === undefined);
    if (missing.length === 0) return;

    const loadUserLikes = async () => {
      try {
        const result = await Promise.all(
          missing.map(async (podcast) => {
            const liked = await hasUserLikedPodcast(username, podcast.id);
            return { id: podcast.id, liked };
          }),
        );

        if (cancelled) return;

        setLikedByUser((prev) => {
          const next = { ...prev };
          for (const item of result) {
            next[item.id] = item.liked;
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to load user podcast likes', error);
      }
    };

    loadUserLikes();

    return () => {
      cancelled = true;
    };
  }, [username, paginatedPodcasts, likedByUser]);

  useEffect(() => {
    if (!sharedPodcastId || sharedHandledRef.current) return;
    if (sortedPodcasts.length === 0) return;

    sharedHandledRef.current = true;
    setActiveLetter('ALL');

    const index = sortedPodcasts.findIndex((podcast) => podcast.id === sharedPodcastId);
    if (index !== -1) {
      const page = Math.floor(index / PAGE_SIZE) + 1;
      setCurrentPage(page);
      setHighlightedPodcastId(sharedPodcastId);

      requestAnimationFrame(() => {
        const element = document.getElementById(`podcast-${sharedPodcastId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const params = new URLSearchParams(location.search);
    params.delete('podcast');
    params.delete('podcastPublisher');
    params.delete('type');
    const search = params.toString();
    navigate(`/podcasts${search ? `?${search}` : ''}`, { replace: true });
  }, [sharedPodcastId, sortedPodcasts, location.search, navigate]);

  useEffect(() => {
    if (!highlightedPodcastId) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightedPodcastId(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedPodcastId]);

  const handleSelectLetter = useCallback((letter: string) => {
    setActiveLetter(letter);
  }, []);

  const handleChangePage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }, [totalPages]);

  const handleSharePodcast = useCallback(async (podcast: Podcast) => {
    try {
      const shareLink = buildPodcastShareUrl(podcast.publisher, podcast.id);

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

      toast.success('Podcast link copied! Happy sharing!');
    } catch (error) {
      console.error('Failed to share podcast link', error);
      toast.error('Failed to copy the link. Please try again.');
    }
  }, []);

  const handlePlayPodcast = useCallback(async (podcast: Podcast) => {
    try {
      const existingDownload = downloads[podcast.id];
      const isReady =
        existingDownload?.status?.status === 'READY' ||
        podcast.status?.status === 'READY';

      if (isReady) {
        const resolvedUrl =
          existingDownload?.url ||
          (await getQdnResourceUrl('AUDIO', podcast.publisher, podcast.id));

        dispatch(setAddToDownloads({
          name: podcast.publisher,
          service: 'AUDIO',
          id: podcast.id,
          identifier: podcast.id,
          url: resolvedUrl ?? undefined,
          status: podcast.status,
          title: podcast.title || '',
          author: podcast.publisher,
        }));
      } else {
        toast.success('Fetching the podcast. It will start playing once ready.');
        downloadVideo({
          name: podcast.publisher,
          service: 'AUDIO',
          identifier: podcast.id,
          title: podcast.title || '',
          author: podcast.publisher,
          id: podcast.id,
        });
      }

      dispatch(setCurrentSong(podcast.id));
    } catch (error) {
      console.error('Failed to play podcast', error);
      toast.error('Could not start the podcast. Please try again.');
    }
  }, [dispatch, downloadVideo, downloads]);

  const handleDownloadPodcast = useCallback(async (podcast: Podcast) => {
    try {
      const existingDownload = downloads[podcast.id];
      const directUrl =
        existingDownload?.url ||
        (await getQdnResourceUrl('AUDIO', podcast.publisher, podcast.id));

      if (directUrl) {
        const anchor = document.createElement('a');
        anchor.href = directUrl;
        anchor.download =
          podcast.audioFilename ||
          `${podcast.title?.replace(/\s+/g, '_') || podcast.id}.audio`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success('Podcast download started.');

        dispatch(setAddToDownloads({
          name: podcast.publisher,
          service: 'AUDIO',
          id: podcast.id,
          identifier: podcast.id,
          url: directUrl,
          status: podcast.status,
          title: podcast.title || '',
          author: podcast.publisher,
        }));
        return;
      }

      const toastId = `download-${podcast.id}`;
      toast.loading('Preparing download… This may take a moment.', { id: toastId });
      downloadVideo({
        name: podcast.publisher,
        service: 'AUDIO',
        identifier: podcast.id,
        title: podcast.title || '',
        author: podcast.publisher,
        id: podcast.id,
      });

      window.setTimeout(async () => {
        const refreshedUrl = await getQdnResourceUrl('AUDIO', podcast.publisher, podcast.id);
        toast.dismiss(toastId);
        if (refreshedUrl) {
          const anchor = document.createElement('a');
          anchor.href = refreshedUrl;
          anchor.download =
            podcast.audioFilename ||
            `${podcast.title?.replace(/\s+/g, '_') || podcast.id}.audio`;
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          toast.success('Podcast download started.');
        } else {
          toast.error('Unable to fetch the podcast file right now. Please try again shortly.');
        }
      }, 8000);
    } catch (error) {
      console.error('Failed to download podcast', error);
      toast.error('Could not download the podcast.');
    }
  }, [dispatch, downloadVideo, downloads]);

  const handleSendTips = useCallback(
    (podcast: Podcast) => {
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }

      if (!podcast.publisher) {
        toast.error('Creator information is missing.');
        return;
      }

      sendTipModal.open(podcast.publisher);
    },
    [sendTipModal, username],
  );

  const handleAddPodcastToPlaylist = useCallback((songData: Song) => {
    if (!username) {
      toast.error('Log in to manage playlists.');
      return;
    }
    addSongToPlaylistModal.onOpen(songData);
  }, [addSongToPlaylistModal, username]);

  const handleDeletePodcast = useCallback(async (podcast: Podcast) => {
    if (!username) {
      toast.error('Log in to manage podcasts.');
      return;
    }
    if (username !== podcast.publisher) {
      toast.error('Only the original publisher can delete this podcast.');
      return;
    }

    try {
      const deletionDocument = {
        id: podcast.id,
        deleted: true,
        deletedAt: Date.now(),
        title: 'deleted',
        description: 'deleted',
        publisher: podcast.publisher,
      };

      const deletionData64 = await objectToBase64(deletionDocument);

      await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        name: podcast.publisher,
        service: 'DOCUMENT',
        identifier: podcast.id,
        data64: deletionData64,
        encoding: 'base64',
        title: 'deleted',
        description: 'deleted',
      });

      const resources = [
        {
          name: podcast.publisher,
          service: 'AUDIO',
          identifier: podcast.id,
        },
        {
          name: podcast.publisher,
          service: 'THUMBNAIL',
          identifier: podcast.id,
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

      pendingOptimisticRef.current.delete(podcast.id);
      setPodcasts((prev) => prev.filter((item) => item.id !== podcast.id));
      setLikeCounts((prev) => {
        if (prev[podcast.id] === undefined) return prev;
        const next = { ...prev };
        delete next[podcast.id];
        return next;
      });
      setLikedByUser((prev) => {
        if (prev[podcast.id] === undefined) return prev;
        const next = { ...prev };
        delete next[podcast.id];
        return next;
      });

      toast.success('Podcast deleted.');
      window.dispatchEvent(
        new CustomEvent('podcasts:refresh', {
          detail: { mode: 'delete', podcastId: podcast.id },
        }),
      );
      window.dispatchEvent(new CustomEvent('statistics:refresh'));
      loadPodcasts({ showSpinner: false });
    } catch (error) {
      console.error('Failed to delete podcast', error);
      toast.error('Could not delete the podcast.');
    }
  }, [loadPodcasts, username]);

  const handleEditPodcast = useCallback((podcast: Podcast) => {
    if (!username) {
      toast.error('Log in to manage podcasts.');
      return;
    }

    if (username !== podcast.publisher) {
      toast.error('Only the original publisher can edit this podcast.');
      return;
    }

    uploadPodcastModal.openEdit(podcast);
  }, [uploadPodcastModal, username]);

  const handleFavoritePodcast = useCallback(async (podcast: Podcast) => {
    if (!favorites) {
      toast.error('Favorites are not ready yet. Please try again in a moment.');
      return;
    }

    try {
      const isFavorite = Boolean(favorites.songs?.[podcast.id]);
      const songData: Song = {
        id: podcast.id,
        title: podcast.title,
        name: podcast.publisher,
        service: 'AUDIO',
        author: podcast.publisher,
      };

      const storedFavorites = (await favoritesStorage.getItem<Favorites>('favorites')) || {
        songs: {},
        playlists: {},
      };

      if (isFavorite) {
        dispatch(removeFavSong({
          identifier: podcast.id,
          name: podcast.publisher,
          service: 'AUDIO',
        }));
        if (storedFavorites.songs?.[podcast.id]) {
          delete storedFavorites.songs[podcast.id];
        }
        await favoritesStorage.setItem('favorites', storedFavorites);
        toast.success('Podcast removed from favorites.');
      } else {
        dispatch(setFavSong({
          identifier: podcast.id,
          name: podcast.publisher,
          service: 'AUDIO',
          songData,
        }));
        storedFavorites.songs = storedFavorites.songs || {};
        storedFavorites.songs[podcast.id] = {
          identifier: podcast.id,
          name: podcast.publisher,
          service: 'AUDIO',
        };
        await favoritesStorage.setItem('favorites', storedFavorites);
        toast.success('Podcast added to favorites!');
      }
    } catch (error) {
      console.error('Failed to toggle podcast favorite', error);
      toast.error('Could not update favorites. Please try again.');
    }
  }, [dispatch, favorites]);

  const handleLikePodcast = useCallback(async (podcast: Podcast) => {
    if (!username) {
      toast.error('Log in to like podcasts.');
      return;
    }

    const alreadyLiked = likedByUser[podcast.id];

    try {
      if (alreadyLiked) {
        await unlikePodcast(username, podcast.id);
        setLikedByUser((prev) => ({
          ...prev,
          [podcast.id]: false,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [podcast.id]: Math.max(0, (prev[podcast.id] ?? 1) - 1),
        }));
        toast.success(`Removed like from "${podcast.title}".`);
      } else {
        await publishPodcastLike(username, podcast);
        setLikedByUser((prev) => ({
          ...prev,
          [podcast.id]: true,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [podcast.id]: (prev[podcast.id] ?? 0) + 1,
        }));
        toast.success(`You liked "${podcast.title}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle podcast like', error);
      toast.error('Could not update like. Please try again.');
    }
  }, [likedByUser, username]);

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
        <PodcastToolbar
          slogan={SLOGAN}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onPublishClick={uploadPodcastModal.openCreate}
        />
      </Header>

      <div className="mt-6 flex flex-col gap-6">
        <Box className="p-6">
          <PodcastAlphabetFilter
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
              sortedPodcasts.forEach((podcast) => {
                const category = getPodcastCategory(podcast);
                if (!category) {
                  normalized.add(PODCAST_UNCATEGORIZED);
                } else {
                  normalized.add(category);
                }
              });
              const base: string[] = [...PODCAST_CATEGORIES];
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
          ) : paginatedPodcasts.length === 0 ? (
            <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
              No podcasts match the selected filter yet.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {paginatedPodcasts.map((podcast) => (
                <div key={podcast.id} id={`podcast-${podcast.id}`}>
                  <PodcastCard
                    podcast={podcast}
                    onPlay={handlePlayPodcast}
                    onLike={handleLikePodcast}
                    onAddFavorite={handleFavoritePodcast}
                    onAddToPlaylist={handleAddPodcastToPlaylist}
                    onDownload={handleDownloadPodcast}
                    onCopyLink={handleSharePodcast}
                    onSendTips={handleSendTips}
                    isHighlighted={podcast.id === highlightedPodcastId}
                    isFavorite={Boolean(favorites?.songs?.[podcast.id])}
                    isLiked={Boolean(likedByUser[podcast.id])}
                    likeCount={likeCounts[podcast.id] ?? 0}
                    onEdit={username === podcast.publisher ? handleEditPodcast : undefined}
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
    </div>
  );
};

export default Podcasts;
