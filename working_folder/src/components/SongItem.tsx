import { SongMeta, setAddToDownloads, setCurrentSong } from "../state/features/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import radioImg from '../assets/img/enjoy-music.jpg';
import { MyContext } from "../wrappers/DownloadWrapper";
import { FaPlay } from "react-icons/fa";
import { FiDownload, FiThumbsUp } from "react-icons/fi";
import { LuCopy } from "react-icons/lu";
import { RiHandCoinLine } from "react-icons/ri";
import { MouseEvent, useCallback, useContext, useEffect, useState } from "react";
import LikeButton from "./LikeButton";
import { Song } from "../types";
import { AddToPlaylistButton } from "./AddToPlayistButton";
import { toast } from "react-hot-toast";
import { buildSongShareUrl } from "../utils/qortalLinks";
import { getQdnResourceUrl } from "../utils/qortalApi";
import { Link, useNavigate } from "react-router-dom";
import useSendTipModal from "../hooks/useSendTipModal";
import { fetchSongLikeCount, hasUserLikedSong, likeSong, unlikeSong } from "../services/songLikes";

interface SongItemProps {
  data: SongMeta;
  onClick: (id: string) => void;
}

const SongItem: React.FC<SongItemProps> = ({
  data,
  onClick
}) => {
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const { downloadVideo } = useContext(MyContext)
  const downloads = useSelector(
    (state: RootState) => state.global.downloads
  )

  const dispatch = useDispatch()
  const navigate = useNavigate();
  const sendTipModal = useSendTipModal();
  const [songLikeCount, setSongLikeCount] = useState<number | null>(null);
  const [hasSongLike, setHasSongLike] = useState<boolean>(false);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);

  const coverImage = imageCoverHash[data.id] || radioImg;
  const publisherName = data?.name?.trim() || "—";
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
        author: data?.author || "",
      }));
    } else {
      downloadVideo({
        name: data.name,
        service: 'AUDIO',
        identifier: data.id,
        title: data?.title || "",
        author: data?.author || "",
        id: data.id,
      });
    }

    dispatch(setCurrentSong(data.id));
    onClick(data.id);
  }, [data, downloads, dispatch, downloadVideo, onClick]);

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

  const handlePlaceholder = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }

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

  const favoriteSongData: Song = {
    id: data.id,
    title: data.title,
    name: data.name,
    author: data.author,
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
        {data?.author}
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
          title="Play song"
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
          aria-label="Like this song"
          title={hasSongLike ? "Unlike this song" : "Like this song"}
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
          title="Add to Favorites"
          ariaLabel="Add to favorites"
        />
        <button
          type="button"
          onClick={handlePlaceholder}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
          aria-label="Download"
          title="Download song"
        >
          <FiDownload size={16} />
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
          aria-label="Copy link"
          title="Copy song link"
        >
          <LuCopy size={16} />
        </button>
        <button
          type="button"
          onClick={handleSendTip}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-900/40 text-sky-200/60 hover:bg-sky-800/50 transition"
          aria-label="Send tip"
          title="Send a tip"
        >
          <RiHandCoinLine size={16} />
        </button>
      </div>
    </div>
  </div>
  
   );
}
 
export default SongItem;
