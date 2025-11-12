import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import Box from '../../components/Box';
import {
  AudiobookToolbar,
  AudiobookSortOrder,
} from '../../components/audiobooks/AudiobookToolbar';
import { AudiobookAlphabetFilter } from '../../components/audiobooks/AudiobookAlphabetFilter';
import { AudiobookCard } from '../../components/audiobooks/AudiobookCard';
import { fetchAudiobooks } from '../../services/audiobooks';
import { Audiobook, Song } from '../../types';
import { CircularProgress } from '@mui/material';
import useUploadAudiobookModal from '../../hooks/useUploadAudiobookModal';
import useSendTipModal from '../../hooks/useSendTipModal';
import useAddSongToPlaylistModal from '../../hooks/useAddSongToPlaylistModal';
import { toast } from 'react-hot-toast';
import { buildAudiobookShareUrl } from '../../utils/qortalLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { Favorites, removeFavSong, setAddToDownloads, setCurrentSong, setFavSong } from '../../state/features/globalSlice';
import { deleteHostedData, deleteQdnResource, getQdnResourceUrl } from '../../utils/qortalApi';
import { buildDownloadFilename } from '../../utils/downloadFilename';
import { MyContext } from '../../wrappers/DownloadWrapper';
import localforage from 'localforage';
import {
  fetchAudiobookLikeCount,
  hasUserLikedAudiobook,
  likeAudiobook as publishAudiobookLike,
  unlikeAudiobook,
} from '../../services/audiobookLikes';
import { objectToBase64 } from '../../utils/toBase64';
import { AUDIOBOOK_CATEGORIES } from '../../constants/categories';
import SortControls from '../../components/common/SortControls';

const PAGE_SIZE = 15;
const SLOGAN = 'Immerse yourself in community-narrated stories, lessons, and adventures.';
const AUDIOBOOK_UNCATEGORIZED = 'Uncategorized';

const favoritesStorage = localforage.createInstance({
  name: 'ear-bump-audiobook-favorites',
});

const Audiobooks: React.FC = () => {
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const favorites = useSelector((state: RootState) => state.global.favorites);
  const [audiobooks, setAudiobooks] = useState<Audiobook[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<AudiobookSortOrder>('newest');
  const [activeLetter, setActiveLetter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const mountedRef = useRef(true);
  const uploadAudiobookModal = useUploadAudiobookModal();
  const sendTipModal = useSendTipModal();
  const addSongToPlaylistModal = useAddSongToPlaylistModal();
  const location = useLocation();
  const navigate = useNavigate();
  const [sharedAudiobookId, setSharedAudiobookId] = useState<string | null>(null);
  const [highlightedAudiobookId, setHighlightedAudiobookId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const sharedHandledRef = useRef<boolean>(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByUser, setLikedByUser] = useState<Record<string, boolean>>({});
  const pendingOptimisticRef = useRef<Map<string, Audiobook>>(new Map());

  const loadAudiobooks = useCallback(async (options: { showSpinner?: boolean } = {}) => {
    const { showSpinner = true } = options;
    if (showSpinner) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchAudiobooks({ limit: PAGE_SIZE, detailBatchSize: PAGE_SIZE });
      if (!mountedRef.current) return;
      setAudiobooks((prev) => {
        const merged = [...data];
        pendingOptimisticRef.current.forEach((optimisticAudiobook, id) => {
          const exists = merged.some((item) => item.id === id);
          if (!exists) {
            const fallback = prev.find((item) => item.id === id) || optimisticAudiobook;
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
      setError('Failed to load audiobooks. Please try again in a moment.');
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudiobooks();
  }, [loadAudiobooks]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetAudiobook = params.get('audiobook');
    if (targetAudiobook) {
      setSharedAudiobookId(targetAudiobook);
    }
  }, [location.search]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent<{
        audiobook?: Audiobook;
        audiobookId?: string;
        mode?: 'create' | 'edit' | 'delete';
      }>;
      const optimisticAudiobook = customEvent.detail?.audiobook;
      const targetId = optimisticAudiobook?.id ?? customEvent.detail?.audiobookId;
      const mode = customEvent.detail?.mode ?? 'create';

      if (mode === 'delete' && targetId) {
        pendingOptimisticRef.current.delete(targetId);
        setAudiobooks((prev) => prev.filter((item) => item.id !== targetId));
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

      if (optimisticAudiobook) {
        pendingOptimisticRef.current.set(optimisticAudiobook.id, optimisticAudiobook);
        setAudiobooks((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === optimisticAudiobook.id);
          if (existingIndex !== -1) {
            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...optimisticAudiobook };
            return next;
          }
          return [optimisticAudiobook, ...prev];
        });

        setLikeCounts((prev) => {
          if (prev[optimisticAudiobook.id] !== undefined) return prev;
          return {
            ...prev,
            [optimisticAudiobook.id]: 0,
          };
        });

        setLikedByUser((prev) => {
          if (prev[optimisticAudiobook.id] !== undefined) return prev;
          return {
            ...prev,
            [optimisticAudiobook.id]: false,
          };
        });

        if (mode === 'create') {
          setActiveLetter('ALL');
          setCurrentPage(1);
          setHighlightedAudiobookId(optimisticAudiobook.id);
        }
      }

      loadAudiobooks({ showSpinner: false });
    };

    window.addEventListener('audiobooks:refresh', handleRefresh);
    return () => {
      window.removeEventListener('audiobooks:refresh', handleRefresh);
    };
  }, [loadAudiobooks]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeLetter, sortOrder, selectedCategory]);

  useEffect(() => {
    setActiveLetter('ALL');
  }, [selectedCategory]);

  const getAudiobookCategory = useCallback((audiobook: Audiobook): string | null => {
    const category = audiobook.category;
    if (!category || typeof category !== 'string') return null;
    const trimmed = category.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const sortedAudiobooks = useMemo(() => {
    const collection = [...audiobooks];

    collection.sort((a, b) => {
      const aTimestamp = a.updated ?? a.created ?? 0;
      const bTimestamp = b.updated ?? b.created ?? 0;

      if (sortOrder === 'newest') {
        return bTimestamp - aTimestamp;
      }

      return aTimestamp - bTimestamp;
    });

    return collection;
  }, [audiobooks, sortOrder]);

  const categoryFilteredAudiobooks = useMemo(() => {
    if (selectedCategory === 'ALL') return sortedAudiobooks;
    return sortedAudiobooks.filter((audiobook) => {
      const category = getAudiobookCategory(audiobook) ?? AUDIOBOOK_UNCATEGORIZED;
      return category.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [sortedAudiobooks, selectedCategory, getAudiobookCategory]);

  const filteredAudiobooks = useMemo(() => {
    if (activeLetter === 'ALL') {
      return categoryFilteredAudiobooks;
    }

    return categoryFilteredAudiobooks.filter((audiobook) =>
      (audiobook.title || '')
        .trim()
        .toUpperCase()
        .startsWith(activeLetter.toUpperCase())
    );
  }, [categoryFilteredAudiobooks, activeLetter]);

  const totalPages = Math.max(1, Math.ceil(filteredAudiobooks.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedAudiobooks = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return filteredAudiobooks.slice(startIndex, endIndex);
  }, [filteredAudiobooks, currentPage]);

  useEffect(() => {
    let cancelled = false;
    if (paginatedAudiobooks.length === 0) return;

    const missing = paginatedAudiobooks.filter((audiobook) => likeCounts[audiobook.id] === undefined);
    if (missing.length === 0) return;

    const loadLikeCounts = async () => {
      try {
        const results = await Promise.all(
          missing.map(async (audiobook) => {
            const count = await fetchAudiobookLikeCount(audiobook.id);
            return { id: audiobook.id, count };
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
        console.error('Failed to load audiobook like counts', error);
      }
    };

    loadLikeCounts();

    return () => {
      cancelled = true;
    };
  }, [paginatedAudiobooks, likeCounts]);

  useEffect(() => {
    let cancelled = false;

    if (!username) {
      setLikedByUser({});
      return;
    }

    if (paginatedAudiobooks.length === 0) {
      return;
    }

    const missing = paginatedAudiobooks.filter((audiobook) => likedByUser[audiobook.id] === undefined);
    if (missing.length === 0) return;

    const loadUserLikes = async () => {
      try {
        const result = await Promise.all(
          missing.map(async (audiobook) => {
            const liked = await hasUserLikedAudiobook(username, audiobook.id);
            return { id: audiobook.id, liked };
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
        console.error('Failed to load user audiobook likes', error);
      }
    };

    loadUserLikes();

    return () => {
      cancelled = true;
    };
  }, [username, paginatedAudiobooks, likedByUser]);

  useEffect(() => {
    if (!sharedAudiobookId || sharedHandledRef.current) return;
    if (sortedAudiobooks.length === 0) return;

    sharedHandledRef.current = true;
    setActiveLetter('ALL');

    const index = sortedAudiobooks.findIndex((audiobook) => audiobook.id === sharedAudiobookId);
    if (index !== -1) {
      const page = Math.floor(index / PAGE_SIZE) + 1;
      setCurrentPage(page);
      setHighlightedAudiobookId(sharedAudiobookId);

      requestAnimationFrame(() => {
        const element = document.getElementById(`audiobook-${sharedAudiobookId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const params = new URLSearchParams(location.search);
    params.delete('audiobook');
    params.delete('audiobookPublisher');
    params.delete('type');
    const search = params.toString();
    navigate(`/audiobooks${search ? `?${search}` : ''}`, { replace: true });
  }, [sharedAudiobookId, sortedAudiobooks, location.search, navigate]);

  useEffect(() => {
    if (!highlightedAudiobookId) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightedAudiobookId(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedAudiobookId]);

  const handleSelectLetter = useCallback((letter: string) => {
    setActiveLetter(letter);
  }, []);

  const handleChangePage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }, [totalPages]);

  const handleShareAudiobook = useCallback(async (audiobook: Audiobook) => {
    try {
      const shareLink = buildAudiobookShareUrl(audiobook.publisher, audiobook.id);

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

      toast.success('Audiobook link copied! Happy sharing!');
    } catch (error) {
      console.error('Failed to share audiobook link', error);
      toast.error('Failed to copy the link. Please try again.');
    }
  }, []);

  const handlePlayAudiobook = useCallback(async (audiobook: Audiobook) => {
    try {
      const existingDownload = downloads[audiobook.id];
      const isReady =
        existingDownload?.status?.status === 'READY' ||
        audiobook.status?.status === 'READY';

      if (isReady) {
        const resolvedUrl =
          existingDownload?.url ||
          (await getQdnResourceUrl('AUDIO', audiobook.publisher, audiobook.id));

        dispatch(setAddToDownloads({
          name: audiobook.publisher,
          service: 'AUDIO',
          id: audiobook.id,
          identifier: audiobook.id,
          url: resolvedUrl ?? undefined,
          status: audiobook.status,
          title: audiobook.title || '',
          author: audiobook.publisher,
        }));
      } else {
        toast.success('Fetching the audiobook. It will start playing once ready.');
        downloadVideo({
          name: audiobook.publisher,
          service: 'AUDIO',
          identifier: audiobook.id,
          title: audiobook.title || '',
          author: audiobook.publisher,
          id: audiobook.id,
        });
      }

      dispatch(setCurrentSong(audiobook.id));
    } catch (error) {
      console.error('Failed to play audiobook', error);
      toast.error('Could not start the audiobook. Please try again.');
    }
  }, [dispatch, downloadVideo, downloads]);

  const handleDownloadAudiobook = useCallback(async (audiobook: Audiobook) => {
    try {
      const existingDownload = downloads[audiobook.id];
      const directUrl =
        existingDownload?.url ||
        (await getQdnResourceUrl('AUDIO', audiobook.publisher, audiobook.id));

      if (directUrl) {
        const anchor = document.createElement('a');
        anchor.href = directUrl;
        anchor.download = buildDownloadFilename({
          preferredFilename: audiobook.audioFilename,
          title: audiobook.title,
          fallbackId: audiobook.id,
          resolvedUrl: directUrl,
          mimeType: audiobook.audioMimeType,
        });
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.success('Audiobook download started.');

        dispatch(setAddToDownloads({
          name: audiobook.publisher,
          service: 'AUDIO',
          id: audiobook.id,
          identifier: audiobook.id,
          url: directUrl,
          status: audiobook.status,
          title: audiobook.title || '',
          author: audiobook.publisher,
        }));
        return;
      }

      const toastId = `download-${audiobook.id}`;
      toast.loading('Preparing download… This may take a moment.', { id: toastId });
      downloadVideo({
        name: audiobook.publisher,
        service: 'AUDIO',
        identifier: audiobook.id,
        title: audiobook.title || '',
        author: audiobook.publisher,
        id: audiobook.id,
      });

      window.setTimeout(async () => {
        const refreshedUrl = await getQdnResourceUrl('AUDIO', audiobook.publisher, audiobook.id);
        toast.dismiss(toastId);
        if (refreshedUrl) {
          const anchor = document.createElement('a');
          anchor.href = refreshedUrl;
          anchor.download = buildDownloadFilename({
            preferredFilename: audiobook.audioFilename,
            title: audiobook.title,
            fallbackId: audiobook.id,
            resolvedUrl: refreshedUrl,
            mimeType: audiobook.audioMimeType,
          });
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          toast.success('Audiobook download started.');
        } else {
          toast.error('Unable to fetch the audiobook file right now. Please try again shortly.');
        }
      }, 8000);
    } catch (error) {
      console.error('Failed to download audiobook', error);
      toast.error('Could not download the audiobook.');
    }
  }, [dispatch, downloadVideo, downloads]);

  const handleSendTips = useCallback(
    (audiobook: Audiobook) => {
      if (!username) {
        toast.error('Log in to send tips.');
        return;
      }

      if (!audiobook.publisher) {
        toast.error('Creator information is missing.');
        return;
      }

      sendTipModal.open(audiobook.publisher);
    },
    [sendTipModal, username],
  );

  const handleAddAudiobookToPlaylist = useCallback((songData: Song) => {
    if (!username) {
      toast.error('Log in to manage playlists.');
      return;
    }
    addSongToPlaylistModal.onOpen(songData);
  }, [addSongToPlaylistModal, username]);

  const handleDeleteAudiobook = useCallback(async (audiobook: Audiobook) => {
    if (!username) {
      toast.error('Log in to manage audiobooks.');
      return;
    }
    if (username !== audiobook.publisher) {
      toast.error('Only the original publisher can delete this audiobook.');
      return;
    }

    try {
      const deletionDocument = {
        id: audiobook.id,
        deleted: true,
        deletedAt: Date.now(),
        title: 'deleted',
        description: 'deleted',
        publisher: audiobook.publisher,
      };

      const deletionData64 = await objectToBase64(deletionDocument);

      await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        name: audiobook.publisher,
        service: 'DOCUMENT',
        identifier: audiobook.id,
        data64: deletionData64,
        encoding: 'base64',
        title: 'deleted',
        description: 'deleted',
      });

      const resources = [
        {
          name: audiobook.publisher,
          service: 'AUDIO',
          identifier: audiobook.id,
        },
        {
          name: audiobook.publisher,
          service: 'THUMBNAIL',
          identifier: audiobook.id,
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

      pendingOptimisticRef.current.delete(audiobook.id);
      setAudiobooks((prev) => prev.filter((item) => item.id !== audiobook.id));
      setLikeCounts((prev) => {
        if (prev[audiobook.id] === undefined) return prev;
        const next = { ...prev };
        delete next[audiobook.id];
        return next;
      });
      setLikedByUser((prev) => {
        if (prev[audiobook.id] === undefined) return prev;
        const next = { ...prev };
        delete next[audiobook.id];
        return next;
      });

      toast.success('Audiobook deleted.');
      window.dispatchEvent(
        new CustomEvent('audiobooks:refresh', {
          detail: { mode: 'delete', audiobookId: audiobook.id },
        }),
      );
      window.dispatchEvent(new CustomEvent('statistics:refresh'));
      loadAudiobooks({ showSpinner: false });
    } catch (error) {
      console.error('Failed to delete audiobook', error);
      toast.error('Could not delete the audiobook.');
    }
  }, [loadAudiobooks, username]);

  const handleEditAudiobook = useCallback((audiobook: Audiobook) => {
    if (!username) {
      toast.error('Log in to manage audiobooks.');
      return;
    }

    if (username !== audiobook.publisher) {
      toast.error('Only the original publisher can edit this audiobook.');
      return;
    }

    uploadAudiobookModal.openEdit(audiobook);
  }, [uploadAudiobookModal, username]);

  const handleFavoriteAudiobook = useCallback(async (audiobook: Audiobook) => {
    if (!favorites) {
      toast.error('Favorites are not ready yet. Please try again in a moment.');
      return;
    }

    try {
      const isFavorite = Boolean(favorites.songs?.[audiobook.id]);
      const songData: Song = {
        id: audiobook.id,
        title: audiobook.title,
        name: audiobook.publisher,
        service: 'AUDIO',
        author: audiobook.publisher,
      };

      const storedFavorites = (await favoritesStorage.getItem<Favorites>('favorites')) || {
        songs: {},
        playlists: {},
      };

      if (isFavorite) {
        dispatch(removeFavSong({
          identifier: audiobook.id,
          name: audiobook.publisher,
          service: 'AUDIO',
        }));
        if (storedFavorites.songs?.[audiobook.id]) {
          delete storedFavorites.songs[audiobook.id];
        }
        await favoritesStorage.setItem('favorites', storedFavorites);
        toast.success('Audiobook removed from favorites.');
      } else {
        dispatch(setFavSong({
          identifier: audiobook.id,
          name: audiobook.publisher,
          service: 'AUDIO',
          songData,
        }));
        storedFavorites.songs = storedFavorites.songs || {};
        storedFavorites.songs[audiobook.id] = {
          identifier: audiobook.id,
          name: audiobook.publisher,
          service: 'AUDIO',
        };
        await favoritesStorage.setItem('favorites', storedFavorites);
        toast.success('Audiobook added to favorites!');
      }
    } catch (error) {
      console.error('Failed to toggle audiobook favorite', error);
      toast.error('Could not update favorites. Please try again.');
    }
  }, [dispatch, favorites]);

  const handleLikeAudiobook = useCallback(async (audiobook: Audiobook) => {
    if (!username) {
      toast.error('Log in to like audiobooks.');
      return;
    }

    const alreadyLiked = likedByUser[audiobook.id];

    try {
      if (alreadyLiked) {
        await unlikeAudiobook(username, audiobook.id);
        setLikedByUser((prev) => ({
          ...prev,
          [audiobook.id]: false,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [audiobook.id]: Math.max(0, (prev[audiobook.id] ?? 1) - 1),
        }));
        toast.success(`Removed like from "${audiobook.title}".`);
      } else {
        await publishAudiobookLike(username, audiobook);
        setLikedByUser((prev) => ({
          ...prev,
          [audiobook.id]: true,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [audiobook.id]: (prev[audiobook.id] ?? 0) + 1,
        }));
        toast.success(`You liked "${audiobook.title}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle audiobook like', error);
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
        <AudiobookToolbar slogan={SLOGAN} />
      </Header>

      <div className="mt-6 flex flex-col gap-6">
        <Box className="p-6">
          <AudiobookAlphabetFilter
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
              sortedAudiobooks.forEach((audiobook) => {
                const category = getAudiobookCategory(audiobook);
                if (!category) {
                  normalized.add(AUDIOBOOK_UNCATEGORIZED);
                } else {
                  normalized.add(category);
                }
              });
              const base: string[] = [...AUDIOBOOK_CATEGORIES];
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
          ) : paginatedAudiobooks.length === 0 ? (
            <div className="rounded-md border border-sky-900/60 bg-sky-950/60 px-4 py-6 text-center text-sm font-semibold text-sky-200/80">
              No audiobooks match the selected filter yet.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {paginatedAudiobooks.map((audiobook) => (
                <div key={audiobook.id} id={`audiobook-${audiobook.id}`}>
                  <AudiobookCard
                    audiobook={audiobook}
                    onPlay={handlePlayAudiobook}
                    onLike={handleLikeAudiobook}
                    onAddFavorite={handleFavoriteAudiobook}
                    onAddToPlaylist={handleAddAudiobookToPlaylist}
                    onDownload={handleDownloadAudiobook}
                    onCopyLink={handleShareAudiobook}
                    onSendTips={handleSendTips}
                    isHighlighted={audiobook.id === highlightedAudiobookId}
                    isFavorite={Boolean(favorites?.songs?.[audiobook.id])}
                    isLiked={Boolean(likedByUser[audiobook.id])}
                    likeCount={likeCounts[audiobook.id] ?? 0}
                    onEdit={username === audiobook.publisher ? handleEditAudiobook : undefined}
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

export default Audiobooks;
