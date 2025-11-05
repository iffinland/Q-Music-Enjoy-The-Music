import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useSound from 'use-sound';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { AiFillStepBackward, AiFillStepForward } from 'react-icons/ai';
import { BsPauseFill, BsPlayFill } from 'react-icons/bs';
import { FiDownload, FiEdit2, FiInfo, FiMaximize2, FiMinimize2, FiThumbsUp } from 'react-icons/fi';
import { HiSpeakerWave, HiSpeakerXMark } from 'react-icons/hi2';
import { LuCopy } from 'react-icons/lu';
import { RiHandCoinLine } from 'react-icons/ri';

import Slider from './Slider';
import LikeButton from './LikeButton';
import { AddToPlaylistButton } from './AddToPlayistButton';
import radioImg from '../assets/img/enjoy-music.jpg';
import { RootState } from '../state/store';
import {
  PlayList,
  SongReference,
  Status,
  SongMeta,
  setAddToDownloads,
  setCurrentSong,
  setImageCoverHash,
  setVolumePlayer,
  upsertNowPlayingPlaylist,
} from '../state/features/globalSlice';
import { Song } from '../types';
import { MyContext } from '../wrappers/DownloadWrapper';
import { getQdnResourceUrl } from '../utils/qortalApi';
import { buildSongShareUrl } from '../utils/qortalLinks';
import useSendTipModal from '../hooks/useSendTipModal';
import useUploadModal from '../hooks/useUploadModal';
import { fetchSongLikeCount, hasUserLikedSong, likeSong, unlikeSong } from '../services/songLikes';

interface DownloadStatus {
  status?: string;
  percentLoaded?: number;
}

type DownloadEntry = Song & {
  identifier?: string;
  url?: string;
  status?: DownloadStatus;
  coverImage?: string | null;
};

type PlaylistSong = SongReference & { status?: Status; id?: string; url?: string; artist?: string };

interface PlayerPlaybackProps {
  song: DownloadEntry;
  songUrl: string;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onProgressChange?: (progress: { currentTime: number; duration: number }) => void;
  onRegisterControls?: (controls: PlayerExternalControls) => void;
}

interface PlayerLoadingProps {
  song: DownloadEntry;
  percentLoaded: number;
  onProgressChange?: (progress: { currentTime: number; duration: number }) => void;
}

interface QuickActionsProps {
  song: Song;
  favoriteSongData: Song;
  onOpenDetails: () => void;
  onCopyLink: () => void;
  onDownload: () => void;
  onSendTip: () => void;
  onToggleSongLike: () => void;
  songLikeCount: number | null;
  hasSongLike: boolean;
  isProcessingLike: boolean;
  isOwner: boolean;
  onEdit?: () => void;
  className?: string;
  compact?: boolean;
}

interface SongDetails {
  title: string;
  author: string;
  publisher: string;
  encodedPublisher: string | null;
  encodedIdentifier: string | null;
  coverImage: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const formatTime = (seconds: number | null | undefined) => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return '--:--';
  }

  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(wholeSeconds / 60);
  const secs = wholeSeconds % 60;

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const resolveAuthorName = (entry?: PlaylistSong | Song) => {
  if (!entry) return '';
  if ('author' in entry && entry.author) {
    return entry.author;
  }
  const fromPlaylist = entry as PlaylistSong;
  if (fromPlaylist.artist) {
    return fromPlaylist.artist;
  }
  return '';
};

const actionButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-md border border-sky-900/50 bg-sky-950/30 text-sky-100 transition hover:border-sky-700 hover:bg-sky-900/50 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/70';

interface PlayerExternalControls {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  next: () => void;
  previous: () => void;
  isPlaying: boolean;
  isLoaded: boolean;
}

const useSongDetails = (song?: Song): SongDetails => {
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);

  return useMemo(() => {
    const title = song?.title?.trim() || 'Unknown title';
    const author = song?.author?.trim() || 'Unknown artist';
    const publisher = song?.name?.trim() || '—';
    const encodedPublisher = song?.name ? encodeURIComponent(song.name) : null;
    const encodedIdentifier = song?.id ? encodeURIComponent(song.id) : null;
    const coverImage = (song?.id && imageCoverHash[song.id]) || radioImg;

    return { title, author, publisher, encodedPublisher, encodedIdentifier, coverImage };
  }, [song, imageCoverHash]);
};

const useSongLikeState = (song?: Song) => {
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const [songLikeCount, setSongLikeCount] = useState<number | null>(null);
  const [hasSongLike, setHasSongLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const loadLikes = async () => {
      if (!song?.id) {
        if (!cancelled) {
          setSongLikeCount(null);
          setHasSongLike(false);
        }
        return;
      }

      try {
        const count = await fetchSongLikeCount(song.id);
        if (!cancelled) {
          setSongLikeCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          setSongLikeCount(0);
        }
      }

      if (!username) {
        if (!cancelled) {
          setHasSongLike(false);
        }
        return;
      }

      try {
        const liked = await hasUserLikedSong(username, song.id);
        if (!cancelled) {
          setHasSongLike(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasSongLike(false);
        }
      }
    };

    loadLikes();

    return () => {
      cancelled = true;
    };
  }, [song?.id, username]);

  const handleToggleSongLike = useCallback(async () => {
    if (!song?.id || !song?.name) {
      toast.error('Song details are incomplete.');
      return;
    }

    if (!username) {
      toast.error('Log in to like songs.');
      return;
    }

    if (isProcessingLike) return;

    try {
      setIsProcessingLike(true);
      if (hasSongLike) {
        await unlikeSong(username, song.id);
        setHasSongLike(false);
        setSongLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
        toast.success(`Removed like from "${song.title || 'this song'}".`);
      } else {
        await likeSong(username, {
          id: song.id,
          name: song.name,
          title: song.title,
        });
        setHasSongLike(true);
        setSongLikeCount((prev) => (prev ?? 0) + 1);
        toast.success(`You liked "${song.title || 'this song'}"!`);
      }
    } catch (error) {
      console.error('Failed to toggle song like', error);
      toast.error('Could not update like. Please try again.');
    } finally {
      setIsProcessingLike(false);
    }
  }, [song?.id, song?.name, song?.title, username, isProcessingLike, hasSongLike]);

  return { songLikeCount, hasSongLike, isProcessingLike, handleToggleSongLike };
};

const useSongActions = (song?: Song) => {
  const navigate = useNavigate();
  const sendTipModal = useSendTipModal();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const dispatch = useDispatch();
  const uploadModal = useUploadModal();

  const isOwner = useMemo(() => {
    if (!username || !song?.name) return false;
    return username.toLowerCase() === song.name.toLowerCase();
  }, [song?.name, username]);

  const handleOpenDetails = useCallback(() => {
    if (!song?.name || !song?.id) {
      toast.error('Song details are missing.');
      return;
    }

    navigate(`/songs/${encodeURIComponent(song.name)}/${encodeURIComponent(song.id)}`);
  }, [navigate, song?.name, song?.id]);

  const copyToClipboard = useCallback(async (text: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!song?.name || !song?.id) {
      toast.error('Song link is not available.');
      return;
    }

    try {
      const shareLink = buildSongShareUrl(song.name, song.id);
      await copyToClipboard(shareLink);
      toast.success('Copying the link to the clipboard was successful. Happy sharing!');
    } catch (error) {
      console.error('Failed to copy song link', error);
      toast.error('Failed to copy the link. Please try again.');
    }
  }, [copyToClipboard, song?.id, song?.name]);

  const handleDownload = useCallback(async () => {
    if (!song?.name || !song?.id) {
      toast.error('Song publisher information is missing.');
      return;
    }

    try {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', song.name, song.id);
      if (!resolvedUrl) {
        toast.error('Song download is not available yet.');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download = `${(song.title || song.id || 'song').replace(/\s+/g, '_')}.audio`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      dispatch(
        setAddToDownloads({
          name: song.name,
          service: 'AUDIO',
          id: song.id,
          identifier: song.id,
          url: resolvedUrl,
          status: song.status,
          title: song.title || '',
          author: song.author || '',
        }),
      );
      toast.success('Song download started.');
    } catch (error) {
      console.error('Failed to download song', error);
      toast.error('Song could not be downloaded. Please try again later.');
    }
  }, [dispatch, song]);

  const handleSendTip = useCallback(() => {
    if (!username) {
      toast.error('Log in to send tips.');
      return;
    }

    if (!song?.name) {
      toast.error('Creator information is missing.');
      return;
    }

    sendTipModal.open(song.name);
  }, [sendTipModal, song?.name, username]);

  const handleEdit = useCallback(() => {
    if (!song) return;
    if (!isOwner) {
      toast.error('Only the original publisher can edit this song.');
      return;
    }

    const baseline = song as Partial<SongMeta>;
    const now = Date.now();
    const songMeta: SongMeta = {
      title: baseline.title || '',
      description: baseline.description ?? '',
      created: baseline.created ?? now,
      updated: baseline.updated ?? now,
      name: baseline.name || '',
      id: baseline.id || '',
      status: baseline.status,
      author: baseline.author,
      service: baseline.service,
      genre: baseline.genre,
      mood: baseline.mood,
      language: baseline.language,
      notes: baseline.notes,
    };

    uploadModal.openSingleEdit(songMeta);
  }, [isOwner, song, uploadModal]);

  return {
    handleOpenDetails,
    handleCopyLink,
    handleDownload,
    handleSendTip,
    handleEdit,
    isOwner,
  };
};

const SongHeader: React.FC<{
  details: SongDetails;
  onOpenDetails: () => void;
  className?: string;
}> = ({ details, onOpenDetails, className }) => (
  <div className={`flex items-center gap-3 sm:gap-4 ${className ?? ''}`}>
    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-sky-900/50 bg-sky-950/40 sm:h-14 sm:w-14">
      <img
        src={details.coverImage}
        alt={details.title}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    </div>
    <div className="min-w-0">
      <button
        type="button"
        onClick={onOpenDetails}
        className="w-full truncate text-left text-sm font-semibold text-white transition hover:text-sky-200 sm:text-base"
        title="Open song detail info page"
      >
        {details.title}
      </button>
      <p className="truncate text-xs text-sky-200/80 sm:text-sm">{details.author}</p>
    </div>
  </div>
);

const QuickActions: React.FC<QuickActionsProps> = ({
  song,
  favoriteSongData,
  onOpenDetails,
  onCopyLink,
  onDownload,
  onSendTip,
  onToggleSongLike,
  songLikeCount,
  hasSongLike,
  isProcessingLike,
  isOwner,
  onEdit,
  className,
  compact = false,
}) => {
  const containerClass = compact
    ? 'flex flex-wrap items-center gap-2'
    : 'flex flex-col gap-2';
  const rowClass = compact
    ? 'flex flex-wrap items-center gap-2'
    : 'flex flex-wrap gap-2';

  return (
    <div className={`${containerClass}${className ? ` ${className}` : ''}`}>
      <div className={rowClass}>
        <button
          type="button"
          onClick={onOpenDetails}
          className={actionButtonClass}
          title="Open song detail info page"
        aria-label="Open song detail info page"
      >
        <FiInfo size={18} />
      </button>
      <LikeButton
        songId={song.id}
        name={song.name}
        service={song.service || 'AUDIO'}
        songData={favoriteSongData}
        className={`${actionButtonClass} `}
        activeClassName="!bg-emerald-600/80 !border-emerald-400/80 hover:!bg-emerald-500/80"
        inactiveClassName="!bg-sky-950/40 !border-sky-900/60 hover:!bg-sky-900/50"
        iconSize={18}
        title="Add to Favorites"
        ariaLabel="Add to Favorites"
      />
      <AddToPlaylistButton
        song={song}
        iconSize={18}
        className={`${actionButtonClass} !p-0`}
      />
      <button
        type="button"
        onClick={onToggleSongLike}
        disabled={isProcessingLike}
        className={`${actionButtonClass} !w-auto min-w-[3.25rem] px-3 ${hasSongLike ? '!bg-sky-800/70 !border-sky-600/80' : ''}`}
        title="Like It"
        aria-label="Like It"
      >
        <FiThumbsUp size={18} />
        <span className="ml-1 text-xs font-semibold">{songLikeCount ?? '—'}</span>
      </button>
    </div>
    <div className={rowClass}>
      <button
        type="button"
        onClick={onCopyLink}
        className={actionButtonClass}
        title="Copy link & Share It"
        aria-label="Copy link & Share It"
      >
        <LuCopy size={18} />
      </button>
      <button
        type="button"
        onClick={onDownload}
        className={actionButtonClass}
        title="Download this"
        aria-label="Download this"
      >
        <FiDownload size={18} />
      </button>
      <button
        type="button"
        onClick={onSendTip}
        className={actionButtonClass}
        title="Send Tips to Publisher"
        aria-label="Send Tips to Publisher"
      >
        <RiHandCoinLine size={18} />
      </button>
      {isOwner && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className={actionButtonClass}
          title="Edit song"
          aria-label="Edit song"
        >
          <FiEdit2 size={18} />
        </button>
      )}
    </div>
  </div>
  );
};

const VolumeControl: React.FC<{
  volume: number;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  className?: string;
}> = ({ volume, onVolumeChange, onToggleMute, className }) => {
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;
  const volumePercent = Math.round(volume * 100);

  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-sky-900/40 bg-sky-950/30 px-2.5 py-1.5 text-sky-100 ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={onToggleMute}
        className="flex items-center gap-1.5 text-sky-100/80 transition hover:text-white"
        title={volume === 0 ? 'Unmute' : 'Mute'}
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon size={18} />
        <span className="hidden text-[11px] font-semibold uppercase tracking-wide md:inline">
          {volume === 0 ? 'Unmute' : 'Mute'}
        </span>
      </button>
      <div className="flex min-w-[140px] flex-1 items-center gap-2">
        <Slider
          value={volume}
          onChange={(value) => onVolumeChange(clamp(value))}
          step={0.05}
          ariaLabel="Volume"
          styles={{ padding: '4px 0' }}
        />
        <span className="text-[11px] font-semibold text-sky-200/70 tabular-nums">{volumePercent}%</span>
      </div>
    </div>
  );
};

const PlayerPlayback: React.FC<PlayerPlaybackProps> = ({
  song,
  songUrl,
  onPlaybackStateChange,
  onProgressChange,
  onRegisterControls,
}) => {
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const volume = useSelector((state: RootState) => state.global.volume);
  const nowPlayingPlaylist = useSelector((state: RootState) => state.global.nowPlayingPlaylist);
  const favoriteList = useSelector((state: RootState) => state.global.favoriteList);
  const currentPlaylist = useSelector((state: RootState) => state.global.currentPlaylist);
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash as Record<string, PlayList>);
  const downloads = useSelector(
    (state: RootState) => state.global.downloads as Record<string, DownloadEntry>,
  );

  const details = useSongDetails(song);
  const {
    handleOpenDetails,
    handleCopyLink,
    handleDownload,
    handleSendTip,
    handleEdit,
    isOwner,
  } = useSongActions(song);
  const { songLikeCount, hasSongLike, isProcessingLike, handleToggleSongLike } = useSongLikeState(song);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const previousVolumeRef = useRef(volume || 0.75);

  useEffect(() => {
    if (volume > 0) {
      previousVolumeRef.current = volume;
    }
  }, [volume]);

  const setVolume = useCallback(
    (value: number) => {
      dispatch(setVolumePlayer(clamp(value)));
    },
    [dispatch],
  );

  const toggleMute = useCallback(() => {
    if (volume === 0) {
      setVolume(previousVolumeRef.current || 0.75);
    } else {
      previousVolumeRef.current = volume;
      setVolume(0);
    }
  }, [setVolume, volume]);

  const resolveIdentifier = useCallback(
    (entry?: { id?: string; identifier?: string }) => entry?.id ?? entry?.identifier,
    [],
  );

  const playSongByIdentifier = useCallback(
    async (songToPlay?: PlaylistSong | Song) => {
      if (!songToPlay) return;

      const downloadKey = resolveIdentifier(songToPlay);
      if (!downloadKey || !songToPlay.name) {
        return;
      }

      dispatch(setCurrentSong(downloadKey));

      const authorName = resolveAuthorName(songToPlay);

      if (
        songToPlay?.status?.status === 'READY' ||
        downloads[downloadKey]?.status?.status === 'READY'
      ) {
        const resolvedUrl = await getQdnResourceUrl('AUDIO', songToPlay.name, downloadKey);
        dispatch(
          setAddToDownloads({
            name: songToPlay.name,
            service: 'AUDIO',
            id: downloadKey,
            identifier: downloadKey,
            url: resolvedUrl ?? undefined,
            status: songToPlay?.status,
            title: songToPlay?.title || '',
            author: authorName,
          }),
        );
      } else {
        downloadVideo({
          name: songToPlay.name,
          service: 'AUDIO',
          identifier: downloadKey,
          title: songToPlay?.title || '',
          author: authorName,
          id: downloadKey,
        });
      }
    },
    [dispatch, downloadVideo, downloads, resolveIdentifier],
  );

  const handlePlaylistNavigation = useCallback(
    async (direction: 'next' | 'previous') => {
      if (currentPlaylist === 'nowPlayingPlaylist') {
        if (nowPlayingPlaylist.length === 0) return;
        const currentIndex = nowPlayingPlaylist.findIndex((item) => item.id === song.id);
        const nextIndex =
          direction === 'next'
            ? (currentIndex + 1) % nowPlayingPlaylist.length
            : (currentIndex - 1 + nowPlayingPlaylist.length) % nowPlayingPlaylist.length;
        await playSongByIdentifier(nowPlayingPlaylist[nextIndex]);
        return;
      }

      if (currentPlaylist === 'likedPlaylist') {
        if (favoriteList.length === 0) return;
        const currentIndex = favoriteList.findIndex((item) => item.id === song.id);
        const nextIndex =
          direction === 'next'
            ? (currentIndex + 1) % favoriteList.length
            : (currentIndex - 1 + favoriteList.length) % favoriteList.length;
        await playSongByIdentifier(favoriteList[nextIndex]);
        return;
      }

      const playlist = playlistHash[currentPlaylist];
      if (playlist) {
        const songs = (playlist.songs as PlaylistSong[]) || [];
        if (songs.length === 0) return;
        const currentIndex = songs.findIndex((item) => item?.identifier === song?.id);
        const nextIndex =
          direction === 'next'
            ? (currentIndex + 1) % songs.length
            : (currentIndex - 1 + songs.length) % songs.length;
        await playSongByIdentifier(songs[nextIndex]);
      }
    },
    [currentPlaylist, favoriteList, nowPlayingPlaylist, playlistHash, playSongByIdentifier, song?.id],
  );

  const [play, { pause, sound }] = useSound(songUrl || '', {
    volume,
    onplay: () => {
      setIsLoaded(true);
      setIsPlaying(true);
      onPlaybackStateChange(true);
    },
    onend: () => {
      setIsPlaying(false);
      onPlaybackStateChange(false);
      void handlePlaylistNavigation('next');
    },
    onpause: () => {
      setIsPlaying(false);
      onPlaybackStateChange(false);
    },
    format: ['mp3', 'wav', 'ogg'],
    onload: () => {
      const total = sound?.duration() ?? 0;
      setDuration(total);
    },
  });

  useEffect(() => {
    setIsLoaded(false);
    setIsPlaying(false);
    onPlaybackStateChange(false);
    setCurrentTime(0);
  }, [song.id, onPlaybackStateChange]);

  useEffect(() => {
    sound?.play();
    return () => {
      onPlaybackStateChange(false);
      sound?.unload();
    };
  }, [onPlaybackStateChange, sound]);

  useEffect(() => {
    if (!sound) return undefined;

    const interval = setInterval(() => {
      const seek = sound.seek() as number;
      if (Number.isFinite(seek)) {
        setCurrentTime(seek);
      }
      const totalDuration = sound.duration();
      if (Number.isFinite(totalDuration)) {
        setDuration(totalDuration);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [sound]);

  useEffect(() => {
    dispatch(upsertNowPlayingPlaylist([song]));
  }, [dispatch, song]);

  const handlePlayPause = useCallback(() => {
    if (!isLoaded) return;

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isLoaded, isPlaying, pause, play]);

  const handleProgressChange = useCallback(
    (value: number) => {
      if (!sound || duration <= 0) return;

      const newTime = clamp(value) * duration;
      sound.seek(newTime);
      setCurrentTime(newTime);
    },
    [duration, sound],
  );

  const progress = duration > 0 ? clamp(currentTime / duration) : 0;
  const elapsed = formatTime(currentTime);
  const total = formatTime(duration);
  const remaining = formatTime(Math.max(duration - currentTime, 0));

  const favoriteSongData: Song = {
    id: song.id,
    title: song.title,
    name: song.name,
    author: song.author,
    service: song.service,
  };

  useEffect(() => {
    onProgressChange?.({ currentTime, duration });
  }, [currentTime, duration, onProgressChange]);

  useEffect(() => {
    if (!onRegisterControls) return;

    onRegisterControls({
      play: () => {
        play();
      },
      pause,
      togglePlayPause: () => {
        handlePlayPause();
      },
      next: () => {
        void handlePlaylistNavigation('next');
      },
      previous: () => {
        void handlePlaylistNavigation('previous');
      },
      isPlaying,
      isLoaded,
    });
  }, [
    handlePlayPause,
    handlePlaylistNavigation,
    isLoaded,
    isPlaying,
    onRegisterControls,
    pause,
    play,
  ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-sky-900/40 bg-sky-950/35 p-3 md:p-3.5">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <SongHeader
            details={details}
            onOpenDetails={handleOpenDetails}
            className="order-1 flex min-w-[200px] flex-1 md:min-w-[220px] md:flex-none"
          />
          <div className="order-2 flex items-center justify-center gap-2 md:order-3 md:flex-none">
            <button
              type="button"
              onClick={() => handlePlaylistNavigation('previous')}
              className={actionButtonClass}
              title="Previous song"
              aria-label="Previous song"
            >
              <AiFillStepBackward size={18} />
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              className={`${actionButtonClass} !h-12 !w-12 !bg-white !text-black hover:!bg-sky-100`}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!isLoaded}
            >
              {isLoaded ? (
                isPlaying ? (
                  <BsPauseFill size={22} />
                ) : (
                  <BsPlayFill size={22} />
                )
              ) : (
                <CircularProgress size={22} />
              )}
            </button>
            <button
              type="button"
              onClick={() => handlePlaylistNavigation('next')}
              className={actionButtonClass}
              title="Next song"
              aria-label="Next song"
            >
              <AiFillStepForward size={18} />
            </button>
          </div>
          <QuickActions
            song={song}
            favoriteSongData={favoriteSongData}
            onOpenDetails={handleOpenDetails}
            onCopyLink={handleCopyLink}
            onDownload={handleDownload}
            onSendTip={handleSendTip}
            onToggleSongLike={handleToggleSongLike}
            songLikeCount={songLikeCount}
            hasSongLike={hasSongLike}
            isProcessingLike={isProcessingLike}
            isOwner={isOwner}
            onEdit={handleEdit}
            compact
            className="order-3 flex w-full flex-wrap justify-start gap-2 md:order-2 md:w-auto md:flex-1 md:justify-center"
          />
          <VolumeControl
            volume={volume}
            onVolumeChange={setVolume}
            onToggleMute={toggleMute}
            className="order-4 w-full md:order-4 md:ml-auto md:w-auto md:flex-shrink-0"
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Slider
            value={progress}
            onChange={handleProgressChange}
            step={0.01}
            ariaLabel="Playback position"
            disabled={!isLoaded || duration <= 0}
            styles={{ padding: '4px 0 0' }}
          />
          <div className="flex items-center justify-between text-[11px] font-semibold text-sky-200/70 tabular-nums sm:text-xs">
            <span>Total {total}</span>
            <span>Elapsed {elapsed}</span>
            <span>-{remaining}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MiniPlayerProps {
  coverImage: string;
  title: string;
  author: string;
  isPlaying: boolean;
  isLoaded: boolean;
  progress: { currentTime: number; duration: number };
  onExpand: () => void;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  volume: number;
  onVolumeChange?: (value: number) => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({
  coverImage,
  title,
  author,
  isPlaying,
  isLoaded,
  progress,
  onExpand,
  onPlayPause,
  onNext,
  onPrevious,
  onToggleMute,
  isMuted,
  volume,
  onVolumeChange,
}) => {
  const progressValue = progress.duration > 0 ? clamp(progress.currentTime / progress.duration) : 0;
  const totalFormatted = formatTime(progress.duration);
  const remainingFormatted = formatTime(Math.max(progress.duration - progress.currentTime, 0));
  const VolumeIcon = isMuted ? HiSpeakerXMark : HiSpeakerWave;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-md px-2 sm:px-0">
      <div className="flex items-stretch gap-3 rounded-xl border border-sky-900/60 bg-sky-950/90 p-3 text-white shadow-xl backdrop-blur">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-sky-900/60 bg-sky-950/60">
                <img
                  src={coverImage}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPrevious}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-900/60 bg-sky-950/60 text-white transition hover:border-sky-600 hover:bg-sky-900/60 disabled:opacity-40"
                  disabled={!onPrevious}
                  title="Previous song"
                  aria-label="Previous song"
                >
                  <AiFillStepBackward size={18} />
                </button>
                <button
                  type="button"
                  onClick={onPlayPause}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
                  disabled={!isLoaded || !onPlayPause}
                  title={isPlaying ? 'Pause' : 'Play'}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <BsPauseFill size={24} /> : <BsPlayFill size={24} />}
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-900/60 bg-sky-950/60 text-white transition hover:border-sky-600 hover:bg-sky-900/60 disabled:opacity-40"
                  disabled={!onNext}
                  title="Next song"
                  aria-label="Next song"
                >
                  <AiFillStepForward size={18} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onExpand}
              className="flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow transition hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              title="Open full player"
              aria-label="Open full player"
            >
              <FiMaximize2 size={14} />
              Open Player
            </button>
          </div>
          <div className="space-y-1">
            <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
            <p className="truncate text-xs text-sky-200/80 sm:text-sm">{author}</p>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-900/60">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressValue * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-sky-200/80 sm:text-xs">
              <span>{totalFormatted}</span>
              <span>-{remainingFormatted}</span>
            </div>
          </div>
        </div>
        <div className="flex w-12 flex-col items-center gap-3 rounded-lg px-2 py-3 text-slate-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-amber-200/60">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-slate-900 transition hover:bg-amber-400"
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <VolumeIcon size={22} />
          </button>
          <div className="relative flex-1 min-h-[96px] w-full">
            <Slider
              orientation="vertical"
              value={isMuted ? 0 : volume}
              onChange={(value) => onVolumeChange?.(clamp(value))}
              step={0.05}
              ariaLabel="Volume"
              styles={{ height: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayerLoading: React.FC<PlayerLoadingProps> = ({ song, percentLoaded, onProgressChange }) => {
  const volume = useSelector((state: RootState) => state.global.volume);
  const dispatch = useDispatch();

  const details = useSongDetails(song);
  const {
    handleOpenDetails,
    handleCopyLink,
    handleDownload,
    handleSendTip,
    handleEdit,
    isOwner,
  } = useSongActions(song);
  const { songLikeCount, hasSongLike, isProcessingLike, handleToggleSongLike } = useSongLikeState(song);

  const setVolume = useCallback(
    (value: number) => {
      dispatch(setVolumePlayer(clamp(value)));
    },
    [dispatch],
  );

  const toggleMute = useCallback(() => {
    dispatch(setVolumePlayer(volume === 0 ? 0.75 : 0));
  }, [dispatch, volume]);

  const favoriteSongData: Song = {
    id: song.id,
    title: song.title,
    name: song.name,
    author: song.author,
    service: song.service,
  };

  useEffect(() => {
    onProgressChange?.({ currentTime: 0, duration: 0 });
  }, [onProgressChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-sky-900/40 bg-sky-950/35 p-3 md:p-3.5">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <SongHeader
            details={details}
            onOpenDetails={handleOpenDetails}
            className="order-1 flex min-w-[200px] flex-1 md:min-w-[220px] md:flex-none"
          />
          <div className="order-2 flex items-center gap-2 text-sky-200/70 md:order-3">
            <CircularProgress size={18} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Loading</span>
          </div>
          <QuickActions
            song={song}
            favoriteSongData={favoriteSongData}
            onOpenDetails={handleOpenDetails}
            onCopyLink={handleCopyLink}
            onDownload={handleDownload}
            onSendTip={handleSendTip}
            onToggleSongLike={handleToggleSongLike}
            songLikeCount={songLikeCount}
            hasSongLike={hasSongLike}
            isProcessingLike={isProcessingLike}
            isOwner={isOwner}
            onEdit={handleEdit}
            compact
            className="order-3 flex w-full flex-wrap justify-start gap-2 md:order-2 md:w-auto md:flex-1 md:justify-center"
          />
          <VolumeControl
            volume={volume}
            onVolumeChange={setVolume}
            onToggleMute={toggleMute}
            className="order-4 w-full md:order-4 md:ml-auto md:w-auto md:flex-shrink-0"
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Slider value={0} disabled ariaLabel="Playback position" styles={{ padding: '4px 0 0' }} />
          <div className="flex items-center justify-between text-[11px] font-semibold text-sky-200/70 tabular-nums sm:text-xs">
            <span>Total --:--</span>
            <span>Elapsed --:--</span>
            <span>- --:--</span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-sky-900/40 bg-sky-950/30 p-3 text-sky-200/80">
        <div className="flex items-center gap-2">
          <CircularProgress size={20} />
          <p className="text-xs font-semibold uppercase tracking-wide">
            Preparing audio… {Math.max(0, percentLoaded)}%
          </p>
        </div>
      </div>
    </div>
  );
};

const Player = () => {
  const dispatch = useDispatch();
  const hasRedownloaded = useRef(false);
  const currentSongId = useSelector((state: RootState) => state.global.currentSong);
  const downloads = useSelector(
    (state: RootState) => state.global.downloads as Record<string, DownloadEntry>,
  );
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const volume = useSelector((state: RootState) => state.global.volume);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playbackTimes, setPlaybackTimes] = useState({ currentTime: 0, duration: 0 });
  const [externalControls, setExternalControls] = useState<PlayerExternalControls | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'player-equalizer-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@keyframes player-equalize {0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); }}`;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (currentSongId) {
      hasRedownloaded.current = false;
    }
  }, [currentSongId]);

  const songItem = useMemo<DownloadEntry | undefined>(() => {
    if (!currentSongId) return undefined;
    return downloads[currentSongId];
  }, [downloads, currentSongId]);

  const status = songItem?.status?.status ?? '';
  const songUrl = status === 'READY' && songItem?.url ? songItem.url : null;

  useEffect(() => {
    if (!songUrl) {
      setIsAudioPlaying(false);
    }
  }, [songUrl]);

  interface ResourceIdentifier {
    name: string;
    service: string;
    identifier: string;
  }

  const refetch = useCallback(async ({ name, service, identifier }: ResourceIdentifier) => {
    try {
      await qortalRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier,
      });
    } catch (error) {
      console.error('Failed to refresh resource status', error);
    }
  }, []);

  useEffect(() => {
    if (songItem && status === 'DOWNLOADED' && hasRedownloaded.current === false) {
      const identifier = songItem.identifier ?? songItem.id;
      if (!identifier) {
        return;
      }

      refetch({
        name: songItem.name,
        service: 'AUDIO',
        identifier,
      });

      hasRedownloaded.current = true;
    }
  }, [status, songItem, refetch]);

  useEffect(() => {
    if (!songItem?.name) return;
    const candidateIds = [songItem.identifier, songItem.id].filter(
      (value): value is string => Boolean(value),
    );

    const hasCover = candidateIds.some((id) => imageCoverHash[id]) || Boolean(songItem.coverImage);
    if (hasCover) return;

    let isCancelled = false;

    const loadCover = async () => {
      const identifier = songItem.identifier ?? songItem.id;
      if (!identifier) return;

      try {
        const url = await getQdnResourceUrl('THUMBNAIL', songItem.name, identifier);
        if (
          !isCancelled &&
          typeof url === 'string' &&
          url.trim().length > 0 &&
          url !== 'Resource does not exist'
        ) {
          dispatch(setImageCoverHash({ id: identifier, url }));
          if (songItem.id && songItem.id !== identifier) {
            dispatch(setImageCoverHash({ id: songItem.id, url }));
          }
        }
      } catch (error) {
        console.error('Failed to load cover image', error);
      }
    };

    void loadCover();

    return () => {
      isCancelled = true;
    };
  }, [dispatch, imageCoverHash, songItem]);

  useEffect(() => {
    if (!songUrl) {
      setPlaybackTimes({ currentTime: 0, duration: 0 });
    }
  }, [songUrl]);

  const handleVolumeChangeCollapsed = useCallback(
    (value: number) => {
      dispatch(setVolumePlayer(clamp(value)));
    },
    [dispatch],
  );

  if (!songItem) return null;

  const percentLoaded = Math.round(songItem?.status?.percentLoaded ?? 0);
  const coverImage =
    (songItem?.id && imageCoverHash[songItem.id]) ||
    (songItem?.identifier && imageCoverHash[songItem.identifier]) ||
    (songItem?.coverImage ?? null) ||
    radioImg;

  return (
    <>
      <div className={`${isCollapsed ? 'hidden' : ''} fixed bottom-0 left-0 right-0 z-40`}>
        <div className="border-t border-sky-900/60 bg-sky-950/25 backdrop-blur-lg">
          <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-2 sm:px-6">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                title="Hide player"
                aria-label="Hide player"
              >
                <FiMinimize2 size={16} />
                <span className="hidden sm:inline">Collapse</span>
              </button>
            </div>
            {songUrl ? (
              <PlayerPlayback
                song={songItem}
                songUrl={songUrl}
                onPlaybackStateChange={setIsAudioPlaying}
                onProgressChange={({ currentTime, duration }) =>
                  setPlaybackTimes({ currentTime, duration })
                }
                onRegisterControls={setExternalControls}
              />
            ) : (
              <PlayerLoading
                song={songItem}
                percentLoaded={percentLoaded}
                onProgressChange={({ currentTime, duration }) =>
                  setPlaybackTimes({ currentTime, duration })
                }
              />
            )}
          </div>
        </div>
      </div>

      {isCollapsed && (
        <MiniPlayer
          coverImage={coverImage}
          title={songItem?.title || 'Unknown title'}
          author={songItem?.author || 'Unknown artist'}
          isPlaying={externalControls?.isPlaying ?? isAudioPlaying}
          isLoaded={externalControls?.isLoaded ?? false}
          progress={playbackTimes}
          onExpand={() => setIsCollapsed(false)}
          onPlayPause={
            externalControls ? () => externalControls.togglePlayPause() : undefined
          }
          onNext={externalControls ? () => externalControls.next() : undefined}
          onPrevious={externalControls ? () => externalControls.previous() : undefined}
          onToggleMute={() => dispatch(setVolumePlayer(volume === 0 ? 0.75 : 0))}
          isMuted={volume === 0}
          volume={volume}
          onVolumeChange={handleVolumeChangeCollapsed}
        />
      )}
    </>
  );
};

export default Player;
