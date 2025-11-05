import { Routes, Route, Navigate } from "react-router-dom";
import { store } from "./state/store";
import { Provider } from "react-redux";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { Home } from "./pages/Home/Home";
import { Layout } from "./components/layout/Layout";
import ModalProvider from "./wrappers/ModalProvider";
import { Search } from "./pages/Search/Search";
import ToasterProvider from "./wrappers/ToasterProvider";
import DownloadWrapper from "./wrappers/DownloadWrapper";
import { Library } from "./pages/Library/Library";
import { Playlists } from "./pages/Playlists/Playlists";
import { Playlist } from "./pages/Playlist/Playlist";
import { Newest } from "./pages/Newest/Newest";
import BrowseAllSongs from "./pages/BrowseAllSongs/BrowseAllSongs";
import BrowseAllPlaylists from "./pages/BrowseAllPlaylists/BrowseAllPlaylists";
import Videos from "./pages/Videos/Videos";
import VideoDetail from "./pages/Videos/VideoDetail";
import Podcasts from "./pages/Podcasts/Podcasts";
import PodcastDetail from "./pages/Podcasts/PodcastDetail";
import Audiobooks from "./pages/Audiobooks/Audiobooks";
import AudiobookDetail from "./pages/Audiobooks/AudiobookDetail";
import Requests from "./pages/Requests/Requests";
import SongDetail from "./pages/Song/SongDetail";

function App() {
  return (
    <Provider store={store}>
  
        <Notification />
        <DownloadWrapper>
        <GlobalWrapper>
          <ModalProvider />
          <ToasterProvider />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/playlists/all" element={<BrowseAllPlaylists />} />
            <Route path="/playlists/:name/:playlistId" element={<Playlist />} />
            <Route path="/liked" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<Library />} />
            <Route path="/newest" element={<Newest />} />
            <Route path="/songs/:publisher/:identifier" element={<SongDetail />} />
            <Route path="/songs" element={<BrowseAllSongs />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/videos/:publisher/:identifier" element={<VideoDetail />} />
            <Route path="/podcasts" element={<Podcasts />} />
            <Route path="/podcasts/:publisher/:identifier" element={<PodcastDetail />} />
            <Route path="/audiobooks" element={<Audiobooks />} />
            <Route path="/audiobooks/:publisher/:identifier" element={<AudiobookDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Layout>
       
        </GlobalWrapper>
        </DownloadWrapper>
    </Provider>
  );
}

export default App;
