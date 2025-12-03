"use client";

import React, { useCallback, useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { FiPlay } from "react-icons/fi";

import { Song } from "../types";
import { RootState } from "../state/store";
import radioImg from "../assets/img/enjoy-music.jpg";
import { MyContext } from "../wrappers/DownloadWrapper";
import { setAddToDownloads, setCurrentSong } from "../state/features/globalSlice";
import { getQdnResourceUrl } from "../utils/qortalApi";
import useCoverImage from "../hooks/useCoverImage";

interface MediaItemProps {
  data: Song;
  onClick?: (id: string) => void;
  showPlayButton?: boolean;
}

const MediaItem: React.FC<MediaItemProps> = ({ data, onClick, showPlayButton = true }) => {
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const { downloadVideo } = useContext(MyContext);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const creatorDisplay = (data?.author?.trim()?.length ? data.author.trim() : '') || data?.name || 'Unknown artist';
  const { url: coverUrl } = useCoverImage({
    identifier: data?.id,
    publisher: data?.name,
    enabled: Boolean(data?.id && data?.name),
  });

  const handlePlay = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (data?.status?.status === 'READY' || downloads[data.id]?.status?.status === 'READY') {
      const resolvedUrl = await getQdnResourceUrl('AUDIO', data.name, data.id);
      dispatch(setAddToDownloads({
        name: data.name,
        service: 'AUDIO',
        id: data.id,
        identifier: data.id,
        url: resolvedUrl ?? undefined,
        status: data?.status,
        title: data?.title || '',
        author: creatorDisplay,
      }));
    } else {
      downloadVideo({
        name: data.name,
        service: 'AUDIO',
        identifier: data.id,
        title: data?.title || '',
        author: creatorDisplay,
        id: data.id,
      });
    }

    dispatch(setCurrentSong(data.id));
    onClick?.(data.id);
  }, [creatorDisplay, data, downloads, dispatch, downloadVideo, onClick]);

  const handleNavigate = useCallback(() => {
    if (!data?.name || !data?.id) return;
    navigate(`/songs/${encodeURIComponent(data.name)}/${encodeURIComponent(data.id)}`);
  }, [navigate, data?.name, data?.id]);

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
      className="flex items-center gap-x-3 cursor-pointer hover:bg-sky-900/40 w-full p-2 rounded-md"
    >
      {showPlayButton && (
        <button
          type="button"
          onClick={handlePlay}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-800/70 text-white transition hover:bg-sky-700"
          aria-label="Play song"
          title="Play song"
        >
          <FiPlay size={16} />
        </button>
      )}
      <div className="relative rounded-md min-h-[48px] min-w-[48px] overflow-hidden">
        <img
          src={coverUrl || radioImg}
          alt={data?.title || 'Song cover'}
          className="object-cover absolute inset-0 w-full h-full"
        />
      </div>
      <div className="flex flex-1 flex-col gap-y-1 overflow-hidden">
        <p className="text-white truncate">{data?.title}</p>
        <p className="text-sky-200/80 text-sm truncate">By {creatorDisplay}</p>
      </div>
    </div>
  );
};

export default MediaItem;
