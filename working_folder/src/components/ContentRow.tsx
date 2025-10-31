import React from 'react';
import { twMerge } from 'tailwind-merge';
import { SongMeta, PlayList } from '../state/features/globalSlice';
import SongItem from './SongItem';
import PlaylistCard from './PlaylistCard';

import useOnPlay from '../hooks/useOnPlay';
import { useNavigate } from "react-router-dom";

interface ContentRowProps {
  title: string;
  data: (SongMeta | PlayList)[];
  type: 'song' | 'playlist';
  showHeader?: boolean;
  actionSlot?: React.ReactNode;
  className?: string;
}

const ContentRow: React.FC<ContentRowProps> = ({
  title,
  data,
  type,
  showHeader = true,
  actionSlot,
  className,
}) => {
  const onPlay = useOnPlay(data as SongMeta[]);
  const navigate = useNavigate();

  if (data.length === 0) {
    return null; // Don't render anything if there is no data
  }

  return (
    <div className={twMerge('space-y-3', className)}>
      {showHeader && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-white text-2xl font-semibold">{title}</h2>
          {actionSlot}
        </div>
      )}
      <div className="flex overflow-x-auto gap-x-4 pb-3 horizontal-scrollbar">
        {data.map((item) => (
          <div key={item.id} className="flex-shrink-0">
            {type === 'song' ? (
              <SongItem onClick={(id) => onPlay(id)} data={item as SongMeta} />
            ) : (
              <PlaylistCard 
                data={item as PlayList} 
                onClick={() => {
                  const playlist = item as PlayList;
                  if (!playlist?.user || !playlist?.id) return;
                  navigate(`/playlists/${encodeURIComponent(playlist.user)}/${encodeURIComponent(playlist.id)}`);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentRow;
