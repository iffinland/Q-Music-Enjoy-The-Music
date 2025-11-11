"use client";

import radioImg from '../assets/img/enjoy-music.jpg';
import { PlayList } from "../state/features/globalSlice";
import useCoverImage from "../hooks/useCoverImage";

interface PlaylistItemProps {
  data: PlayList;
  onClick?: () => void;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({
  data,
  onClick,
}) => {
  const songCount = data?.songs?.length ?? 0;
  const { url: coverUrl } = useCoverImage({
    identifier: data?.id ?? null,
    publisher: data?.user ?? null,
    enabled: Boolean(data?.id && data?.user),
  });
  const coverImage = data?.image || coverUrl || radioImg;

  return ( 
    <div
      onClick={onClick}
      className="
        flex 
        items-center 
        gap-x-3 
        cursor-pointer 
        hover:bg-sky-900/40 
        w-full 
        p-2 
        rounded-md
      "
    >
      <div 
        className="
          relative 
          rounded-md 
          min-h-[48px] 
          min-w-[48px] 
          overflow-hidden
        "
      >
        <img
          src={coverImage}
          alt="MediaItem"
          className="object-cover absolute"
        />
      </div>
      <div className="flex flex-col gap-y-1 overflow-hidden">
        <p
          className="text-white text-sm font-semibold leading-snug break-words"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data?.title}
        </p>
        <p
          className="text-sky-200/80 text-xs leading-snug break-words"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data?.description}
        </p>
        <p className="text-xs font-medium text-sky-300/70">
          Songs: {songCount}
        </p>
      </div>
    </div>
  );
}
