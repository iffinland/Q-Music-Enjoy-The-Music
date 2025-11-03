import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useSound from 'use-sound';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { AiFillStepBackward, AiFillStepForward } from 'react-icons/ai';
import { BsPauseFill, BsPlayFill } from 'react-icons/bs';
import { FiDownload, FiEdit2, FiInfo, FiMinimize2, FiThumbsUp } from 'react-icons/fi';
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
};

type PlaylistSong = SongReference & { status?: Status; id?: string; url?: string; artist?: string };

interface PlayerPlaybackProps {
  song: DownloadEntry;
  songUrl: string;
  onCollapse: () => void;
  onPlaybackStateChange: (isPlaying: boolean) => void;
}

interface PlayerLoadingProps {
  song: DownloadEntry;
  percentLoaded: number;
  onCollapse: () => void;
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
  'flex h-10 w-10 items-center justify-center rounded-full border border-sky-900/60 bg-sky-950/40 text-sky-100 transition hover:border-sky-700 hover:bg-sky-900/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70';

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
  onCollapse?: () => void;
}> = ({ details, onOpenDetails, onCollapse }) => (
  <div className="flex items-start justify-between gap-3 sm:gap-4">
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-sky-900/50 bg-sky-950/40 sm:h-20 sm:w-20">
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
          className="w-full truncate text-left text-base font-semibold text-white hover:text-sky-200 transition"
          title="Open song detail info page"
        >
          {details.title}
        </button>
        <p className="truncate text-sm text-sky-200/80">{details.author}</p>
      </div>
    </div>
    {onCollapse && (
      <button
        type="button"
        onClick={onCollapse}
        className={`${actionButtonClass} !h-9 !w-9`}
        title="Hide player"
        aria-label="Hide player"
      >
        <FiMinimize2 size={16} />
      </button>
    )}
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
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
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
    <div className="flex flex-wrap gap-2">
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

const VolumeControl: React.FC<{
  volume: number;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
}> = ({ volume, onVolumeChange, onToggleMute }) => {
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;
  const volumePercent = Math.round(volume * 100);

  return (
    <div className="flex flex-col gap-2 rounded-md bg-sky-900/20 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <button
        type="button"
        onClick={onToggleMute}
        className="flex items-center gap-2 text-sky-100/80 transition hover:text-white"
        title={volume === 0 ? 'Unmute' : 'Mute'}
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon size={28} />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {volume === 0 ? 'Unmute' : 'Mute'}
        </span>
      </button>
      <div className="flex flex-1 items-center gap-3">
        <Slider
          value={volume}
          onChange={(value) => onVolumeChange(clamp(value))}
          step={0.05}
          ariaLabel="Volume"
          styles={{ padding: '12px 0' }}
        />
        <span className="text-xs font-semibold text-sky-200/70 tabular-nums">{volumePercent}%</span>
      </div>
    </div>
  );
};

const PlayerPlayback: React.FC<PlayerPlaybackProps> = ({
  song,
  songUrl,
  onCollapse,
  onPlaybackStateChange,
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

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-4 md:w-2/5 lg:w-1/3">
        <SongHeader details={details} onOpenDetails={handleOpenDetails} onCollapse={onCollapse} />
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
        />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-sky-900/50 bg-sky-950/40 p-3">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => handlePlaylistNavigation('previous')}
              className={actionButtonClass}
              title="Previous song"
              aria-label="Previous song"
            >
              <AiFillStepBackward size={22} />
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              className={`${actionButtonClass} !h-14 !w-14 !bg-white !text-black hover:!bg-sky-100`}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!isLoaded}
            >
              {isLoaded ? (
                isPlaying ? (
                  <BsPauseFill size={28} />
                ) : (
                  <BsPlayFill size={28} />
                )
              ) : (
                <CircularProgress size={26} />
              )}
            </button>
            <button
              type="button"
              onClick={() => handlePlaylistNavigation('next')}
              className={actionButtonClass}
              title="Next song"
              aria-label="Next song"
            >
              <AiFillStepForward size={22} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Slider
              value={progress}
              onChange={handleProgressChange}
              step={0.01}
              ariaLabel="Playback position"
              disabled={!isLoaded || duration <= 0}
              styles={{ padding: '4px 0 0' }}
            />
            <div className="flex items-center justify-between text-xs font-semibold text-sky-200/70 tabular-nums">
              <span>Total {total}</span>
              <span>Elapsed {elapsed}</span>
              <span>-{remaining}</span>
            </div>
          </div>
          <VolumeControl volume={volume} onVolumeChange={setVolume} onToggleMute={toggleMute} />
        </div>
      </div>
    </div>
  );
};

const PlayerLoading: React.FC<PlayerLoadingProps> = ({ song, percentLoaded, onCollapse }) => {
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

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-4 md:w-2/5 lg:w-1/3">
        <SongHeader details={details} onOpenDetails={handleOpenDetails} onCollapse={onCollapse} />
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
        />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-sky-900/50 bg-sky-950/40 p-4 text-center text-sky-200/80">
          <CircularProgress size={32} />
          <p className="text-sm font-semibold uppercase tracking-wide">
            Preparing audio… {Math.max(0, percentLoaded)}%
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-sky-900/50 bg-sky-950/40 p-3">
          <Slider value={0} disabled ariaLabel="Playback position" styles={{ padding: '4px 0 0' }} />
          <div className="flex items-center justify-between text-xs font-semibold text-sky-200/70 tabular-nums">
            <span>Total --:--</span>
            <span>Elapsed --:--</span>
            <span>- --:--</span>
          </div>
          <VolumeControl volume={volume} onVolumeChange={setVolume} onToggleMute={toggleMute} />
        </div>
      </div>
    </div>
  );
};

const Player = () => {
  const hasRedownloaded = useRef(false);
  const currentSongId = useSelector((state: RootState) => state.global.currentSong);
  const downloads = useSelector(
    (state: RootState) => state.global.downloads as Record<string, DownloadEntry>,
  );
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

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

  if (!songItem) return null;

  const percentLoaded = Math.round(songItem?.status?.percentLoaded ?? 0);
  const coverImage = (songItem?.id && imageCoverHash[songItem.id]) || radioImg;

  return (
    <>
      <div className={`${isCollapsed ? 'hidden' : ''} fixed bottom-0 left-0 right-0 z-40`}>
        <div className="border-t border-sky-900/60 bg-sky-950/25 backdrop-blur-lg">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
            {songUrl ? (
              <PlayerPlayback
                song={songItem}
                songUrl={songUrl}
                onCollapse={() => setIsCollapsed(true)}
                onPlaybackStateChange={setIsAudioPlaying}
              />
            ) : (
              <PlayerLoading
                song={songItem}
                percentLoaded={percentLoaded}
                onCollapse={() => setIsCollapsed(true)}
              />
            )}
          </div>
        </div>
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-full border border-sky-900/60 bg-sky-950/80 px-3 py-2 text-white shadow-lg backdrop-blur"
          title="Show player"
          aria-label="Show player"
        >
          <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-sky-900/60 bg-sky-950/60">
            <img src={coverImage} alt={songItem.title || 'Cover art'} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex items-end gap-1">
            {[0, 1, 2].map((bar) => (
              <span
                key={bar}
                className="w-1.5 rounded-full bg-emerald-400"
                style={{
                  height: isAudioPlaying ? `${10 + bar * 4}px` : `${6 + bar * 2}px`,
                  animation: isAudioPlaying ? `player-equalize 1.1s ease-in-out ${bar * 0.15}s infinite` : 'none',
                  transformOrigin: 'bottom',
                }}
              />
            ))}
          </div>
        </button>
      )}
    </>
  );
};

export default Player;
