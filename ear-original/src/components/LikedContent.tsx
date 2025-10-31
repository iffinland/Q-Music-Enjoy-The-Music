import useOnPlay from "../hooks/useOnPlay";
import { Song } from "../types";
import { AddToPlaylistButton } from "./AddToPlayistButton";
import LikeButton from "./LikeButton";
import MediaItem from "./MediaItem";



interface SearchContentProps {
  songs: Song[];
}

export const LikedContent: React.FC<SearchContentProps> = ({
  songs
}) => {
  const onPlay = useOnPlay(songs);

  if (songs.length === 0) {
    return (
      <div 
        className="
          flex 
          flex-col 
          gap-y-2 
          w-full 
          px-6 
          text-neutral-400
        "
      >
        No songs found.
      </div>
    )
  }
  console.log('liked content')

  return ( 
    <div className="flex flex-col gap-y-2 w-full px-6">
      {songs.map((song: Song) => (
        <div 
          key={song.id} 
          className="flex items-center gap-x-4 w-full"
        >
          <div className="flex-1">
            <MediaItem 
              onClick={(id: string) => onPlay(id)} 
              data={song}
            />
          </div>
          <AddToPlaylistButton song={song} />
          <LikeButton songId={song.id} name={song.name} service={song.service} songData={song} />
        </div>
      ))}
    </div>
  );
}
 
