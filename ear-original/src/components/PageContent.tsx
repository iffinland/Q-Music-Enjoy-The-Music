
import { useCallback, useEffect, useRef } from "react";
import { useFetchSongs } from "../hooks/fetchSongs";
import useOnPlay from "../hooks/useOnPlay";
import { Song } from "../types";
import SongItem from "./SongItem";
import LazyLoad from "./common/LazyLoad";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import { CircularProgress } from "@mui/material";

interface PageContentProps {
  songs: Song[];
}

const PageContent: React.FC<PageContentProps> = ({
  songs
}) => {
  const onPlay = useOnPlay(songs);
  const initialFetch = useRef(songs?.length > 0 ? true : false)
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const songListRecent = useSelector((state: RootState) => state?.global.songListRecent);
  const { getRecentSongs } = useFetchSongs()


  const fetchRecentSongs = useCallback(async () => {
    try {
      await getRecentSongs()
      initialFetch.current = true
    } catch (error) {

    }
  }, [getRecentSongs])

  useEffect(() => {
    if (!initialFetch.current) {
      fetchRecentSongs()
    }

  }, [])

  if (!initialFetch.current) return (
    <div

      style={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '25px',
        overflow: 'hidden'
      }}
    >
      <div

      >
        <CircularProgress />
      </div>
    </div>
  )

  if (songs.length === 0) {
    return (
      <div className="mt-4 text-neutral-400">
        No songs available.
      </div>
    )
  }

  return (
    <>
      <div
        className="
        grid 
        grid-cols-2 
        sm:grid-cols-3 
        md:grid-cols-3 
        lg:grid-cols-4 
        xl:grid-cols-5 
        2xl:grid-cols-8 
        gap-4 
        mt-4
      "
      >
        {songListRecent.map((item) => {
          return (
            <SongItem
              onClick={(id: string) => onPlay(id)}
              key={item.id}
              data={item}
            />
          )
        })}

      </div>
      <LazyLoad onLoadMore={fetchRecentSongs}></LazyLoad>
    </>
  );
}

export default PageContent;