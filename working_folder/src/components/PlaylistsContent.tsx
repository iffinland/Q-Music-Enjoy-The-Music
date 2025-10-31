import { useSelector } from "react-redux";
import { PlayList } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { PlaylistItem } from "./PlaylistItem";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@mui/material";



interface SearchContentProps {
  playlists: PlayList[];
}

export const PlayListsContent: React.FC<SearchContentProps> = ({
  playlists,
}) => {
  const playlistHash = useSelector((state: RootState) => state.global.playlistHash);
  const navigate = useNavigate();

  // if (songs.length === 0) {
  //   return (
  //     <div 
  //       className="
  //         flex 
  //         flex-col 
  //         gap-y-2 
  //         w-full 
  //         px-6 
  //         text-neutral-400
  //       "
  //     >
  //       No songs found.
  //     </div>
  //   )
  // }

  return ( 
    <div className="flex flex-col gap-y-2 w-full px-6">
      {playlists.map((playlist: PlayList) => {
        const existingPlaylist = playlistHash[playlist.id];

        if (!existingPlaylist) {
          return (
            <Skeleton
              key={`playlist-skeleton-${playlist.id}`}
              variant="rectangular"
              style={{
                width: '100%',
                height: '64px',
              }}
            />
          );
        }

        const playlistObj = existingPlaylist;
        return (
          <div 
            key={playlistObj.id} 
            className="flex items-center gap-x-4 w-full"
          >
            <div className="flex-1">
              <PlaylistItem 
                onClick={() => {
                  navigate(`/playlists/${playlistObj.user}/${playlistObj.id}`)
                }} 
                data={playlistObj}
              />
            </div>
            {/* <LikeButton songId={song.id} name={song.name} service={song.service} songData={song} /> */}
          </div>
        )
      })}
    </div>
  );
}
 
