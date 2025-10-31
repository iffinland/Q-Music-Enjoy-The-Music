import React, { useState } from 'react';
import Header from '../../components/Header';
import SearchInput from '../../components/SearchInput';
import Box from '../../components/Box';
import { useSearch, SearchResults } from '../../hooks/useSearch';
import SongItem from '../../components/SongItem';
import PlaylistCard from '../../components/PlaylistCard';
import VideoCard from '../../components/videos/VideoCard';
import { PodcastCard } from '../../components/podcasts/PodcastCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../state/store';
import { CircularProgress } from '@mui/material';
import useOnPlay from '../../hooks/useOnPlay';

export const Search = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const { search, error } = useSearch();
  const isLoading = useSelector((state: RootState) => state.global.isLoadingGlobal);
  const onPlay = useOnPlay(results?.songs || []);

  const handleSearch = async () => {
    if (!searchTerm) return;
    const searchResults = await search(searchTerm);
    setResults(searchResults);
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center py-10"><CircularProgress /></div>;
    }

    if (error) {
      return <div className="text-center text-red-500 py-10">{error}</div>;
    }

    if (!results) {
      return <div className="text-center text-gray-500 py-10">Enter a search term to begin.</div>;
    }

    const { songs, playlists, videos, podcasts, requests } = results;

    const noResults = songs.length === 0 && playlists.length === 0 && videos.length === 0 && podcasts.length === 0 && requests.length === 0;

    if (noResults) {
      return <div className="text-center text-gray-500 py-10">No results found.</div>;
    }

    return (
      <div className="flex flex-col gap-y-8 px-6 py-6">
        {songs.length > 0 && (
          <div>
            <h2 className="text-white text-2xl font-semibold mb-4">Songs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-8 gap-4 mt-4">
              {songs.map((song) => (
                <SongItem key={song.id} onClick={(id) => onPlay(id)} data={song} />
              ))}
            </div>
          </div>
        )}
        {playlists.length > 0 && (
          <div>
            <h2 className="text-white text-2xl font-semibold mb-4">Playlists</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-8 gap-4 mt-4">
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} data={playlist} />
              ))}
            </div>
          </div>
        )}
        {videos.length > 0 && (
          <div>
            <h2 className="text-white text-2xl font-semibold mb-4">Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}
        {podcasts.length > 0 && (
          <div>
            <h2 className="text-white text-2xl font-semibold mb-4">Podcasts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {podcasts.map((podcast) => (
                <PodcastCard key={podcast.id} podcast={podcast} />
              ))}
            </div>
          </div>
        )}
        {requests.length > 0 && (
          <div>
            <h2 className="text-white text-2xl font-semibold mb-4">Requests</h2>
            <ul className="divide-y divide-sky-900/60">
              {requests.map((request) => (
                <li key={request.id} className="py-2">
                  <p className="text-white">{request.artist} - {request.title}</p>
                  <p className="text-sm text-gray-400">Requested by: {request.publisher}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Box className="overflow-hidden">
      <Header className="rounded-t-lg bg-gradient-to-b from-sky-900/80 via-sky-950/40 to-transparent">
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">
            Search
          </h1>
          <SearchInput 
            value={searchTerm}
            onChange={setSearchTerm}
            onEnter={handleSearch}
          />
        </div>
      </Header>
      {renderContent()}
    </Box>
  );
};