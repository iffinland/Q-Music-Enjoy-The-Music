import { SongMeta, setAddToDownloads, setCurrentSong } from "../state/features/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import radioImg from '../assets/img/enjoy-music.jpg';
import { MyContext } from "../wrappers/DownloadWrapper";
import { FaPlay } from "react-icons/fa";
import { FiDownload, FiEdit2, FiThumbsUp } from "react-icons/fi";
import { LuCopy } from "react-icons/lu";
import { RiHandCoinLine } from "react-icons/ri";
import { MouseEvent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import LikeButton from "./LikeButton";
import { Song } from "../types";
import { AddToPlaylistButton } from "./AddToPlayistButton";
import { toast } from "react-hot-toast";
import { buildSongShareUrl } from "../utils/qortalLinks";
import { getQdnResourceUrl } from "../utils/qortalApi";
import { Link, useNavigate } from "react-router-dom";
import useSendTipModal from "../hooks/useSendTipModal";
import { fetchSongLikeCount, hasUserLikedSong, likeSong, unlikeSong } from "../services/songLikes";
import useUploadModal from "../hooks/useUploadModal";
import useCoverImage from "../hooks/useCoverImage";
import { buildDownloadFilename } from '../utils/downloadFilename';

interface SongItemProps {
  data: SongMeta;
  onClick: (id: string) => void;
}

const SongItem: React.FC<SongItemProps> = ({
  data,
  onClick
}) => {
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const { downloadVideo } = useContext(MyContext)
  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )

  const dispatch = useDispatch()
  const navigate = useNavigate();
  const sendTipModal = useSendTipModal();
  const uploadModal = useUploadModal();
  const [songLikeCount, setSongLikeCount] = useState<number | null>(null);
  const [hasSongLike, setHasSongLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  const isOwner = useMemo(() => {
    if (!username || !data?.name) return false;
    return username.toLowerCase() === data.name.toLowerCase();
  }, [username, data?.name]);

  const { url: coverImageUrl } = useCoverImage({
    identifier: data?.id,
    publisher: data?.name,
    enabled: Boolean(data?.id && data?.name),
  });
  const coverImage = coverImageUrl || radioImg;
  const publisherName = data?.name?.trim() || "—";
  const normalizedCreator = typeof data?.author === 'string' ? data.author.trim() : '';
  const creatorDisplay = normalizedCreator || (publisherName !== "—" ? publisherName : 'Unknown artist');
  const encodedPublisher = data?.name ? encodeURIComponent(data.name) : 'unknown';
  const encodedIdentifier = data?.id ? encodeURIComponent(data.id) : 'unknown';

  useEffect(() => {
    let cancelled = false;

    const loadLikeData = async () => {
      try {
        const count = await fetchSongLikeCount(data.id);
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
        const liked = await hasUserLikedSong(username, data.id);
        if (!cancelled) {
          setHasSongLike(liked);
        }
      } catch (error) {
        if (!cancelled) {
          setHasSongLike(false);
        }
      }
    };

    loadLikeData();

    return () => {
      cancelled = true;
    };
  }, [data.id, username]);

  const handlePlay = useCallback(async (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    if (data?.status?.status === 'READY' || downloads[data.id]?.status?.status === 'READY') {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', data.name, data.id);
      dispatch(setAddToDownloads({
        name: data.name,
        service: 'AUDIO',
        id: data.id,
        identifier: data.id,
        url: resolvedUrl ?? undefined,
        status: data?.status,
        title: data?.title || "",
        author: creatorDisplay,
      }));
    } else {
      downloadVideo({
        name: data.name,
        service: 'AUDIO',
        identifier: data.id,
        title: data?.title || "",
        author: creatorDisplay,
        id: data.id,
      });
    }

    dispatch(setCurrentSong(data.id));
    onClick(data.id);
  }, [creatorDisplay, data, downloads, dispatch, downloadVideo, onClick]);

  const handleNavigate = useCallback(() => {
    if (!data?.name || !data?.id) return;
    navigate(`/songs/${encodedPublisher}/${encodedIdentifier}`);
  }, [navigate, encodedPublisher, encodedIdentifier, data?.name, data?.id]);

  const copyToClipboard = useCallback(async (text: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }, []);

  const handleCopyLink = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      const shareLink = buildSongShareUrl(data.name, data.id);

      await copyToClipboard(shareLink);
      toast.success("Copying the link to the clipboard was successful. Happy sharing!");
    } catch (error) {
      console.error("Failed to copy song link", error);
      toast.error("Failed to copy the link. Please try again.");
    }
  }, [copyToClipboard, data.id, data.name]);

  const handleDownload = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!data?.name) {
      toast.error("Song publisher information is missing.");
      return;
    }

    try {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', data.name, data.id);
      if (!resolvedUrl) {
        toast.error("Song download is not available yet.");
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = resolvedUrl;
      anchor.download = buildDownloadFilename({
        title: data.title,
        fallbackId: data.id,
        resolvedUrl,
      });
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      dispatch(setAddToDownloads({
        name: data.name,
        service: 'AUDIO',
        id: data.id,
        identifier: data.id,
        url: resolvedUrl,
        status: data?.status,
        title: data?.title || "",
        author: creatorDisplay,
      }));
      toast.success("Song download started.");
    } catch (error) {
      console.error("Failed to download song", error);
      toast.error("Song could not be downloaded. Please try again later.");
    }
  }, [creatorDisplay, data?.id, data?.name, data?.status, data?.title, dispatch]);

  const handleSendTip = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!username) {
        toast.error("Log in to send tips.");
        return;
      }

      if (!data.name) {
        toast.error("Creator information is missing.");
        return;
      }

      sendTipModal.open(data.name);
    },
    [data.name, sendTipModal, username],
  );

  const handleEdit = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!isOwner) {
      toast.error("Only the original publisher can edit this song.");
      return;
    }

    if (!data) {
      toast.error("Song metadata incomplete.");
      return;
    }

    uploadModal.openSingleEdit(data);
  }, [data, isOwner, uploadModal]);

  const favoriteSongData: Song = {
    id: data.id,
    title: data.title,
    name: data.name,
    author: normalizedCreator || creatorDisplay,
    service: data.service,
    status: data.status
  };
  const handleToggleSongLike = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!username) {
        toast.error("Log in to like songs.");
        return;
      }

      if (isProcessingLike) return;

      try {
        setIsProcessingLike(true);
        if (hasSongLike) {
          await unlikeSong(username, data.id);
          setHasSongLike(false);
          setSongLikeCount((prev) => Math.max(0, (prev ?? 1) - 1));
          toast.success(`Removed like from "${data.title || 'this song'}".`);
        } else {
          await likeSong(username, {
            id: data.id,
            name: data.name,
            title: data.title,
          });
          setHasSongLike(true);
          setSongLikeCount((prev) => (prev ?? 0) + 1);
          toast.success(`You liked "${data.title || 'this song'}"!`);
        }
      } catch (error) {
        console.error("Failed to toggle song like", error);
        toast.error("Could not update like. Please try again.");
      } finally {
        setIsProcessingLike(false);
      }
    },
    [username, isProcessingLike, hasSongLike, data.id, data.name, data.title],
  );
 
  return ( 
    <div
    role="button"
    tabIndex={0}
    onClick={handleNavigate}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleNavigate();
      }
    }}
    className="
      relative 
      group 
      flex 
      flex-col 
      items-center 
      justify-center 
      rounded-md 
      overflow-hidden 
      gap-x-4 
      bg-sky-950/40 
      border 
      border-sky-900/40
      hover:bg-sky-900/50 
      transition 
      p-4
      w-[240px]
      min-w-[240px]
      h-[340px]
    "
  >
    <div 
      className="
        relative 
        w-full
        h-40 
        rounded-md 
        overflow-hidden
      "
    >
      <img
        className="object-cover w-full h-full"
        src={coverImage}
        alt="Image"
      />
    </div>
    <div className="flex flex-col items-start w-full pt-4 gap-y-1">
      <Link
        to={`/songs/${encodedPublisher}/${encodedIdentifier}`}
        className="font-semibold truncate w-full hover:text-sky-300 transition"
        title="Open song details"
      >
        {data?.title}
      </Link>
      <p 
        className="
          text-sky-200/80 
          text-sm 
          pb-4 
          w-full 
          truncate
        "
      >
        {creatorDisplay}
      </p>
      <p className="text-sky-400/60 text-xs" title={publisherName !== "—" ? publisherName : undefined}>
        by {publisherName}
      </p>
    </div>
    <div className="mt-auto w-full">
      <div className="flex flex-wrap items-center gap-2 text-sky-200/80">
        <button
          type="button"
          onClick={handlePlay}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-800/70 hover:bg-sky-700 text-white transition"
          aria-label="Play"
          title="Play"
        >
          <FaPlay size={16} />
        </button>
        <AddToPlaylistButton
          song={favoriteSongData}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/40"
          iconSize={16}
        />
        <button
          type="button"
          onClick={handleToggleSongLike}
          disabled={isProcessingLike}
          className={`flex items-center justify-center gap-1 rounded-full px-2.5 h-9 text-[11px] font-semibold transition ${
            hasSongLike
              ? 'bg-sky-800/70 text-white hover:bg-sky-700'
              : 'bg-sky-900/40 text-sky-200/70 hover:bg-sky-800/50'
          }`}
          aria-label="Like It"
          title="Like It"
        >
          <FiThumbsUp size={16} />
          <span>{songLikeCount ?? '—'}</span>
        </button>
        <LikeButton
          songId={data.id}
          name={data.name}
          service={data?.service || 'AUDIO'}
          songData={favoriteSongData}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white"
          activeClassName="bg-sky-800/70 hover:bg-sky-700"
          inactiveClassName="bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/40"
          iconSize={16}
          title="Add Favorites"
          ariaLabel="Add Favorites"
        />
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
          aria-label="Download"
          title="Download"
        >
          <FiDownload size={16} />
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
          aria-label="Copy link & Share It"
          title="Copy link & Share It"
        >
          <LuCopy size={16} />
        </button>
        <button
          type="button"
          onClick={handleSendTip}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
          aria-label="Send Tips to Publisher"
          title="Send Tips to Publisher"
        >
          <RiHandCoinLine size={16} />
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
            aria-label="Edit"
            title="Edit"
          >
            <FiEdit2 size={16} />
          </button>
        )}
      </div>
    </div>
  </div>
  
   );
}
 
export default SongItem;
