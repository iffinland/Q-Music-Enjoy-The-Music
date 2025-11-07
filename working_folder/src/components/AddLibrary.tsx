import { toast } from "react-hot-toast";
import { Song } from "../types";
import useUploadModal from "../hooks/useUploadModal";
import useUploadPlaylistModal from "../hooks/useUploadPlaylistModal";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { BsMusicNoteList, BsMusicNote } from "react-icons/bs";
import { setNewPlayList } from "../state/features/globalSlice";
import { FaVideo, FaPodcast, FaBookOpen } from "react-icons/fa";
import { BiListPlus } from "react-icons/bi";
import { useNavigate } from "react-router-dom";

interface LibraryProps {
  songs: Song[];
}

export const AddLibrary: React.FC<LibraryProps> = ({
  songs: _songs
}) => {
  const username = useSelector((state: RootState) => state?.auth?.user?.name);
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);
  const statistics = useSelector((state: RootState) => state.global.statistics);
  const statsData = statistics.data;

  const dispatch = useDispatch()
  const uploadModal = useUploadModal();
  const uploadPlaylistModal = useUploadPlaylistModal()
  const navigate = useNavigate();

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

    return uploadModal.openPicker();
  }

  const onClickPlaylist = () => {
    if (!username) {
      toast.error('Log in to continue')
      return
    }

    if (!newPlaylist) {
      dispatch(setNewPlayList({
        id: '',
        created: Date.now(),
        updated: Date.now(),
        user: username,
        title: "",
        description: "",
        songs: [],
        image: null
      }))
    }

    uploadPlaylistModal.onOpen()



  }

  const onClickRequest = () => {
    navigate('/requests');
  }

  const onClickVideos = () => {
    navigate('/videos');
  }

  const onClickPodcasts = () => {
    navigate('/podcasts');
  }

  const onClickAudiobooks = () => {
    navigate('/audiobooks');
  }


  return (
    <>

      <div className="flex flex-col gap-y-2">
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <BsMusicNote className="text-current" size={18} />
          <span>Add New Songs or Album</span>
        </button>
        <button
          type="button"
          onClick={onClickPlaylist}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <BsMusicNoteList className="text-current" size={18} />
          <span>Create New Playlist</span>
        </button>
        <button
          type="button"
          onClick={onClickRequest}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <BiListPlus className="text-current" size={18} />
          <span>Requests and Fillings</span>
        </button>
        <button
          type="button"
          onClick={onClickVideos}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <FaVideo className="text-current" size={18} />
          <span>Watch & Add New Videos</span>
        </button>
        <button
          type="button"
          onClick={onClickPodcasts}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <FaPodcast className="text-current" size={18} />
          <span>Listen & Add New Podcast</span>
        </button>
        <button
          type="button"
          onClick={onClickAudiobooks}
          className="flex w-full items-center gap-x-4 text-sky-200/80 hover:text-white font-medium text-sm transition focus:outline-none"
        >
          <FaBookOpen className="text-current" size={18} />
          <span>Listen & Add New Audiobooks</span>
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
