import { toast } from "react-hot-toast";
import { Song } from "../types";
import usePublishContentModal from "../hooks/usePublishContentModal";
import { useSelector } from "react-redux";
import { RootState } from "../state/store";
import { HiOutlineSparkles } from "react-icons/hi";

interface LibraryProps {
  songs: Song[];
}

export const AddLibrary: React.FC<LibraryProps> = ({
  songs: _songs
}) => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const statistics = useSelector((state: RootState) => state.global.statistics);
  const statsData = statistics.data;

  const publishContentModal = usePublishContentModal();

  const formatStat = (value?: number | null) => {
    if (value == null) {
      return statistics.isLoading ? 'Loading…' : '—';
    }
    return value.toLocaleString();
  };

  const onClick = () => {
    if (!username) {
      toast.error('Log in to continue')
      return
    }

    return publishContentModal.openMulti ? publishContentModal.openMulti() : publishContentModal.open('multi');
  }

  return (
    <>

      <div className="flex flex-col gap-y-2">
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <HiOutlineSparkles className="text-current" size={18} />
          <span>Add New Content</span>
        </button>
        <hr className="my-4 border-t border-sky-800" />
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
