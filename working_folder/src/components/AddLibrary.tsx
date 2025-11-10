import { Song } from "../types";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";

interface LibraryProps {
  songs: Song[];
}

export const AddLibrary: React.FC<LibraryProps> = ({
  songs: _songs
}) => {
  const statistics = useSelector((state: RootState) => state.global.statistics);
  const statsData = statistics.data;

  const formatStat = (value?: number | null) => {
    if (value == null) {
      return statistics.isLoading ? 'Loading…' : '—';
    }
    return value.toLocaleString();
  };

  return (
    <>

      <div className="flex flex-col gap-y-2">
        <div className="flex flex-col gap-y-2">
          <p className="text-sky-200/80 text-lg uppercase font-bold">little statistics</p>
          <p className="text-sky-200/80 font-medium text-sm">All QDN songs: {formatStat(statsData?.allSongs)}</p>
          <p className="text-sky-200/80 font-medium text-sm">All QDN playlists: {formatStat(statsData?.allPlaylists)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Q-Music songs: {formatStat(statsData?.qmusicSongs)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Q-Music playlists: {formatStat(statsData?.qmusicPlaylists)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Ear Bump songs: {formatStat(statsData?.earbumpSongs)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Ear Bump playlists: {formatStat(statsData?.earbumpPlaylists)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Total Podcasts: {formatStat(statsData?.totalPodcasts)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Total Audiobooks: {formatStat(statsData?.totalAudiobooks)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Music Videos: {formatStat(statsData?.musicVideos)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Open Requests: {formatStat(statsData?.openRequests)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Filled Requests: {formatStat(statsData?.filledRequests)}</p>
          <p className="text-sky-200/80 font-medium text-sm">Total publishers: {formatStat(statsData?.totalPublishers)}</p>
        </div>
        <hr className="my-4 border-t border-sky-800" />
      </div>
    </>
  );
}
