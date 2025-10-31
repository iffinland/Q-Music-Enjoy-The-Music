// @ts-nocheck
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { StoreList } from "./pages/StoreList/StoreList";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { lightTheme, darkTheme } from "./styles/theme";
import { store } from "./state/store";
import { Provider } from "react-redux";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { Home } from "./pages/Home/Home";
import { VideoContent } from "./pages/VideoContent/VideoContent";
import { Layout } from "./components/layout/Layout";
import ModalProvider from "./wrappers/ModalProvider";
import { Search } from "./pages/Search/Search";
import ToasterProvider from "./wrappers/ToasterProvider";
import DownloadWrapper from "./wrappers/DownloadWrapper";
import { Liked } from "./pages/Liked/Liked";
import { Library } from "./pages/Library/Library";
import { Playlists } from "./pages/Playlists/Playlists";
import { Playlist } from "./pages/Playlist/Playlist";
import { Newest } from "./pages/Newest/Newest";

function App() {
  // const themeColor = window._qdnTheme

  const [theme, setTheme] = useState("dark");

  return (
    <Provider store={store}>
  
        <Notification />
        <DownloadWrapper>
        <GlobalWrapper setTheme={(val: string) => setTheme(val)}>
          <ModalProvider />
          <ToasterProvider />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/playlists/:name/:playlistId" element={<Playlist />} />
            <Route path="/liked" element={<Liked />} />
            <Route path="/library" element={<Library />} />
            <Route path="/newest" element={<Newest />} />
          </Routes>
          </Layout>
       
        </GlobalWrapper>
        </DownloadWrapper>
    </Provider>
  );
}

export default App;
